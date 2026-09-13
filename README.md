# UoL Timetable Converter

UoL Timetable Converter is a private, browser-only interface for extracting a University
of Liverpool semester timetable, importing or pasting its structured JSON, and
exporting a timezone-aware iCalendar file. It also includes a dependency-free
Python converter for command-line use.

## Install and run locally

```bash
npm install
npm run dev
```

Wrangler prints the local preview URL. The interface includes an installable bookmarklet
that copies extracted JSON to the clipboard, one-click clipboard paste, JSON
drag-and-drop, live validation and preview, and `.ics` download. If clipboard access
is unavailable, the bookmarklet falls back to downloading a JSON file. Timetable
data never leaves the browser.

## Personalisation Studio

Once valid JSON is loaded, the interface reveals four focused configuration views
instead of one long settings form:

- **Naming** — title presets and custom token templates, module aliases, calendar
  name, file name, description, and suggested colour.
- **Details** — ordered description fields, reminders, location formats, and
  location aliases.
- **Schedule** — editable week-one anchor, timezone and semester bounds, included
  or excluded teaching weeks, reading week, and recurring or individual events.
- **Delivery** — filters for teaching types and individual activities, plus combined,
  per-module, or per-activity-type calendar output.

The output panel updates immediately, detects duplicate or overlapping sessions,
and lists every generated calendar when split export is enabled. Export preferences
can be saved as named profiles in browser-local storage; timetable JSON is not saved.

## Project structure

- `timetable.sample.json` — fictional public-safe data used by the sample loader and tests.
- `timetable.semester*.json` and `timetable.semester*.ics` — optional personal files,
  deliberately ignored by Git and excluded from deployment.
- `index.html` — semantic page structure and static form controls.
- `assets/icon.svg` — scalable site mark and browser favicon.
- `styles.css` — shared layout, typography, colour, and component styles.
- `styles/studio.css` — Personalisation Studio tabs, panels, and responsive rules.
- `js/main.js` — application state and event orchestration.
- `js/timetable.js` — JSON parsing, validation, and normalisation.
- `js/preferences.js` and `js/profiles.js` — export preferences and saved profiles.
- `js/calendar.js` — RFC 5545 generation, recurrence, alarms, and split outputs.
- `js/ui.js` and `js/dom.js` — rendering and DOM references.
- `js/bookmarklet.js` — self-contained clipboard extractor and bookmarklet builder.
- `js/diagnostics.js` — duplicate and timetable clash detection.
- `tests/calendar.test.js` — converter and diagnostics regression tests.
- `convert_to_ical.py` — converts the JSON schema to RFC 5545 iCalendar.
- `extract_timetable.js` — reusable browser-side extractor for the semester grid.
- `scripts/build.mjs` — creates `dist/` from an explicit public-file allowlist.
- `_headers` — security and cache headers applied to static assets.
- `wrangler.jsonc` — Cloudflare Workers Static Assets configuration.

The browser application remains dependency-free. The build step only copies approved
public assets; it does not bundle application code or include personal timetable files.

## Run the tests

```bash
npm test
```

Run the complete test, build, and Cloudflare dry-run verification with:

```bash
npm run check
```

## Deploy with Cloudflare Workers

The production bundle is served by Workers Static Assets without a Worker script,
API, server-side runtime, or environment secrets.

```bash
npm run deploy
```

For Cloudflare Workers Builds, connect this repository and configure:

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Every build starts from an empty `dist/` and copies only `index.html`, the stylesheet
and JavaScript directories, the icon, the fictional sample, and `_headers`.

The Content Security Policy permits both the unversioned and version-suffixed paths used
by Cloudflare's automatically injected Web Analytics beacon from
`static.cloudflareinsights.com`. Its reports use the same-origin `/cdn-cgi/rum`
endpoint; no broad third-party connection permission is enabled. Do not add
`no-transform` to `Cache-Control`, because that prevents automatic beacon injection.

## Rebuild the calendar

```bash
python3 convert_to_ical.py timetable.semester1.json timetable.semester1.ics
```

The calendar uses `Europe/London`, so classes stay at the correct Liverpool local
time when British Summer Time ends. Semester 1 week 1 is anchored to Monday,
28 September 2026, matching the University's published 2026/27 term dates.

## JSON schema

Each item in `events` contains:

- `day`, `start`, `end`, `durationMinutes`
- `moduleCode`, `moduleTitle`, `moduleUrl`
- `deliveryType`, `activity`, `academic`, `location`
- `teachingWeeks` (for example `S1 01-S1 08, S1 10-S1 12` or `S1 01, S1 03, S1 05`)

The source page is server-rendered rather than backed by an exposed JSON payload.
Times are encoded spatially: the grid begins at 08:00, each logical column is 30
minutes, and a course cell's `colspan` is its duration. `extract_timetable.js`
turns that layout into the JSON fields above.
