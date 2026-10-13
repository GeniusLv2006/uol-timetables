# Maintenance guide

Tasks for whoever maintains the production site at <https://timetables.xjtlu.uk>.

## Every academic year: add Week One dates

The website fills in the first teaching Monday for semesters it knows about.

1. Find the new dates on the University’s [term dates](https://www.liverpool.ac.uk/term-dates/) page.
2. Add an entry to `KNOWN_WEEK_ONE_DATES` in `js/constants.js`, keyed by `academicYear:semester`, for example `"2028/29:1": "2028-09-25"`. The bookmarklet and the website both read this table.
3. Add the date to the table in [`docs/timetable-json.md`](timetable-json.md).
4. Run `npm run check` and open a pull request.

Do not add Semester 2 dates until a real Semester 2 timetable shows whether `S2` week numbers count the Easter break. If they skip the break, counting whole weeks from Week One gives wrong dates after Easter, and the week arithmetic in `js/timetable.js` and `convert_to_ical.py` would need to change as well.

## When My Timetable changes its layout

If extraction stops working, the University has probably changed the timetable page. Reproduce it on the live page, update the parsing in `js/bookmarklet.js`, and check the fixed JSON with the website. Keep test fixtures fictional: never commit a real extracted timetable.

## Deployment

The site is static files served by Cloudflare Workers Static Assets. There is no server code and there are no secrets.

- **Pushing to `main` deploys production** through Cloudflare Workers Builds, so changes go through pull requests.
- Workers Builds settings: production branch `main`, build command `npm run build`, deploy command `npx wrangler deploy`, root directory the repository root.
- `npm run build` starts from an empty `dist/` and copies only the files listed in `scripts/build.mjs`.
- `npm run deploy` deploys from a local checkout. Use it only as a fallback when Workers Builds is unavailable.

After each deploy, confirm the Workers Builds check passed and that the production site serves the new files.

## Merging pull requests

1. Make sure CI passes for the latest commit of the pull request, and review the final diff.
2. Use **Squash and merge**, with a Conventional Commit title ending in the pull request number, for example `fix(calendar): keep reminders on split exports (#21)`.
3. Check that CI on `main` and the Workers Builds deploy both pass.

## Dependency updates

Dependabot opens monthly pull requests for GitHub Actions and npm. The only npm dependency is Wrangler, a development tool, so the website itself has no runtime dependencies. Merge these updates when CI passes.

## Cloudflare settings outside the repository

These live in the Cloudflare dashboard and are not covered by the code:

- **Web Analytics** is injected automatically at Cloudflare’s edge. The Content Security Policy in `_headers` allows its beacon from `static.cloudflareinsights.com` and reports to the same-origin `/cdn-cgi/rum` endpoint. Do not add `no-transform` to `Cache-Control`, because it stops the beacon from being injected.
- **Analytics opt-out**: the footer’s Privacy control stores the cookie `uol_timetable_analytics=disabled`. A Configuration Rule must set **Disable Real User Monitoring (RUM)** when the request cookie contains that value. The rule is required because the beacon is injected before the site’s JavaScript runs.
- **Custom domain**: `timetables.xjtlu.uk` points at the Worker.

## Domain and event UIDs

Exported events have UIDs ending in `@timetables.xjtlu.uk` (`js/calendar.js` and `convert_to_ical.py`). If the site ever moves to another domain, keep this suffix: changing it makes calendar apps treat re-imported events as new ones and show duplicates.

## Security reports

Private vulnerability reports arrive through GitHub’s **Security** tab. See [SECURITY.md](../SECURITY.md) for what is in scope.
