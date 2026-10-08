import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildOutputs } from "../js/calendar.js";
import { buildOccurrences, findDiagnostics } from "../js/diagnostics.js";
import { bookmarkletCode } from "../js/bookmarklet.js";
import { KNOWN_WEEK_ONE_DATES } from "../js/constants.js";
import {
  adoptPayload,
  changeWeekOne,
  defaultPreferences,
  getEffectiveEvents,
  mergePreferences,
  payloadInventory,
  reconcilePreferences,
  validatePreferences,
} from "../js/preferences.js";
import { parseWeekRanges, validatePayload } from "../js/timetable.js";
import { offsetMinutes } from "../js/timezone.js";

const source = JSON.parse(await readFile(new URL("../timetable.sample.json", import.meta.url), "utf8"));

function unfold(ical) {
  return ical.replace(/\r\n /g, "");
}

function timezoneBlock(ical) {
  return ical.match(/BEGIN:VTIMEZONE\r\n[\s\S]*?END:VTIMEZONE/)[0];
}

function setup() {
  const payload = validatePayload(structuredClone(source));
  const preferences = defaultPreferences(payload);
  const entries = getEffectiveEvents(payload, preferences);
  return { payload, preferences, entries };
}

test("teaching weeks support discrete weeks and mixed ranges", () => {
  assert.deepEqual(parseWeekRanges("S1 01, S1 03, S1 05, S1 07"), [
    { start: 1, end: 1 },
    { start: 3, end: 3 },
    { start: 5, end: 5 },
    { start: 7, end: 7 },
  ]);
  assert.deepEqual(parseWeekRanges("S1 01-S1 08, S1 10, S1 12-S1 13"), [
    { start: 1, end: 8 },
    { start: 10, end: 10 },
    { start: 12, end: 13 },
  ]);
});

test("payload validation rejects omitted weekdays in imported data", () => {
  const payload = structuredClone(source);
  payload.events[0].day = "";
  assert.throws(() => validatePayload(payload), /Event 1 has an invalid day/);
});

