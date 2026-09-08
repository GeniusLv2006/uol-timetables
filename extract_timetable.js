/**
 * Run in the browser context of the University of Liverpool semester timetable.
 * The returned value is the `events` array used by timetable.semester1.json.
 */
(() => {
  const pad = (value) => String(value).padStart(2, "0");
  const hhmm = (minutes) =>
    `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

  let previousDay = "";
  return Array.from(document.querySelectorAll("table tr"))
    .slice(1)
    .flatMap((row) => {
      const cells = Array.from(row.cells);
      const detectedDay = (cells[0]?.innerText || "").trim().toUpperCase();
      if (detectedDay) previousDay = detectedDay;
      const day = previousDay;
      let logicalColumn = 1;
      const events = [];

      for (const cell of cells.slice(1)) {
        const span = cell.colSpan || 1;

        if (cell.classList.contains("sm-event")) {
          const paragraphs = Array.from(cell.querySelectorAll(":scope > p"));
          const description = (paragraphs[0]?.innerText || "").trim();
          const activity = (paragraphs[1]?.innerText || "").trim();
          const moduleCodeFromLink = (paragraphs[2]?.innerText || "").trim();
          const academic = (paragraphs[3]?.innerText || "").trim() || null;
          const location = (paragraphs[4]?.innerText || "").trim() || null;
          const teachingWeeks = (paragraphs[5]?.innerText || "").trim();
          const match = description.match(
            /^(\S+)\s+-\s+(.*?)\s+\[([^\]]+)\]$/,
          );
          const startMinutes = 8 * 60 + (logicalColumn - 1) * 30;

          events.push({
            day,
            start: hhmm(startMinutes),
            end: hhmm(startMinutes + span * 30),
            durationMinutes: span * 30,
            moduleCode: match?.[1] || moduleCodeFromLink,
            moduleTitle: match?.[2] || description,
            deliveryType: match?.[3] || null,
            activity,
            academic,
            location,
            teachingWeeks,
            moduleUrl: cell.querySelector("a")?.href || null,
          });
        }

        logicalColumn += span;
      }

      return events;
    });
})();
