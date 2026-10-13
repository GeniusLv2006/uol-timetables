# Security policy

## Reporting a vulnerability

Please report security problems privately through [GitHub’s private vulnerability reporting](https://github.com/GeniusLv2006/uol-timetables/security/advisories/new), not in a public issue. If you cannot use GitHub, use the **Show email address** link in the footer of <https://timetables.xjtlu.uk>.

Please include the steps to reproduce the problem and what an attacker could achieve. Do not include a real timetable; use made-up data. You should receive a reply within a week.

## Scope

In scope:

- The website at <https://timetables.xjtlu.uk> and the code in this repository.
- Ways for timetable data to leave the browser, or for imported text to change the exported calendar in unintended ways.
- Script injection, weaknesses in the Content Security Policy or other headers, and problems with the bookmarklet.

Out of scope:

- The University of Liverpool’s systems, including My Timetable. Report those to the University.
- Cloudflare’s own services.
- Reports from automated scanners without a demonstrated impact.

Only the latest version on `main`, which is what the website serves, receives fixes.