test("default export preserves all source sessions", () => {
  const { payload, preferences, entries } = setup();
  assert.equal(preferences.titleFormat, "code");
  const outputs = buildOutputs(payload, preferences, entries);
  assert.equal(entries.length, 4);
  assert.equal(buildOccurrences(entries, preferences).length, 11);
  assert.equal(outputs.length, 1);
  assert.equal((outputs[0].ical.match(/BEGIN:VEVENT/g) || []).length, 5);
  assert.match(outputs[0].ical, /PRODID:-\/\/UoL Timetable Converter\/\/UoL JSON to iCalendar\/\/EN/);
  assert.match(outputs[0].ical, /TZID:Europe\/London/);
  assert.match(outputs[0].ical, /SUMMARY:DEMO101\r?\n/);
  for (const line of outputs[0].ical.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line exceeds 75 octets: ${line}`);
  }
});

test("default export keeps module URLs in the standard URL property only", () => {
  const { payload, preferences, entries } = setup();
  payload.events[0].moduleUrl = "https://tulip.liv.ac.uk/mods/student/COMP211_202627.htm";
  const output = buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical;
  assert.equal((output.match(/https:\/\/tulip\.liv\.ac\.uk\/mods\/student\/COMP211_202627\.htm/g) || []).length, 1);
  assert.match(output, /URL:https:\/\/tulip\.liv\.ac\.uk\/mods\/student\/COMP211_202627\.htm\r?\n/);
  assert.doesNotMatch(output, /Module: https:\/\/tulip\.liv\.ac\.uk/);
});

test("title, reminder, recurrence, filters, and split settings affect output", () => {
  const { payload, preferences } = setup();
  preferences.titleFormat = "code";
  preferences.reminderMinutes = "10";
  preferences.recurrenceMode = "individual";
  preferences.splitMode = "module";
  preferences.includeWeeks = "1-2";
  const entries = getEffectiveEvents(payload, preferences);
  const outputs = buildOutputs(payload, preferences, entries);
  assert.equal(outputs.length, 3);
  assert.equal(outputs.reduce((total, output) => total + (output.ical.match(/BEGIN:VEVENT/g) || []).length, 0), 7);
  assert.match(outputs.map((output) => output.ical).join("\n"), /SUMMARY:DEMO101\r?\n/);
  assert.match(outputs.map((output) => output.ical).join("\n"), /TRIGGER:-PT10M/);
});

test("diagnostics detect overlapping activities", () => {
  const { payload, preferences, entries } = setup();
  const duplicate = { event: { ...entries[0].event, activity: "TEST/OVERLAP", moduleCode: "TEST999" }, weeks: entries[0].weeks };
  const issues = findDiagnostics([...entries, duplicate], preferences);
  assert.ok(issues.some((issue) => issue.startsWith("Overlap:")));
});

test("London export encodes the autumn clock change for recurrences that cross it", () => {
  const payload = validatePayload(structuredClone(source));
  payload.events[0].teachingWeeks = "S1 01-S1 08";
  const preferences = defaultPreferences(payload);
  const ical = buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical;
  const zone = timezoneBlock(ical);
  assert.match(zone, /BEGIN:STANDARD\r\nTZOFFSETFROM:\+0100\r\nTZOFFSETTO:\+0000\r\nTZNAME:GMT\r\nDTSTART:20261025T020000\r\nEND:STANDARD/);
  assert.match(zone, /BEGIN:DAYLIGHT\r\nTZOFFSETFROM:\+0000\r\nTZOFFSETTO:\+0100\r\nTZNAME:BST\r\nDTSTART:20260329T010000\r\nEND:DAYLIGHT/);
  assert.match(ical, /DTSTART;TZID=Europe\/London:20260928T\d{6}\r\nDTEND;TZID=Europe\/London:20260928T\d{6}\r\nRRULE:FREQ=WEEKLY;COUNT=8/);
  assert.equal(offsetMinutes("Europe/London", Date.UTC(2026, 9, 25, 0, 59)), 60);
  assert.equal(offsetMinutes("Europe/London", Date.UTC(2026, 9, 25, 1, 0)), 0);
});

test("non-London timezones get their own rules instead of UK daylight saving", () => {
  const { payload, preferences } = setup();
  preferences.timezone = "Asia/Shanghai";
  const zone = timezoneBlock(buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical);
  assert.match(zone, /TZID:Asia\/Shanghai/);
  assert.match(zone, /TZOFFSETTO:\+0800/);
  assert.doesNotMatch(zone, /BST|DAYLIGHT|\+0100/);

  preferences.timezone = "America/New_York";
  const newYork = timezoneBlock(buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical);
  assert.match(newYork, /TZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nTZNAME:[^\r]+\r\nDTSTART:20261101T020000/);
});

test("folding keeps multi-byte characters intact and within 75 octets", () => {
  const { payload, preferences } = setup();
  const title = "高级算法与数据结构 · Ångström lab 🧪 ".repeat(4).trim();
  payload.events[0].moduleTitle = title;
  preferences.titleFormat = "name";
  const ical = buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical;
  for (const line of ical.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line exceeds 75 octets: ${line}`);
    assert.doesNotMatch(line, /\uFFFD/);
  }
  assert.ok(ical.split("\r\n").some((line) => line.startsWith(" ")), "expected the long title to be folded");
  assert.ok(unfold(ical).includes(`SUMMARY:${title}\r\n`));
});

test("text values escape iCalendar special characters", () => {
  const { payload, preferences } = setup();
  payload.events[0].location = "Hall, Room 1; Floor \\2\nAnnex";
  const ical = unfold(buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical);
  assert.ok(ical.includes("LOCATION:Hall\\, Room 1\\; Floor \\\\2\\nAnnex\r\n"));
});

test("text values cannot start new content lines", () => {
  const { payload, preferences } = setup();
  payload.events[0].location = "Hall\rATTENDEE:mailto:a@example.com\r\nAnnex\u0000\u000b\u0085";
  const ical = unfold(buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical);
  assert.ok(ical.includes("LOCATION:Hall\\nATTENDEE:mailto:a@example.com\\nAnnex\r\n"));
  assert.doesNotMatch(ical.replace(/\r\n/g, ""), /[\r\n\u0000\u000b\u0085]/);
});

