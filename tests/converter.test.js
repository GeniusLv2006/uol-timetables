import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildOutputs } from "../js/calendar.js";
import { defaultPreferences, getEffectiveEvents } from "../js/preferences.js";
import { validatePayload } from "../js/timetable.js";

const run = promisify(execFile);
const script = fileURLToPath(new URL("../convert_to_ical.py", import.meta.url));
const source = JSON.parse(await readFile(new URL("../timetable.sample.json", import.meta.url), "utf8"));
const hasPython = await run("python3", ["--version"]).then(() => true, () => false);

async function convertWithPython(payload) {
  const directory = await mkdtemp(join(tmpdir(), "uol-timetable-"));
  try {
    const input = join(directory, "timetable.json");
    const output = join(directory, "timetable.ics");
    await writeFile(input, JSON.stringify(payload));
    await run("python3", [script, input, output]);
    return await readFile(output, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function convertWithBrowserCode(payload) {
  const validated = validatePayload(structuredClone(payload));
  const preferences = defaultPreferences(validated);
  return buildOutputs(validated, preferences, getEffectiveEvents(validated, preferences))[0].ical;
}

test("Python converter matches the web app's default export", { skip: !hasPython && "python3 is not installed" }, async () => {
  const payload = structuredClone(source);
  payload.events[0].teachingWeeks = "S1 01, S1 02, S1 03-S1 08, S1 10";
  payload.events[0].location = "Central Teaching Hub, Room 1; Floor 2";
  payload.events[1].academic = "Dr Zoë Ångström 高级讲师 ".repeat(3).trim();
  payload.events[2].moduleUrl = "https://tulip.liv.ac.uk/mods/student/DEMO202_202627.htm";
  assert.equal(await convertWithPython(payload), convertWithBrowserCode(payload));
});

test("Python converter refuses timezones it cannot describe", { skip: !hasPython && "python3 is not installed" }, async () => {
  const payload = { ...structuredClone(source), timezone: "Asia/Shanghai" };
  await assert.rejects(convertWithPython(payload), /only supports Europe\/London/);
});
