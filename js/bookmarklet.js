export async function extractTimetable() {
  try {
    const table = document.querySelector("table");
    if (!table) throw new Error("No timetable table was found on this page.");

    const pad = (value) => String(value).padStart(2, "0");
    const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    const semester = Number(new URL(location.href).searchParams.get("semester") || 1);
    let previousDay = "";
    const events = Array.from(table.querySelectorAll("tr")).slice(1).flatMap((row) => {
      const cells = Array.from(row.cells);
      const detectedDay = (cells[0]?.innerText || "").trim().toUpperCase();
      if (detectedDay) previousDay = detectedDay;
      const day = previousDay;
      let logicalColumn = 1;
      const rowEvents = [];
      for (const cell of cells.slice(1)) {
        const span = cell.colSpan || 1;
        if (cell.classList.contains("sm-event")) {
          const paragraphs = Array.from(cell.querySelectorAll(":scope > p"));
          const description = (paragraphs[0]?.innerText || "").trim();
          const activity = (paragraphs[1]?.innerText || "").trim();
          const linkedModule = (paragraphs[2]?.innerText || "").trim();
          const academic = (paragraphs[3]?.innerText || "").trim() || null;
          const eventLocation = (paragraphs[4]?.innerText || "").trim() || null;
          const teachingWeeks = (paragraphs[5]?.innerText || "").trim();
          const match = description.match(/^(\S+)\s+-\s+(.*?)\s+\[([^\]]+)\]$/);
          const startMinutes = 8 * 60 + (logicalColumn - 1) * 30;
          rowEvents.push({
            day,
            start: hhmm(startMinutes),
            end: hhmm(startMinutes + span * 30),
            durationMinutes: span * 30,
            moduleCode: match?.[1] || linkedModule,
            moduleTitle: match?.[2] || description,
            deliveryType: match?.[3] || null,
            activity,
            academic,
            location: eventLocation,
            teachingWeeks,
            moduleUrl: cell.querySelector("a")?.href || null,
          });
        }
        logicalColumn += span;
      }
      return rowEvents;
    });
    if (!events.length) throw new Error("No timetable events were found.");

    const moduleUrl = events.find((event) => event.moduleUrl)?.moduleUrl || "";
    const yearMatch = moduleUrl.match(/_(\d{4})(\d{2})\.htm/i);
    const academicYear = yearMatch ? `${yearMatch[1]}/${yearMatch[2]}` : "";
    const knownStarts = { "2026/27:1": "2026-09-28" };
    const payload = {
      schemaVersion: 1,
      source: location.href,
      academicYear,
      semester,
      timezone: "Europe/London",
      weekOneMonday: knownStarts[`${academicYear}:${semester}`] || "",
      calendarName: `University of Liverpool · Semester ${semester}`,
      generatedAt: new Date().toISOString(),
      events,
    };
    const json = JSON.stringify(payload, null, 2);
    const notify = (message, fallback = false) => {
      document.querySelector("#uol-timetable-converter-notice")?.remove();
      const notice = document.createElement("div");
      notice.id = "uol-timetable-converter-notice";
      notice.textContent = message;
      Object.assign(notice.style, {
        position: "fixed", top: "22px", right: "22px", zIndex: "2147483647",
        maxWidth: "360px", padding: "16px 19px",
        borderLeft: `5px solid ${fallback ? "#d65342" : "#f1b83a"}`,
        color: "#fcf9f1", background: "#1d2230",
        boxShadow: "0 18px 45px rgba(0,0,0,.3)",
        font: "600 14px/1.45 sans-serif",
      });
      document.body.appendChild(notice);
      setTimeout(() => notice.remove(), 5000);
    };
    try {
      await navigator.clipboard.writeText(json);
      notify(`${events.length} timetable patterns copied. Paste them into UoL Timetable Converter.`);
    } catch {
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uol-timetable-semester-${semester}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Clipboard access was blocked, so the JSON was downloaded instead.", true);
    }
  } catch (error) {
    alert(`Timetable extraction failed: ${error.message}`);
  }
}

export const bookmarkletCode = `javascript:(${extractTimetable.toString()})()`;
