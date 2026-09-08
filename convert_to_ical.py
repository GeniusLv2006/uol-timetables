#!/usr/bin/env python3
"""Convert a University of Liverpool timetable JSON export to iCalendar."""

from __future__ import annotations

import argparse
import hashlib
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
WEEK_RANGE_RE = re.compile(r"S\d+\s+(\d{1,2})\s*-\s*S\d+\s+(\d{1,2})")


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
    ranges = [(int(start), int(end)) for start, end in WEEK_RANGE_RE.findall(value)]
    if not ranges:
        raise ValueError(f"Cannot parse teachingWeeks: {value!r}")
    if any(start < 1 or end < start for start, end in ranges):
        raise ValueError(f"Invalid teachingWeeks range: {value!r}")
    return ranges


def local_stamp(day: date, hhmm: str) -> str:
    hour, minute = (int(part) for part in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute).strftime("%Y%m%dT%H%M%S")


def event_components(
    event: dict[str, Any],
    week_one_monday: date,
    timezone_name: str,
    dtstamp: str,
) -> Iterable[list[str]]:
    day_code = event["day"].upper()
    if day_code not in DAY_OFFSETS:
        raise ValueError(f"Unknown day code: {event['day']!r}")

    for range_start, range_end in parse_week_ranges(event["teachingWeeks"]):
        event_day = (
            week_one_monday
            + timedelta(weeks=range_start - 1)
            + timedelta(days=DAY_OFFSETS[day_code])
        )
        count = range_end - range_start + 1
        uid_source = "|".join(
            [
                event["activity"],
                day_code,
                event["start"],
                str(range_start),
                str(range_end),
                week_one_monday.isoformat(),
            ]
        )
        uid_hash = hashlib.sha256(uid_source.encode("utf-8")).hexdigest()[:24]
        summary = f"{event['moduleCode']} · {event['moduleTitle']}"
        description_parts = [
            f"Activity: {event['activity']}",
            f"Type: {event.get('deliveryType') or 'Not specified'}",
            f"Teaching weeks: {event['teachingWeeks']}",
        ]
        if event.get("academic"):
            description_parts.append(f"Academic: {event['academic']}")
        if event.get("moduleUrl"):
            description_parts.append(f"Module: {event['moduleUrl']}")

        lines = ["BEGIN:VEVENT"]
        add_line(lines, "UID", f"{uid_hash}@timetables.liverpool.ac.uk")
        add_line(lines, "DTSTAMP", dtstamp)
        add_line(
            lines,
            f"DTSTART;TZID={timezone_name}",
            local_stamp(event_day, event["start"]),
        )
        add_line(
            lines,
            f"DTEND;TZID={timezone_name}",
            local_stamp(event_day, event["end"]),
        )
        if count > 1:
            add_line(lines, "RRULE", f"FREQ=WEEKLY;COUNT={count}")
        add_line(lines, "SUMMARY", escape_ical(summary))
        add_line(lines, "LOCATION", escape_ical(event.get("location") or ""))
        add_line(lines, "DESCRIPTION", escape_ical("\n".join(description_parts)))
        if event.get("moduleUrl"):
            add_line(lines, "URL", event["moduleUrl"])
        add_line(lines, "CATEGORIES", escape_ical(event["moduleCode"]))
        add_line(lines, "X-UOL-ACTIVITY", escape_ical(event["activity"]))
        add_line(lines, "X-UOL-TEACHING-WEEKS", escape_ical(event["teachingWeeks"]))
        lines.append("END:VEVENT")
        yield lines


def convert(payload: dict[str, Any]) -> str:
    timezone_name = payload.get("timezone", "Europe/London")
    week_one_monday = date.fromisoformat(payload["weekOneMonday"])
    generated_at = payload.get("generatedAt")
    if generated_at:
        parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        dtstamp = parsed.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    else:
        dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//UoL Timetable Converter//UoL JSON to iCalendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape_ical(payload.get('calendarName', 'UoL Timetable'))}",
        f"X-WR-TIMEZONE:{timezone_name}",
        "BEGIN:VTIMEZONE",
        f"TZID:{timezone_name}",
        f"X-LIC-LOCATION:{timezone_name}",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0000",
        "TZOFFSETTO:+0100",
        "TZNAME:BST",
        "DTSTART:19700329T010000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0000",
        "TZNAME:GMT",
        "DTSTART:19701025T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]

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
