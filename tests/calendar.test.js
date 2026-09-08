import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildOutputs } from "../js/calendar.js";
import { buildOccurrences, findDiagnostics } from "../js/diagnostics.js";
import { defaultPreferences, getEffectiveEvents } from "../js/preferences.js";
import { validatePayload } from "../js/timetable.js";

const source = JSON.parse(await readFile(new URL("../timetable.sample.json", import.meta.url), "utf8"));

function setup() {
  const payload = validatePayload(structuredClone(source));
  const preferences = defaultPreferences(payload);
  const entries = getEffectiveEvents(payload, preferences);
  return { payload, preferences, entries };
}

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
