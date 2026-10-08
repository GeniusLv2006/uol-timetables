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
Applying a profile carries style choices such as titles, aliases, reminders,
filters, and splitting, but keeps the loaded semester's Week One, semester bounds,
included and excluded weeks, reading week, calendar name, and description.

Editing the JSON keeps your settings: within the same semester everything is kept
and default semester bounds follow the new teaching weeks, while data for a
different academic year, semester, or Week One keeps style choices but takes its
own semester settings. Changing Week One moves the semester bounds with it. If the loaded data has no
Week One and none is known for its academic year and semester, the data still
loads and the Schedule settings ask for it.

## Project structure

- `timetable.sample.json` — fictional public-safe data used by the sample loader and tests.
- `timetable.semester*.json` and `timetable.semester*.ics` — optional personal files,
  deliberately ignored by Git and excluded from deployment.
- `index.html` — semantic page structure and static form controls.
- `assets/icon.svg` — scalable site mark and browser favicon.
- `styles.css` — shared layout, typography, colour, and component styles.
- `styles/studio.css` — Personalisation Studio tabs, panels, and responsive rules.
- `js/main.js` — application state and event orchestration.
- `js/constants.js` — known Week One dates, weekday offsets, and description fields.
- `js/timetable.js` — JSON parsing, validation, and week arithmetic.
- `js/preferences.js` and `js/profiles.js` — export preferences and saved profiles.
- `js/calendar.js` — RFC 5545 generation, recurrence, alarms, and split outputs.
- `js/timezone.js` — `VTIMEZONE` rules generated from the browser's timezone data.
- `js/ui.js` and `js/dom.js` — rendering and DOM references.
- `js/bookmarklet.js` — self-contained clipboard extractor and bookmarklet builder.
- `js/diagnostics.js` — duplicate and timetable clash detection.
- `js/privacy.js` — analytics opt-out dialog and preference cookie.
- `js/contact.js` — contact address revealed only on request.
- `tests/calendar.test.js` — calendar, preference, and diagnostics regression tests.
- `tests/converter.test.js` — checks the Python converter matches the web app's default export.
- `tests/deployment.test.js` and `tests/contact.test.js` — security headers, privacy, and contact checks.
- `convert_to_ical.py` — command-line converter matching the web app's default settings.
- `scripts/build.mjs` — creates `dist/` from an explicit public-file allowlist.
- `_headers` — security and cache headers applied to static assets.
- `wrangler.jsonc` — Cloudflare Workers Static Assets configuration.
- `.github/workflows/ci.yml` — runs `npm run check` on pushes to `main` and on pull requests.

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

The tests use Node.js 24 (see `.nvmrc`). The Python parity tests run when
`python3` is available and are skipped otherwise.

## Deploy with Cloudflare Workers

The production bundle is served by Workers Static Assets without a Worker script,
API, server-side runtime, or environment secrets. Production deploys automatically
through Cloudflare Workers Builds whenever `main` is pushed, so changes should go
through a pull request. `npm run deploy` deploys from a local checkout and is only
needed as a manual fallback.

Workers Builds is configured with:

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

The footer privacy control stores `uol_timetable_analytics=disabled` when a visitor
opts out. In the Cloudflare dashboard, pair it with a Configuration Rule that sets
**Disable Real User Monitoring (RUM)** when the request cookie contains that value.
The rule is required because automatic beacon injection happens at Cloudflare's edge,
before the site's JavaScript runs.

## Command-line converter

```bash
python3 convert_to_ical.py timetable.semester1.json timetable.semester1.ics
```

The script needs only the Python standard library and produces the same file as
the web app's default settings. Unlike the web app, it does not look up known
Week One dates, so the JSON must include `weekOneMonday`. It supports only
`Europe/London`; use the web app for other timezones.

## Week One dates

Teaching week numbers such as `S1 03` are turned into dates by counting whole
weeks from the semester's first teaching Monday. Known dates live in
`KNOWN_WEEK_ONE_DATES` in `js/constants.js`, keyed by `academicYear:semester`,
and are taken from the University's [term dates](https://www.liverpool.ac.uk/term-dates/).
The bookmarklet and the web app both read this table, so a new academic year
needs only one entry there.

| Academic year | Semester | Week One |
| --- | --- | --- |
| 2026/27 | 1 | 28 September 2026 |
| 2027/28 | 1 | 27 September 2027 |

Semester 2 dates are not listed yet. Its teaching is split by a three-week Easter
break, and until a real Semester 2 timetable confirms whether `S2` week numbers
count the break weeks, the converter cannot be sure that counting whole weeks
gives the right dates. Without a listed date, set Week One in the Schedule settings
and check the dates of sessions after the Easter break.

## JSON schema

The top-level object contains:

- `schemaVersion` — currently `1`.
- `academicYear` (for example `2026/27`) and `semester` (`1` or `2`).
- `weekOneMonday` — the first teaching Monday as `YYYY-MM-DD`. Optional when a
  known date exists for the academic year and semester.
- `timezone` — an IANA timezone name; defaults to `Europe/London`.
- `calendarName`, `source` (the timetable page URL), and `generatedAt` (an ISO
  timestamp used as the calendar's `DTSTAMP`).
- `events` — the non-empty list of timetable patterns described below.

Each item in `events` contains:

- `day`, `start`, `end`, `durationMinutes`
- `moduleCode`, `moduleTitle`, `moduleUrl`
- `deliveryType`, `activity`, `academic`, `location`
- `teachingWeeks` (for example `S1 01-S1 08, S1 10-S1 12` or `S1 01, S1 03, S1 05`)

Text fields must be strings: `moduleCode`, `moduleTitle`, `activity`, and
`teachingWeeks` are required, and `deliveryType`, `academic`, `location`, and
`moduleUrl` may be `null`. `moduleUrl`, when present, must be an `https://` link
without spaces or control characters. Line breaks in text are exported as
escaped newlines, and other control characters are removed.

The source page is server-rendered rather than backed by an exposed JSON payload.
Times are encoded spatially: the grid begins at 08:00, each logical column is 30
minutes, and a course cell's `colspan` is its duration. `js/bookmarklet.js`
turns that layout into the JSON fields above.
