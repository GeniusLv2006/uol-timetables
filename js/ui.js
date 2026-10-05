import { DESCRIPTION_FIELDS } from "./constants.js";
import { titleForEvent } from "./preferences.js";
import { longDate } from "./timetable.js";

export function renderOutputFiles(elements, outputs, onDownload) {
  elements.outputFiles.replaceChildren(...outputs.map((output, index) => {
    const row = document.createElement("div");
    row.className = "output-file";
    row.innerHTML = `<strong></strong><small></small><button type="button">Download</button>`;
    row.querySelector("strong").textContent = output.filename;
    row.querySelector("small").textContent = `${output.sessions} sessions`;
    row.querySelector("button").addEventListener("click", () => onDownload(output));
    if (outputs.length === 1) row.hidden = true;
    row.dataset.index = index;
    return row;
  }));
}

export function renderDiagnostics(elements, issues) {
  elements.diagnostics.classList.toggle("has-issues", issues.length > 0);
  elements.diagnosticsCount.textContent = issues.length ? `${issues.length} Conflict${issues.length === 1 ? "" : "s"}` : "No Conflicts";
  elements.diagnosticsList.hidden = !issues.length;
  elements.diagnosticsList.replaceChildren(...issues.slice(0, 20).map((issue) => {
    const item = document.createElement("li");
    item.textContent = issue;
    return item;
  }));
}

export function renderSummary(elements, { payload, preferences, entries, occurrences, issues, outputs }, onDownload) {
  const modules = [...new Set(entries.map(({ event }) => event.moduleCode))].sort();
  elements.summaryName.textContent = preferences.calendarName;
  elements.summaryYear.textContent = payload.academicYear || "Not Specified";
  elements.summaryWeekOne.textContent = longDate(new Date(`${preferences.weekOneMonday}T00:00:00Z`));
  elements.summaryTimezone.textContent = preferences.timezone;
  elements.summaryFirstEvent.textContent = longDate(occurrences[0]?.date);
  elements.summaryLastEvent.textContent = longDate(occurrences.at(-1)?.date);
  elements.metricModules.textContent = modules.length;
  elements.metricPatterns.textContent = entries.length;
  elements.metricSessions.textContent = occurrences.length;
  elements.moduleKey.replaceChildren(...modules.map((moduleCode) => {
    const chip = document.createElement("span");
    chip.className = "module-chip";
    chip.textContent = moduleCode;
    return chip;
  }));
  elements.titleExample.textContent = entries[0] ? titleForEvent(entries[0].event, preferences) : "No matching events";
  elements.exportCaption.textContent = outputs.length > 1 ? `Download ${outputs.length} calendar files` : (outputs[0] ? `Download ${outputs[0].filename}` : "No calendar files");
  elements.exportIcal.querySelector("span").textContent = outputs.length > 1 ? "Export All Calendars" : "Export Calendar";
  elements.exportIcal.disabled = !outputs.length;
  elements.copyIcal.disabled = !outputs.length;
  renderDiagnostics(elements, issues);
  renderOutputFiles(elements, outputs, onDownload);
}

function renderMappingList(container, values, preferences, preferenceKey, placeholder, onChange) {
  container.replaceChildren(...values.map((value) => {
    const row = document.createElement("label");
    row.className = "mapping-row";
    const code = document.createElement("code");
    code.textContent = value;
    code.title = value;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = preferences[preferenceKey][value] || "";
    input.addEventListener("input", () => {
      preferences[preferenceKey][value] = input.value;
      onChange();
    });
    row.append(code, input);
    return row;
  }));
}

function renderDescriptionFields(elements, preferences, onChange) {
  elements.descriptionFields.replaceChildren(...preferences.descriptionOrder.map((key, index) => {
    const row = document.createElement("div");
    row.className = "field-order-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(preferences.descriptionEnabled[key]);
    checkbox.setAttribute("aria-label", `Include ${DESCRIPTION_FIELDS[key].label}`);
    checkbox.addEventListener("change", () => {
      preferences.descriptionEnabled[key] = checkbox.checked;
      onChange();
    });
    const label = document.createElement("span");
    label.textContent = DESCRIPTION_FIELDS[key].label;
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = "Move up";
    up.disabled = index === 0;
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = "Move down";
    down.disabled = index === preferences.descriptionOrder.length - 1;
    const move = (offset) => {
      const next = index + offset;
      [preferences.descriptionOrder[index], preferences.descriptionOrder[next]] = [preferences.descriptionOrder[next], preferences.descriptionOrder[index]];
      renderDescriptionFields(elements, preferences, onChange);
      onChange();
    };
    up.addEventListener("click", () => move(-1));
    down.addEventListener("click", () => move(1));
    row.append(checkbox, label, up, down);
    return row;
  }));
}