test("editing data keeps customisations and includes newly introduced values", () => {
  const { payload, preferences } = setup();
  preferences.moduleAliases.DEMO101 = "Intro";
  preferences.includedDeliveryTypes = preferences.includedDeliveryTypes.filter((type) => type !== "ONLINE SEMINAR");
  const edited = structuredClone(payload);
  edited.events[1].deliveryType = "ON CAMPUS TUTORIAL";
  edited.events[2].location = "New Teaching Hub";
  const reconciled = reconcilePreferences(preferences, payloadInventory(payload), edited);
  assert.equal(reconciled.moduleAliases.DEMO101, "Intro");
  assert.ok("New Teaching Hub" in reconciled.locationAliases);
  assert.ok(!("Sample Teaching Centre" in reconciled.locationAliases));
  assert.ok(reconciled.includedDeliveryTypes.includes("ON CAMPUS TUTORIAL"));
  assert.ok(!reconciled.includedDeliveryTypes.includes("ONLINE SEMINAR"));
  const activities = getEffectiveEvents(edited, reconciled).map(({ event }) => event.activity);
  assert.ok(activities.includes("DEMO101/WORK/A/01"));
});

function sessionCount(payload, preferences) {
  return getEffectiveEvents(payload, preferences).reduce((total, entry) => total + entry.weeks.length, 0);
}

test("applying a saved profile keeps the loaded semester's dates and week rules", () => {
  const { payload, preferences: profile } = setup();
  profile.titleFormat = "code-name";
  profile.readingWeek = "2";
  profile.excludeWeeks = "3";
  const semesterTwo = validatePayload({ ...structuredClone(source), semester: 2, weekOneMonday: "2027-02-01", calendarName: "Semester 2" });
  const current = defaultPreferences(semesterTwo);
  const applied = mergePreferences(profile, semesterTwo, current);
  assert.equal(applied.titleFormat, "code-name");
  for (const field of ["weekOneMonday", "semesterStart", "semesterEnd", "readingWeek", "excludeWeeks", "calendarName"]) {
    assert.equal(applied[field], current[field], field);
  }
  const ical = buildOutputs(semesterTwo, applied, getEffectiveEvents(semesterTwo, applied))[0].ical;
  assert.match(ical, /DTSTART;TZID=Europe\/London:20270201T/);
  assert.doesNotMatch(ical, /DTSTART;TZID=Europe\/London:2026/);
  assert.equal(payload.weekOneMonday, "2026-09-28");
});

test("moving Week One shifts the semester bounds instead of dropping sessions", () => {
  const { payload, preferences } = setup();
  const moved = changeWeekOne(preferences, "2026-10-05");
  assert.equal(moved.semesterStart, "2026-10-05");
  assert.equal(moved.semesterEnd, "2026-10-28");
  assert.equal(sessionCount(payload, moved), sessionCount(payload, preferences));
  assert.equal(preferences.weekOneMonday, "2026-09-28");
});

test("data without a known Week One loads and asks for it in Schedule settings", () => {
  const payload = validatePayload({ ...structuredClone(source), semester: 2, weekOneMonday: "" });
  assert.equal(payload.weekOneMonday, "");
  const preferences = defaultPreferences(payload);
  assert.equal(preferences.semesterStart, "");
  assert.throws(() => validatePreferences(preferences), /Set Week One Monday in Schedule settings/);
  const chosen = changeWeekOne(preferences, "2027-02-01");
  assert.doesNotThrow(() => validatePreferences(chosen));
  assert.equal(sessionCount(payload, chosen), 11);
  assert.throws(() => validatePayload({ ...structuredClone(source), weekOneMonday: "2026-09-29" }), /valid Monday/);
});

test("known Week One dates are inferred and embedded in the bookmarklet", () => {
  const payload = validatePayload({ ...structuredClone(source), academicYear: "2027/28", weekOneMonday: "" });
  assert.equal(payload.weekOneMonday, "2027-09-27");
  assert.ok(bookmarkletCode.endsWith(`)(${JSON.stringify(KNOWN_WEEK_ONE_DATES)})`));
  assert.doesNotThrow(() => new Function(bookmarkletCode.replace(/^javascript:/, "")));
});

test("payload validation rejects non-object events and inherited day names", () => {
  for (const day of ["constructor", "toString", "__proto__"]) {
    const payload = structuredClone(source);
    payload.events[0].day = day;
    assert.throws(() => validatePayload(payload), /Event 1 has an invalid day/);
  }
  const payload = structuredClone(source);
  payload.events[0] = null;
  assert.throws(() => validatePayload(payload), /Event 1 must be an object/);
});

