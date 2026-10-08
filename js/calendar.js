import { contiguousRanges, dateForWeek, localStamp } from "./timetable.js";
import { canonicalTimezone, timezoneComponent } from "./timezone.js";
import { descriptionForEvent, formatLocation, reminderValue, titleForEvent } from "./preferences.js";

// Line breaks become escaped newlines and other control characters are dropped,
// so no text value can end its content line early.
function escapeIcal(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(content, limit = 75) {
  const encoder = new TextEncoder();
  const pieces = [];
  let current = "";
  let byteLength = 0;
  for (const character of content) {
    const size = encoder.encode(character).length;
    if (current && byteLength + size > limit) {
      pieces.push(current);
      current = ` ${character}`;
      byteLength = 1 + size;
    } else {
      current += character;
      byteLength += size;
    }
  }
  pieces.push(current);
  return pieces;
}

function addLine(lines, name, value) {
  lines.push(...foldLine(`${name}:${value}`));
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function calendarHeader(name, preferences, yearRange) {
  const timezone = canonicalTimezone(preferences.timezone);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UoL Timetable Converter//UoL JSON to iCalendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  addLine(lines, "X-WR-CALNAME", escapeIcal(name));
  addLine(lines, "X-WR-CALDESC", escapeIcal(preferences.calendarDescription));
  addLine(lines, "X-WR-TIMEZONE", timezone);
  addLine(lines, "X-APPLE-CALENDAR-COLOR", preferences.calendarColor.toUpperCase());
  lines.push(...timezoneComponent(timezone, yearRange.first, yearRange.last));
  return lines;
}

function addEventComponent(lines, payload, preferences, event, startWeek, endWeek, dtstamp) {
  const date = dateForWeek(preferences.weekOneMonday, startWeek, event.day);
  const count = endWeek - startWeek + 1;
  const timezone = canonicalTimezone(preferences.timezone);
  const uidInput = [event.activity, event.day, event.start, startWeek, endWeek, preferences.weekOneMonday].join("|");
  lines.push("BEGIN:VEVENT");
  addLine(lines, "UID", `${stableHash(uidInput)}@timetables.xjtlu.uk`);
  addLine(lines, "DTSTAMP", dtstamp);
  addLine(lines, `DTSTART;TZID=${timezone}`, localStamp(date, event.start));
  addLine(lines, `DTEND;TZID=${timezone}`, localStamp(date, event.end));
  if (preferences.recurrenceMode === "recurring" && count > 1) addLine(lines, "RRULE", `FREQ=WEEKLY;COUNT=${count}`);
  addLine(lines, "SUMMARY", escapeIcal(titleForEvent(event, preferences)));
  addLine(lines, "LOCATION", escapeIcal(formatLocation(event, preferences)));
  addLine(lines, "DESCRIPTION", escapeIcal(descriptionForEvent(event, preferences, payload)));
  if (event.moduleUrl) addLine(lines, "URL", event.moduleUrl);
  addLine(lines, "CATEGORIES", escapeIcal(event.moduleCode));
  addLine(lines, "X-UOL-ACTIVITY", escapeIcal(event.activity));
  addLine(lines, "X-UOL-TEACHING-WEEK", startWeek);
  const reminder = reminderValue(preferences);
  if (reminder > 0) {
    lines.push("BEGIN:VALARM");
    addLine(lines, "TRIGGER", `-PT${reminder}M`);
    addLine(lines, "ACTION", "DISPLAY");
    addLine(lines, "DESCRIPTION", escapeIcal(titleForEvent(event, preferences)));
    lines.push("END:VALARM");
  }
  lines.push("END:VEVENT");
}

function createCalendar(payload, preferences, entries, name) {
  const generated = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
  const validGenerated = Number.isNaN(generated.valueOf()) ? new Date() : generated;
  const dtstamp = validGenerated.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const years = entries.flatMap(({ event, weeks }) => weeks.map((week) => dateForWeek(preferences.weekOneMonday, week, event.day).getUTCFullYear()));
  const lines = calendarHeader(name, preferences, { first: Math.min(...years), last: Math.max(...years) });
  for (const { event, weeks } of entries) {
    if (preferences.recurrenceMode === "individual") {
      for (const week of weeks) addEventComponent(lines, payload, preferences, event, week, week, dtstamp);
    } else {
      for (const range of contiguousRanges(weeks)) addEventComponent(lines, payload, preferences, event, range.start, range.end, dtstamp);
    }
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "calendar";
}

export function buildOutputs(payload, preferences, entries) {
  if (!entries.length) return [];
  const baseFile = (preferences.fileName || "timetable.ics").replace(/\.ics$/i, "");
  let groups;
  if (preferences.splitMode === "module") {
    groups = [...new Set(entries.map(({ event }) => event.moduleCode))].sort().map((key) => ({ key, entries: entries.filter(({ event }) => event.moduleCode === key) }));
  } else if (preferences.splitMode === "type") {
    groups = [...new Set(entries.map(({ event }) => event.deliveryType || "Not Specified"))].sort().map((key) => ({ key, entries: entries.filter(({ event }) => (event.deliveryType || "Not Specified") === key) }));
  } else {
    groups = [{ key: "", entries }];
  }
  return groups.map((group) => {
    const suffix = group.key ? `-${safeFilePart(group.key)}` : "";
    const name = group.key ? `${preferences.calendarName} · ${group.key}` : preferences.calendarName;
    const sessions = group.entries.reduce((total, entry) => total + entry.weeks.length, 0);
    return {
      name,
      filename: `${baseFile}${suffix}.ics`,
      sessions,
      ical: createCalendar(payload, preferences, group.entries, name),
    };
  });
}
