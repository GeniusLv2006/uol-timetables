import { DESCRIPTION_FIELDS } from "./constants.js";
import { dateForWeek, parseWeekSelection, sourceWeeks } from "./timetable.js";

// Preferences tied to one semester's data. Saved profiles never carry these
// across, so applying a profile cannot move events to another semester's dates.
const SEMESTER_FIELDS = ["weekOneMonday", "semesterStart", "semesterEnd", "includeWeeks", "excludeWeeks", "readingWeek", "calendarName", "calendarDescription"];

export function isMondayDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(date.valueOf()) && date.getUTCDay() === 1;
}

export function defaultPreferences(payload) {
  const sourceOccurrences = isMondayDate(payload.weekOneMonday)
    ? payload.events.flatMap((event) =>
      sourceWeeks(event).map((week) => dateForWeek(payload.weekOneMonday, week, event.day)),
    ).sort((a, b) => a - b)
    : [];
  const modules = [...new Set(payload.events.map((event) => event.moduleCode))].sort();
  const locations = [...new Set(payload.events.map((event) => event.location).filter(Boolean))].sort();
  return {
    titleFormat: "code",
    customTitle: "{moduleCode} · {moduleTitle}",
    moduleAliases: Object.fromEntries(modules.map((code) => [code, ""])),
    descriptionOrder: ["activity", "deliveryType", "teachingWeeks", "academic", "moduleUrl", "source"],
    // Module URLs are exported as the standard VEVENT URL property below.
    // Keep the field available for explicit opt-in without duplicating it by default.
    descriptionEnabled: { activity: true, deliveryType: true, teachingWeeks: true, academic: true, moduleUrl: false, source: false },
    locationFormat: "full",
    locationAliases: Object.fromEntries(locations.map((location) => [location, ""])),
    reminderMinutes: "0",
    customReminderMinutes: 20,
    calendarName: payload.calendarName,
    fileName: "timetable.ics",
    calendarDescription: `University of Liverpool ${payload.academicYear || ""} Semester ${payload.semester || ""} timetable`.replace(/\s+/g, " ").trim(),
    calendarColor: "#243352",
    recurrenceMode: "recurring",
    weekOneMonday: payload.weekOneMonday,
    timezone: payload.timezone,
    semesterStart: sourceOccurrences[0]?.toISOString().slice(0, 10) || "",
    semesterEnd: sourceOccurrences.at(-1)?.toISOString().slice(0, 10) || "",
    includeWeeks: "",
    excludeWeeks: "",
    readingWeek: "",
    splitMode: "combined",
    includedDeliveryTypes: [...new Set(payload.events.map((event) => event.deliveryType || "Not Specified"))],
    includedActivities: [...new Set(payload.events.map((event) => event.activity))],
  };
}

export function mergePreferences(saved, payload, current = defaultPreferences(payload)) {
  const base = defaultPreferences(payload);
  const merged = { ...base, ...saved };
  for (const field of SEMESTER_FIELDS) merged[field] = current[field];
  merged.moduleAliases = { ...base.moduleAliases, ...(saved.moduleAliases || {}) };
  merged.locationAliases = { ...base.locationAliases, ...(saved.locationAliases || {}) };
  merged.descriptionEnabled = { ...base.descriptionEnabled, ...(saved.descriptionEnabled || {}) };
  merged.descriptionOrder = Array.isArray(saved.descriptionOrder)
    ? [...saved.descriptionOrder.filter((key) => key in DESCRIPTION_FIELDS), ...base.descriptionOrder.filter((key) => !saved.descriptionOrder.includes(key))]
    : base.descriptionOrder;
  merged.includedDeliveryTypes = Array.isArray(saved.includedDeliveryTypes)
    ? base.includedDeliveryTypes.filter((type) => saved.includedDeliveryTypes.includes(type))
    : base.includedDeliveryTypes;
  merged.includedActivities = Array.isArray(saved.includedActivities)
    ? base.includedActivities.filter((activity) => saved.includedActivities.includes(activity))
    : base.includedActivities;
  return merged;
}

export function payloadInventory(payload) {
  const unique = (values) => [...new Set(values)].sort();
  return {
    modules: unique(payload.events.map((event) => event.moduleCode)),
    locations: unique(payload.events.map((event) => event.location).filter(Boolean)),
    deliveryTypes: unique(payload.events.map((event) => event.deliveryType || "Not Specified")),
    activities: unique(payload.events.map((event) => event.activity)),
  };
}

// Carries customisations over to edited data: existing choices are kept,
// and modules, locations, types, or activities that are new get defaults.
export function reconcilePreferences(preferences, previousInventory, payload) {
  const base = defaultPreferences(payload);
  const keepAliases = (defaults, saved) => Object.fromEntries(Object.keys(defaults).map((key) => [key, saved[key] || ""]));
  const keepIncluded = (values, previous, included) => values.filter((value) => !previous.includes(value) || included.includes(value));
  return {
    ...preferences,
    moduleAliases: keepAliases(base.moduleAliases, preferences.moduleAliases),
    locationAliases: keepAliases(base.locationAliases, preferences.locationAliases),
    includedDeliveryTypes: keepIncluded(base.includedDeliveryTypes, previousInventory.deliveryTypes, preferences.includedDeliveryTypes),
    includedActivities: keepIncluded(base.includedActivities, previousInventory.activities, preferences.includedActivities),
  };
}