test("payload validation requires text fields and https module links", () => {
  const invalid = [
    [{ moduleCode: { code: "DEMO101" } }, /missing moduleCode/],
    [{ activity: "   " }, /missing moduleCode/],
    [{ location: 101 }, /not text/],
    [{ moduleUrl: ["https://example.com"] }, /not text/],
    [{ teachingWeeks: ["S1 01"] }, /teachingWeeks that are not text/],
    [{ moduleUrl: "javascript:alert(1)" }, /not an https:\/\/ link/],
    [{ moduleUrl: "http://tulip.liv.ac.uk/mods/student/DEMO101.htm" }, /not an https:\/\/ link/],
    [{ moduleUrl: "https://example.com/\nBEGIN:VALARM" }, /not an https:\/\/ link/],
  ];
  for (const [fields, message] of invalid) {
    const payload = structuredClone(source);
    Object.assign(payload.events[0], fields);
    assert.throws(() => validatePayload(payload), message);
  }
  assert.throws(() => validatePayload({ ...structuredClone(source), calendarName: 42 }), /calendarName must be text/);
  const payload = structuredClone(source);
  Object.assign(payload.events[0], { moduleUrl: "https://tulip.liv.ac.uk/mods/student/DEMO101_202627.htm", academic: null, location: "" });
  assert.doesNotThrow(() => validatePayload(payload));
});

test("activity filters treat repeated activity codes as one choice", () => {
  const payload = structuredClone(source);
  payload.events[1].activity = payload.events[0].activity;
  const preferences = defaultPreferences(validatePayload(payload));
  assert.deepEqual(preferences.includedActivities, [...new Set(preferences.includedActivities)]);
  assert.equal(preferences.includedActivities.length, 3);
});

test("payload validation returns a normalised copy without changing its input", () => {
  const input = { ...structuredClone(source), timezone: "", calendarName: "", weekOneMonday: "" };
  const snapshot = structuredClone(input);
  const payload = validatePayload(input);
  assert.deepEqual(input, snapshot);
  assert.equal(payload.timezone, "Europe/London");
  assert.equal(payload.weekOneMonday, "2026-09-28");
});

test("editing data in the same semester keeps customisations and follows default bounds", () => {
  const { payload, preferences } = setup();
  preferences.titleFormat = "code-name";
  preferences.moduleAliases.DEMO101 = "Intro";
  preferences.readingWeek = "2";
  const edited = validatePayload(structuredClone(source));
  edited.events[0].start = "09:00";
  edited.events[0].teachingWeeks = "S1 01-S1 06";
  const adopted = adoptPayload(preferences, payload, edited);
  assert.equal(adopted.titleFormat, "code-name");
  assert.equal(adopted.moduleAliases.DEMO101, "Intro");
  assert.equal(adopted.readingWeek, "2");
  assert.equal(adopted.semesterEnd, "2026-11-02");
  // 14 source sessions once week 6 is reached, minus the four in reading week 2.
  assert.equal(sessionCount(edited, adopted), 10);

  preferences.semesterEnd = "2026-10-10";
  assert.equal(adoptPayload(preferences, payload, edited).semesterEnd, "2026-10-10");
});

test("loading another semester keeps style choices but takes its own semester fields", () => {
  const { payload, preferences } = setup();
  preferences.titleFormat = "code-name";
  preferences.readingWeek = "2";
  const next = validatePayload({ ...structuredClone(source), academicYear: "2027/28", weekOneMonday: "", calendarName: "Next Year" });
  const adopted = adoptPayload(preferences, payload, next);
  assert.equal(adopted.titleFormat, "code-name");
  assert.equal(adopted.weekOneMonday, "2027-09-27");
  assert.equal(adopted.readingWeek, "");
  assert.equal(adopted.calendarName, "Next Year");
  assert.equal(adopted.semesterStart, "2027-09-27");
});

test("exports use the canonical timezone name and the tool's own UID domain", () => {
  const { payload, preferences } = setup();
  preferences.timezone = "europe/london";
  const ical = buildOutputs(payload, preferences, getEffectiveEvents(payload, preferences))[0].ical;
  assert.doesNotMatch(ical, /europe\/london/);
  assert.match(ical, /X-WR-TIMEZONE:Europe\/London\r\n/);
  assert.match(ical, /DTSTART;TZID=Europe\/London:/);
  assert.match(ical, /UID:[0-9a-f]{8}@timetables\.xjtlu\.uk\r\n/);
  assert.doesNotMatch(ical, /@timetables\.liverpool\.ac\.uk/);
});