function renderFilters(elements, payload, preferences, onChange) {
  const types = [...new Set(payload.events.map((event) => event.deliveryType || "Not Specified"))].sort();
  const activities = new Set(payload.events.map((event) => event.activity));
  const updateToggleLabels = () => {
    elements.selectAllTypes.textContent = preferences.includedDeliveryTypes.length === types.length ? "Clear All" : "Select All";
    elements.selectAllActivities.textContent = preferences.includedActivities.length === activities.size ? "Clear All" : "Select All";
  };
  updateToggleLabels();
  elements.deliveryFilters.replaceChildren(...types.map((type) => {
    const label = document.createElement("label");
    label.className = "filter-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = preferences.includedDeliveryTypes.includes(type);
    checkbox.addEventListener("change", () => {
      preferences.includedDeliveryTypes = checkbox.checked
        ? [...new Set([...preferences.includedDeliveryTypes, type])]
        : preferences.includedDeliveryTypes.filter((item) => item !== type);
      updateToggleLabels();
      onChange();
    });
    const text = document.createElement("span");
    text.textContent = type;
    label.append(checkbox, text);
    return label;
  }));
  elements.activityFilters.replaceChildren(...payload.events.map((event) => {
    const label = document.createElement("label");
    label.className = "activity-filter-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = preferences.includedActivities.includes(event.activity);
    checkbox.dataset.activity = event.activity;
    checkbox.addEventListener("change", () => {
      preferences.includedActivities = checkbox.checked
        ? [...new Set([...preferences.includedActivities, event.activity])]
        : preferences.includedActivities.filter((item) => item !== event.activity);
      // Rows sharing an activity code are one filter; keep their boxes in step.
      elements.activityFilters.querySelectorAll("input").forEach((other) => {
        if (other.dataset.activity === event.activity) other.checked = checkbox.checked;
      });
      updateToggleLabels();
      onChange();
    });
    const text = document.createElement("span");
    text.innerHTML = `<strong></strong><small></small>`;
    text.querySelector("strong").textContent = event.activity;
    text.querySelector("small").textContent = `${event.day} · ${event.start}–${event.end}`;
    const code = document.createElement("em");
    code.textContent = event.moduleCode;
    label.append(checkbox, text, code);
    return label;
  }));
}

export function renderProfiles(elements, profiles) {
  const current = elements.profileSelect.value;
  elements.profileSelect.replaceChildren(
    new Option("Current settings", ""),
    ...Object.keys(profiles).sort().map((name) => new Option(name, name)),
  );
  if (current in profiles) elements.profileSelect.value = current;
}

export function syncControls(elements, payload, preferences, profiles, onChange) {
  elements.titleFormat.value = preferences.titleFormat;
  elements.customTitle.value = preferences.customTitle;
  elements.customTitleGroup.hidden = preferences.titleFormat !== "custom";
  elements.calendarName.value = preferences.calendarName;
  elements.fileName.value = preferences.fileName;
  elements.calendarDescription.value = preferences.calendarDescription;
  elements.calendarColor.value = preferences.calendarColor;
  elements.locationFormat.value = preferences.locationFormat;
  elements.reminderMinutes.value = preferences.reminderMinutes;
  elements.customReminder.value = preferences.customReminderMinutes;
  elements.customReminderGroup.hidden = preferences.reminderMinutes !== "custom";
  elements.weekOne.value = preferences.weekOneMonday;
  elements.timezone.value = preferences.timezone;
  elements.semesterStart.value = preferences.semesterStart;
  elements.semesterEnd.value = preferences.semesterEnd;
  elements.includeWeeks.value = preferences.includeWeeks;
  elements.excludeWeeks.value = preferences.excludeWeeks;
  elements.readingWeek.value = preferences.readingWeek;
  document.querySelector(`input[name="recurrence-mode"][value="${preferences.recurrenceMode}"]`).checked = true;
  document.querySelector(`input[name="split-mode"][value="${preferences.splitMode}"]`).checked = true;
  const modules = [...new Set(payload.events.map((event) => event.moduleCode))].sort();
  const locations = [...new Set(payload.events.map((event) => event.location).filter(Boolean))].sort();
  renderMappingList(elements.moduleAliases, modules, preferences, "moduleAliases", "Optional short name", onChange);
  renderMappingList(elements.locationAliases, locations, preferences, "locationAliases", "Optional location alias", onChange);
  renderDescriptionFields(elements, preferences, onChange);
  renderFilters(elements, payload, preferences, onChange);
  renderProfiles(elements, profiles);
}
