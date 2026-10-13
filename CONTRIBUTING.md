# Contributing

Thank you for helping improve UoL Timetable Converter. Bug reports, fixes, documentation improvements, and new Week One dates are all welcome.

## Before you start

- **Never share a real timetable.** Timetable JSON and `.ics` files contain a personal schedule, staff names, and rooms. Use [`timetable.sample.json`](timetable.sample.json) or made-up data in issues, pull requests, and tests.
- For anything larger than a small fix, please [open an issue](https://github.com/GeniusLv2006/uol-timetables/issues/new/choose) first so we can agree on the approach.
- Report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Set up

You need [Node.js 24](https://nodejs.org/) (see `.nvmrc`). Python 3 is optional; without it the Python parity tests are skipped.

```bash
git clone https://github.com/GeniusLv2006/uol-timetables.git
cd uol-timetables
npm install
npm run dev
```

Wrangler prints a local URL. Always use it rather than opening `index.html` directly: ES modules and the sample loader do not work from `file://`.

## Check your change

```bash
npm test       # unit and regression tests
npm run check  # tests, build, and Cloudflare dry run; the same check CI runs
```

Please add or update tests for any behaviour you change.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure and static form controls. |
| `styles.css`, `styles/studio.css` | Shared styles, and the personalisation tabs. |
| `js/main.js` | Application state and event handling. |
| `js/bookmarklet.js` | The timetable extractor and the code that builds the bookmarklet. |
| `js/timetable.js` | JSON parsing, validation, and week arithmetic. |
| `js/calendar.js` | iCalendar (RFC 5545) generation, recurrence, reminders, and split exports. |
| `js/timezone.js` | `VTIMEZONE` rules generated from the browser’s timezone data. |
| `js/preferences.js`, `js/profiles.js` | Export settings and saved profiles. |
| `js/diagnostics.js` | Duplicate and clash detection. |
| `js/constants.js` | Known Week One dates and other fixed values. |
| `js/ui.js`, `js/dom.js` | Rendering and DOM references. |
| `js/privacy.js`, `js/contact.js` | Analytics opt-out and the protected contact address. |
| `convert_to_ical.py` | Command-line converter matching the website’s default export. |
| `scripts/build.mjs` | Copies an allowlist of public files into `dist/`. |
| `_headers`, `wrangler.jsonc` | Security headers and Cloudflare hosting settings. |
| `tests/` | Node test suites, including Python parity tests. |
| `docs/` | The JSON format and maintenance guides. |

## Rules that keep the project working

- **No uploads.** The tool must stay browser-only: do not add servers, API calls, or third-party scripts that could see timetable data. Changes to `_headers` (the Content Security Policy) need a clear reason.
- **No runtime dependencies.** The website is plain HTML, CSS, and JavaScript with no bundler.
- **The bookmarklet must stay self-contained.** `js/bookmarklet.js` is turned into a `javascript:` URL with `toString()`, so its extractor function cannot use imports or outside variables, and must not contain `//` comments (they would comment out the rest of the one-line URL). Use `/* */` if you need a comment there.
- **The Python converter must match the website.** `convert_to_ical.py` must produce byte-for-byte the same file as the website’s default export, and `tests/converter.test.js` checks this. Change both together.
- **Keep event UIDs stable.** Changing how `UID` values are built makes calendar apps treat re-imported events as new ones and show duplicates.
- **New public files must be added to `scripts/build.mjs`**, or they will not be deployed.
- **Do not commit personal files.** `timetable.semester*.json` and `timetable.semester*.ics` are ignored for this reason; keep it that way.

## Commits and pull requests

- Write commit messages and pull requests in English.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <summary>`, for example `fix(calendar): keep reminders on split exports`. Common types are `feat`, `fix`, `docs`, `refactor`, `test`, `style`, `ci`, `build`, and `chore`.
- Keep each pull request focused on one change, and do not include `dist/` or other build output.
- In the pull request description, explain the problem, what changes for users, any privacy impact, and how you tested it.
- Pull requests are squash-merged, so the pull request title becomes the commit message on `main`.

## Licence of contributions

By submitting a contribution, you confirm that you wrote it or otherwise have the right to submit it, and you agree that:

1. Your contribution is licensed to everyone under the project’s [AGPL-3.0-only](LICENSE) licence; and
2. You also grant Tingkai Lyu a perpetual, worldwide, non-exclusive, royalty-free, irrevocable licence to use, modify, and distribute your contribution, and to sublicense or relicense it under other terms, including other open-source licences.

You keep the copyright in your contribution.
