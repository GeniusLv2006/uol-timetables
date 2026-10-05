import { DAY_OFFSETS, KNOWN_WEEK_ONE_DATES } from "./constants.js";

export function parseWeekRanges(value) {
  const tokens = String(value).split(",").map((token) => token.trim()).filter(Boolean);
  const tokenPattern = /^S\d+\s+(\d{1,2})(?:\s*-\s*S\d+\s+(\d{1,2}))?$/i;
  if (!tokens.length || tokens.some((token) => !tokenPattern.test(token))) {
    throw new Error(`Cannot parse teachingWeeks: “${value}”.`);
  }
  return tokens.map((token) => {
    const match = token.match(tokenPattern);
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start) throw new Error(`Invalid week range: “${value}”.`);
    return { start, end };
  });
}

export function parseWeekSelection(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const weeks = new Set();
  for (const part of trimmed.split(",")) {
    const token = part.trim();
    const range = token.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    const single = token.match(/^\d{1,2}$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > 53) throw new Error(`Invalid week selection: “${token}”.`);
      for (let week = start; week <= end; week += 1) weeks.add(week);
    } else if (single) {
      const week = Number(token);
      if (week < 1 || week > 53) throw new Error(`Invalid week selection: “${token}”.`);
      weeks.add(week);
    } else {
      throw new Error(`Invalid week selection: “${token}”.`);
    }
  }
  return weeks;
}

export function sourceWeeks(event) {
  const weeks = [];
  for (const { start, end } of parseWeekRanges(event.teachingWeeks)) {
    for (let week = start; week <= end; week += 1) weeks.push(week);
  }
  return [...new Set(weeks)].sort((a, b) => a - b);
}

export function contiguousRanges(weeks) {
  if (!weeks.length) return [];
  const ranges = [];
  let start = weeks[0];
  let previous = weeks[0];
  for (const week of weeks.slice(1)) {
    if (week !== previous + 1) {
      ranges.push({ start, end: previous });
      start = week;
    }
    previous = week;
  }
  ranges.push({ start, end: previous });
  return ranges;
}

export function dateForWeek(weekOneMonday, week, dayCode) {
  const date = new Date(`${weekOneMonday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7 + DAY_OFFSETS[dayCode]);
  return date;
}

export function compactDate(date) {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
}

export function localStamp(date, time) {
  return `${compactDate(date)}T${time.replace(":", "")}00`;
}

export function longDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function minutesFromTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validatePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The JSON root must be an object.");
  const payload = { ...input };
  if (!Array.isArray(payload.events) || !payload.events.length) throw new Error("The JSON must contain a non-empty events array.");
  // Without a known Week One the data still loads; the Schedule settings ask for it.
  if (!payload.weekOneMonday) payload.weekOneMonday = KNOWN_WEEK_ONE_DATES[`${payload.academicYear}:${payload.semester}`] || "";
  if (payload.weekOneMonday) {
    const weekOne = new Date(`${payload.weekOneMonday}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.weekOneMonday) || Number.isNaN(weekOne.valueOf()) || weekOne.getUTCDay() !== 1) {
      throw new Error("weekOneMonday must be a valid Monday date (YYYY-MM-DD).");
    }
  }
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: payload.timezone || "Europe/London" });
  } catch {
    throw new Error(`Unknown timezone: “${payload.timezone}”.`);
  }
  payload.timezone ||= "Europe/London";
  payload.calendarName ||= "University of Liverpool Timetable";
  payload.events.forEach((event, index) => {
    const prefix = `Event ${index + 1}`;
    if (!event || typeof event !== "object") throw new Error(`${prefix} must be an object.`);
    if (!Object.hasOwn(DAY_OFFSETS, event.day)) throw new Error(`${prefix} has an invalid day.`);
    if (!isTime(event.start) || !isTime(event.end)) throw new Error(`${prefix} has an invalid start or end time.`);
    if (minutesFromTime(event.end) <= minutesFromTime(event.start)) throw new Error(`${prefix} must end after it starts.`);
    if (!event.moduleCode || !event.moduleTitle || !event.activity) throw new Error(`${prefix} is missing moduleCode, moduleTitle, or activity.`);
    parseWeekRanges(event.teachingWeeks);
  });
  return payload;
}
