#!/usr/bin/env python3
"""Convert a University of Liverpool timetable JSON export to iCalendar."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


DAY_OFFSETS = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}
WEEK_TOKEN_RE = re.compile(r"^S\d+\s+(\d{1,2})(?:\s*-\s*S\d+\s+(\d{1,2}))?$", re.IGNORECASE)


def escape_ical(value: Any) -> str:
    """Escape an RFC 5545 TEXT value."""
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


def fold_line(line: str, limit: int = 75) -> list[str]:
    """Fold an iCalendar content line without splitting a UTF-8 sequence."""
    pieces: list[str] = []
    current = ""
    current_bytes = 0
    byte_limit = limit

    for char in line:
        size = len(char.encode("utf-8"))
        if current and current_bytes + size > byte_limit:
            pieces.append(current)
            current = " " + char
            current_bytes = 1 + size
            byte_limit = limit
        else:
            current += char
            current_bytes += size

    pieces.append(current)
    return pieces


def add_line(lines: list[str], name: str, value: Any) -> None:
    lines.extend(fold_line(f"{name}:{value}"))


def parse_week_ranges(value: str) -> list[tuple[int, int]]:
    tokens = [token.strip() for token in str(value).split(",") if token.strip()]
    matches = [WEEK_TOKEN_RE.fullmatch(token) for token in tokens]
    if not tokens or any(match is None for match in matches):
        raise ValueError(f"Cannot parse teachingWeeks: {value!r}")
    ranges = [(int(match.group(1)), int(match.group(2) or match.group(1))) for match in matches]
    if any(start < 1 or end < start for start, end in ranges):
        raise ValueError(f"Invalid teachingWeeks range: {value!r}")
    return ranges


def local_stamp(day: date, hhmm: str) -> str:
    hour, minute = (int(part) for part in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute).strftime("%Y%m%dT%H%M%S")


def stable_hash(value: str) -> str:
    """FNV-1a over UTF-16 code units, matching stableHash in js/calendar.js."""
    encoded = value.encode("utf-16-le")
    result = 2166136261
    for index in range(0, len(encoded), 2):
        result ^= encoded[index] | (encoded[index + 1] << 8)
        result = (result * 16777619) & 0xFFFFFFFF
    return f"{result:08x}"


def contiguous_ranges(weeks: list[int]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for week in weeks:
        if ranges and week == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], week)
        else:
            ranges.append((week, week))
    return ranges


def last_sunday(year: int, month: int) -> date:
    day = date(year, month + 1, 1) - timedelta(days=1)
    return day - timedelta(days=(day.weekday() + 1) % 7)


def london_timezone(first_year: int, last_year: int) -> list[str]:
    """UK clocks change at 01:00 UTC on the last Sundays of March and October."""

    def observance(kind: str, offset_from: str, offset_to: str, name: str, start: str) -> list[str]:
        return [
            f"BEGIN:{kind}",
            f"TZOFFSETFROM:{offset_from}",
            f"TZOFFSETTO:{offset_to}",
            f"TZNAME:{name}",
            f"DTSTART:{start}",
            f"END:{kind}",
        ]

    lines = [
        "BEGIN:VTIMEZONE",
        "TZID:Europe/London",
        "X-LIC-LOCATION:Europe/London",
        *observance("STANDARD", "+0000", "+0000", "GMT", f"{first_year}0101T000000"),
    ]
    for year in range(first_year, last_year + 1):
        spring = last_sunday(year, 3).strftime("%Y%m%d")
        autumn = last_sunday(year, 10).strftime("%Y%m%d")
        lines += observance("DAYLIGHT", "+0000", "+0100", "BST", f"{spring}T010000")
        lines += observance("STANDARD", "+0100", "+0000", "GMT", f"{autumn}T020000")
    lines.append("END:VTIMEZONE")
    return lines


def source_weeks(event: dict[str, Any]) -> list[int]:
    weeks = {week for start, end in parse_week_ranges(event["teachingWeeks"]) for week in range(start, end + 1)}
    return sorted(weeks)


def event_date(week_one_monday: date, week: int, day_code: str) -> date:
    return week_one_monday + timedelta(weeks=week - 1, days=DAY_OFFSETS[day_code])


def event_components(
    event: dict[str, Any],
    week_one_monday: date,
    timezone_name: str,
    dtstamp: str,
) -> Iterable[list[str]]:
    """Mirror the web app's default export settings."""
    day_code = event["day"].upper()
    if day_code not in DAY_OFFSETS:
        raise ValueError(f"Unknown day code: {event['day']!r}")

    description = "\n".join(
        f"{prefix}: {event[field]}"
        for prefix, field in (
            ("Activity", "activity"),
            ("Type", "deliveryType"),
            ("Teaching Weeks", "teachingWeeks"),
            ("Academic", "academic"),
        )
        if event.get(field)
    )
    for range_start, range_end in contiguous_ranges(source_weeks(event)):
        event_day = event_date(week_one_monday, range_start, day_code)
        count = range_end - range_start + 1
        uid_source = "|".join(
            [
                event["activity"],
                event["day"],
                event["start"],
                str(range_start),
                str(range_end),
                week_one_monday.isoformat(),
            ]
        )
        lines = ["BEGIN:VEVENT"]
        add_line(lines, "UID", f"{stable_hash(uid_source)}@timetables.liverpool.ac.uk")
        add_line(lines, "DTSTAMP", dtstamp)
        add_line(lines, f"DTSTART;TZID={timezone_name}", local_stamp(event_day, event["start"]))
        add_line(lines, f"DTEND;TZID={timezone_name}", local_stamp(event_day, event["end"]))
        if count > 1:
            add_line(lines, "RRULE", f"FREQ=WEEKLY;COUNT={count}")
        add_line(lines, "SUMMARY", escape_ical(event["moduleCode"]))
        add_line(lines, "LOCATION", escape_ical(event.get("location") or ""))
        add_line(lines, "DESCRIPTION", escape_ical(description))
        if event.get("moduleUrl"):
            add_line(lines, "URL", event["moduleUrl"])
        add_line(lines, "CATEGORIES", escape_ical(event["moduleCode"]))
        add_line(lines, "X-UOL-ACTIVITY", escape_ical(event["activity"]))
        add_line(lines, "X-UOL-TEACHING-WEEK", range_start)
        lines.append("END:VEVENT")
        yield lines


