import { compactDate } from "./timetable.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const formatters = new Map();
const cache = new Map();

function formatter(timezone, timeZoneName) {
  const key = `${timezone}|${timeZoneName}`;
  if (!formatters.has(key)) {
    const locale = timeZoneName === "short" ? "en-GB" : "en-US";
    formatters.set(key, new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName }));
  }
  return formatters.get(key);
}

function zoneName(timezone, instant, style) {
  return formatter(timezone, style).formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value || "";
}

// Normalises user input such as "europe/london" to the IANA name ("Europe/London").
export function canonicalTimezone(timezone) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions().timeZone;
}

export function offsetMinutes(timezone, instant) {
  const match = zoneName(timezone, instant, "longOffset").match(/^(?:GMT|UTC)(?:([+-])(\d{1,2})(?::?(\d{2}))?)?$/);
  if (!match?.[1]) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}${String(absolute % 60).padStart(2, "0")}`;
}

function wallStamp(instant, offset) {
  const local = new Date(instant + offset * MINUTE);
  const time = [local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds()].map((part) => String(part).padStart(2, "0")).join("");
  return `${compactDate(local)}T${time}`;
}

function standardOffset(timezone, year) {
  return Math.min(offsetMinutes(timezone, Date.UTC(year, 0, 1)), offsetMinutes(timezone, Date.UTC(year, 6, 1)));
}

function observance(timezone, instant, from, to) {
  const kind = to > standardOffset(timezone, new Date(instant).getUTCFullYear()) ? "DAYLIGHT" : "STANDARD";
  return [
    `BEGIN:${kind}`,
    `TZOFFSETFROM:${formatOffset(from)}`,
    `TZOFFSETTO:${formatOffset(to)}`,
    `TZNAME:${zoneName(timezone, instant, "short")}`,
    `DTSTART:${wallStamp(instant, from)}`,
    `END:${kind}`,
  ];
}

function findTransition(timezone, before, after, previousOffset) {
  let low = before / MINUTE;
  let high = after / MINUTE;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (offsetMinutes(timezone, middle * MINUTE) === previousOffset) low = middle;
    else high = middle;
  }
  return high * MINUTE;
}

// Builds a VTIMEZONE from the runtime's IANA data, listing every offset change
// between the start of firstYear and the end of lastYear.
export function timezoneComponent(timezone, firstYear, lastYear) {
  const key = `${timezone}|${firstYear}|${lastYear}`;
  if (cache.has(key)) return cache.get(key);
  const newYear = Date.UTC(firstYear, 0, 1);
  const start = newYear - offsetMinutes(timezone, newYear) * MINUTE;
  const end = Date.UTC(lastYear + 1, 0, 1);
  let previous = offsetMinutes(timezone, start);
  const lines = ["BEGIN:VTIMEZONE", `TZID:${timezone}`, `X-LIC-LOCATION:${timezone}`, ...observance(timezone, start, previous, previous)];
  for (let instant = start; instant < end; instant += DAY) {
    const next = offsetMinutes(timezone, instant + DAY);
    if (next === previous) continue;
    const transition = findTransition(timezone, instant, instant + DAY, previous);
    lines.push(...observance(timezone, transition, previous, next));
    previous = next;
  }
  lines.push("END:VTIMEZONE");
  cache.set(key, lines);
  return lines;
}