// Moving Week One shifts the semester bounds by the same number of days, so the
// same teaching weeks stay inside them.
export function changeWeekOne(preferences, value) {
  const previous = preferences.weekOneMonday;
  const next = { ...preferences, weekOneMonday: value };
  if (!isMondayDate(previous) || !isMondayDate(value)) return next;
  const offset = new Date(`${value}T00:00:00Z`) - new Date(`${previous}T00:00:00Z`);
  const shift = (date) => (date ? new Date(new Date(`${date}T00:00:00Z`).valueOf() + offset).toISOString().slice(0, 10) : date);
  next.semesterStart = shift(preferences.semesterStart);
  next.semesterEnd = shift(preferences.semesterEnd);
  return next;
}

export function effectiveWeeks(event, preferences) {
  const included = parseWeekSelection(preferences.includeWeeks);
  const excluded = parseWeekSelection(preferences.excludeWeeks) || new Set();
  if (preferences.readingWeek) excluded.add(Number(preferences.readingWeek));
  const start = preferences.semesterStart ? new Date(`${preferences.semesterStart}T00:00:00Z`) : null;
  const end = preferences.semesterEnd ? new Date(`${preferences.semesterEnd}T23:59:59Z`) : null;
  return sourceWeeks(event).filter((week) => {
    if (included && !included.has(week)) return false;
    if (excluded.has(week)) return false;
    const date = dateForWeek(preferences.weekOneMonday, week, event.day);
    return (!start || date >= start) && (!end || date <= end);
  });
}

export function getEffectiveEvents(payload, preferences) {
  return payload.events
    .filter((event) => preferences.includedDeliveryTypes.includes(event.deliveryType || "Not Specified"))
    .filter((event) => preferences.includedActivities.includes(event.activity))
    .map((event) => ({ event, weeks: effectiveWeeks(event, preferences) }))
    .filter((entry) => entry.weeks.length);
}

export function formatLocation(event, preferences) {
  if (preferences.locationFormat === "hidden") return "";
  const original = event.location || "";
  const location = preferences.locationAliases[original] || original;
  if (preferences.locationFormat === "room") {
    if (location.includes(":")) return location.split(":").at(-1).trim();
    if (location.includes(",")) return location.split(",").at(-1).trim();
  }
  if (preferences.locationFormat === "building-room") return location.replace(/:\s*/g, " · ");
  return location;
}

export function titleForEvent(event, preferences) {
  const alias = preferences.moduleAliases[event.moduleCode] || event.moduleTitle;
  const templates = {
    code: "{moduleCode}",
    "code-name": "{moduleCode} · {moduleAlias}",
    "code-type": "{moduleCode} · {deliveryType}",
    name: "{moduleAlias}",
    custom: preferences.customTitle,
  };
  const values = {
    moduleCode: event.moduleCode,
    moduleTitle: event.moduleTitle,
    moduleAlias: alias,
    deliveryType: event.deliveryType || "",
    activity: event.activity,
    academic: event.academic || "",
    location: formatLocation(event, preferences),
  };
  return (templates[preferences.titleFormat] || templates.code)
    .replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function descriptionForEvent(event, preferences, payload) {
  return preferences.descriptionOrder
    .filter((key) => preferences.descriptionEnabled[key])
    .map((key) => {
      const meta = DESCRIPTION_FIELDS[key];
      const value = key === "source" ? payload.source : event[meta.field];
      return value ? `${meta.prefix}: ${value}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

export function reminderValue(preferences) {
  if (preferences.reminderMinutes === "custom") return Math.min(10080, Math.max(1, Number(preferences.customReminderMinutes) || 1));
  return Number(preferences.reminderMinutes) || 0;
}

export function validatePreferences(preferences) {
  new Intl.DateTimeFormat("en-GB", { timeZone: preferences.timezone });
  if (!preferences.weekOneMonday) throw new Error("Set Week One Monday in Schedule settings to place events on the calendar.");
  if (!isMondayDate(preferences.weekOneMonday)) throw new Error("Week One Monday must be a valid Monday date.");
  if (!preferences.calendarName.trim()) throw new Error("Calendar Name cannot be empty.");
  if (preferences.titleFormat === "custom" && !preferences.customTitle.trim()) throw new Error("Custom Title Template cannot be empty.");
  if (preferences.semesterStart && preferences.semesterEnd && preferences.semesterStart > preferences.semesterEnd) throw new Error("Semester Start must be before Semester End.");
  if (preferences.readingWeek && (Number(preferences.readingWeek) < 1 || Number(preferences.readingWeek) > 53)) throw new Error("Reading Week must be between 1 and 53.");
  parseWeekSelection(preferences.includeWeeks);
  parseWeekSelection(preferences.excludeWeeks);
}