def convert(payload: dict[str, Any]) -> str:
    timezone_name = payload.get("timezone") or "Europe/London"
    if timezone_name != "Europe/London":
        # The VTIMEZONE below encodes UK daylight-saving rules only.
        raise ValueError(
            f"Unsupported timezone {timezone_name!r}; the Python converter only supports Europe/London."
        )
    week_one_monday = date.fromisoformat(payload["weekOneMonday"])
    generated_at = payload.get("generatedAt")
    if generated_at:
        parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        dtstamp = parsed.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    else:
        dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    years = [
        event_date(week_one_monday, week, event["day"].upper()).year
        for event in payload["events"]
        for week in source_weeks(event)
    ]
    description = " ".join(
        f"University of Liverpool {payload.get('academicYear') or ''} Semester {payload.get('semester') or ''} timetable".split()
    )
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//UoL Timetable Converter//UoL JSON to iCalendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    add_line(lines, "X-WR-CALNAME", escape_ical(payload.get("calendarName") or "University of Liverpool Timetable"))
    add_line(lines, "X-WR-CALDESC", escape_ical(description))
    add_line(lines, "X-WR-TIMEZONE", timezone_name)
    add_line(lines, "X-APPLE-CALENDAR-COLOR", "#243352")
    lines += london_timezone(min(years), max(years))

    for event in payload["events"]:
        for component in event_components(event, week_one_monday, timezone_name, dtstamp):
            lines.extend(component)

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Timetable JSON file")
    parser.add_argument("output", type=Path, help="Destination .ics file")
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    calendar = convert(payload)
    args.output.write_text(calendar, encoding="utf-8", newline="")
    print(f"Wrote {args.output} from {len(payload['events'])} activity patterns")


if __name__ == "__main__":
    main()
