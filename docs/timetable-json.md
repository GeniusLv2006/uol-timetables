# Timetable JSON format

The bookmarklet produces this JSON, and both the website and `convert_to_ical.py` accept it. [`timetable.sample.json`](../timetable.sample.json) is a complete, fictional example.

## Top-level fields

| Field | Required | Description |
| --- | --- | --- |
| `schemaVersion` | No | Currently `1`, written by the extractor. |
| `academicYear` | No | For example `2026/27`. Used with `semester` to look up a known Week One. |
| `semester` | No | `1` or `2`. |
| `weekOneMonday` | Sometimes | The first teaching Monday as `YYYY-MM-DD`. The website fills it in for semesters listed in `KNOWN_WEEK_ONE_DATES` (`js/constants.js`), and otherwise asks for it in the Schedule settings. The Python converter always needs it. |
| `timezone` | No | An IANA timezone name. Defaults to `Europe/London`. |
| `calendarName` | No | The calendar’s display name. |
| `source` | No | The timetable page URL. |
| `generatedAt` | No | An ISO timestamp, used as the calendar’s `DTSTAMP`. |
| `events` | Yes | A non-empty list of timetable patterns, described below. |

## Event fields

Each item in `events` is one repeating session:

| Field | Required | Description |
| --- | --- | --- |
| `day` | Yes | `MON` to `SUN`. |
| `start`, `end` | Yes | `HH:MM`, 24-hour clock. `end` must be after `start`. |
| `durationMinutes` | No | Length of the session, written by the extractor for reference. Event times come from `start` and `end`. |
| `moduleCode` | Yes | For example `COMP101`. |
| `moduleTitle` | Yes | The module’s name. |
| `activity` | Yes | The activity code, for example `COMP101/LEC/A/01`. |
| `teachingWeeks` | Yes | Ranges or single weeks, for example `S1 01-S1 08, S1 10-S1 12` or `S1 01, S1 03, S1 05`. Week numbers run from 1 to 53. |
| `deliveryType` | No | For example `ON CAMPUS LECTURE`. |
| `academic` | No | The member of staff. |
| `location` | No | The room or building. |
| `moduleUrl` | No | An `https://` link to the module page. |

Optional fields may be `null`. Text fields must be strings. `moduleUrl`, when present, must be an `https://` link without spaces or control characters. Line breaks in text are exported as escaped newlines, and other control characters are removed, so imported text cannot add its own iCalendar lines.

## How dates are worked out

Teaching week numbers such as `S1 03` are turned into dates by counting whole weeks from `weekOneMonday`. Known Week One dates are taken from the University’s [term dates](https://www.liverpool.ac.uk/term-dates/):

| Academic year | Semester | Week One |
| --- | --- | --- |
| 2026/27 | 1 | 28 September 2026 |
| 2027/28 | 1 | 27 September 2027 |

Semester 2 dates are not listed yet. Its teaching is split by a three-week Easter break, and until a real Semester 2 timetable confirms whether `S2` week numbers count the break weeks, counting whole weeks may give the wrong dates after Easter.

## How the extractor reads the page

My Timetable is rendered on the server and does not expose a JSON feed, so `js/bookmarklet.js` reads the timetable grid itself. Times are encoded by position: the grid begins at 08:00, each column is 30 minutes, and a session cell’s `colspan` is its duration. The bookmarklet turns that layout into the fields above.
