import { compactDate, dateForWeek, longDate, minutesFromTime } from "./timetable.js";

export function buildOccurrences(entries, preferences) {
  return entries.flatMap(({ event, weeks }) => weeks.map((week) => ({
    event,
    week,
    date: dateForWeek(preferences.weekOneMonday, week, event.day),
    start: minutesFromTime(event.start),
    end: minutesFromTime(event.end),
  })));
}

export function findDiagnostics(entries, preferences) {
  const occurrences = buildOccurrences(entries, preferences);
  const issues = [];
  const seen = new Set();
  for (const occurrence of occurrences) {
    const key = `${compactDate(occurrence.date)}|${occurrence.event.activity}|${occurrence.event.start}`;
    if (seen.has(key)) issues.push(`Duplicate: ${occurrence.event.activity} on ${longDate(occurrence.date)}.`);
    seen.add(key);
  }
  const byDate = occurrences.reduce((map, item) => {
    const key = compactDate(item.date);
    map.set(key, [...(map.get(key) || []), item]);
    return map;
  }, new Map());
  for (const dayItems of byDate.values()) {
    const sorted = [...dayItems].sort((a, b) => a.start - b.start);
    for (let index = 0; index < sorted.length; index += 1) {
      for (let other = index + 1; other < sorted.length && sorted[other].start < sorted[index].end; other += 1) {
        if (sorted[index].event.activity !== sorted[other].event.activity) {
          issues.push(`Overlap: ${sorted[index].event.moduleCode} and ${sorted[other].event.moduleCode} on ${longDate(sorted[index].date)}.`);
        }
      }
    }
  }
  return [...new Set(issues)];
}
