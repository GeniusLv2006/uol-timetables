import { bookmarkletCode } from "./bookmarklet.js";
import { buildOutputs } from "./calendar.js";
import { installContactReveal } from "./contact.js";
import { buildOccurrences, findDiagnostics } from "./diagnostics.js";
import { elements } from "./dom.js";
import {
  adoptPayload,
  changeWeekOne,
  defaultPreferences,
  getEffectiveEvents,
  mergePreferences,
  validatePreferences,
} from "./preferences.js";
import { loadProfiles, saveProfiles } from "./profiles.js";
import { installPrivacyControls } from "./privacy.js";
import { validatePayload } from "./timetable.js";
import { renderProfiles, renderSummary, renderSummaryUnavailable, syncControls } from "./ui.js";

const state = {
  payload: null,
  preferences: null,
  outputs: [],
  preferencesPayload: null,
  pendingExports: [],
  compactAfterPaste: false,
  inputTimer: null,
  toastTimer: null,
};

installContactReveal(document.querySelector("#reveal-email"));
installPrivacyControls({
  openButton: document.querySelector("#open-privacy"),
  dialog: document.querySelector("#privacy-dialog"),
  toggle: document.querySelector("#analytics-enabled"),
  stateLabel: document.querySelector("#analytics-switch-state"),
  saveRegion: document.querySelector("#privacy-preference-save"),
  saveButton: document.querySelector("#save-privacy"),
  notify: showToast,
});

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

async function copyText(text, successMessage) {
  let copied = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.className = "clipboard-fallback";
    document.body.appendChild(temporary);
    temporary.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    temporary.remove();
  }
  showToast(copied ? successMessage : "Copying was blocked by the browser. Select the text and copy it manually.");
}

function downloadCalendar(output) {
  const blob = new Blob([output.ical], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = output.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function requestCalendarExport(outputs) {
  const requestedOutputs = Array.isArray(outputs) ? outputs : [outputs];
  if (!requestedOutputs.length) return;
  state.pendingExports = requestedOutputs;
  elements.exportDialog.returnValue = "";
  elements.exportDialog.showModal();
  document.documentElement.classList.add("has-open-dialog");
}

function confirmCalendarExport() {
  const outputs = state.pendingExports;
  state.pendingExports = [];
  outputs.forEach((output, index) => setTimeout(() => downloadCalendar(output), index * 120));
  showToast(outputs.length === 1 ? `${outputs[0].filename} exported as a static snapshot.` : `${outputs.length} static calendar files exported.`);
}

function refreshOutput() {
  if (!state.payload || !state.preferences) return;
  try {
    validatePreferences(state.preferences);
    const entries = getEffectiveEvents(state.payload, state.preferences);
    const occurrences = buildOccurrences(entries, state.preferences)
      .sort((a, b) => a.date - b.date || a.start - b.start);
    const issues = findDiagnostics(entries, state.preferences);
    state.outputs = buildOutputs(state.payload, state.preferences, entries);
    renderSummary(elements, {
      payload: state.payload,
      preferences: state.preferences,
      entries,
      occurrences,
      issues,
      outputs: state.outputs,
    }, requestCalendarExport);
    elements.liveStatus.textContent = entries.length ? "Valid Timetable · Ready To Export" : "No Events Match Filters";
    elements.liveStatus.className = entries.length ? "live-status valid" : "live-status invalid";
    elements.validationMessage.hidden = true;
  } catch (error) {
    state.outputs = [];
    renderSummaryUnavailable(elements, state.preferences, error.message);
    elements.liveStatus.textContent = "Settings Need Attention";
    elements.liveStatus.className = "live-status invalid";
    elements.validationMessage.hidden = false;
    elements.validationMessage.textContent = error.message;
  }
}

function setWorkbenchCompact(compact) {
  const isCompact = compact && Boolean(state.payload);
  elements.workbench.classList.toggle("is-compact", isCompact);
  elements.workbench.dataset.mode = isCompact ? "review" : "edit";
  elements.editJson.setAttribute("aria-expanded", String(!isCompact));
  elements.reviewJson.hidden = isCompact || !state.payload;
  if (isCompact) requestAnimationFrame(() => elements.editJson.focus());
}

function renderValid(payload, compactOnSuccess = false) {
  state.payload = payload;
  if (!state.preferences || !state.preferencesPayload) {
    state.preferences = defaultPreferences(payload);
    elements.profileSelect.value = "";
  } else if (payload !== state.preferencesPayload) {
    state.preferences = adoptPayload(state.preferences, state.preferencesPayload, payload);
  }
  state.preferencesPayload = payload;
  syncControls(elements, payload, state.preferences, loadProfiles(), refreshOutput);
  elements.summaryEmpty.hidden = true;
  elements.summary.hidden = false;
  elements.customizer.hidden = false;
  elements.validationMessage.hidden = true;
  elements.compactCharacterCount.textContent = elements.jsonInput.value.length.toLocaleString();
  elements.compactEventCount.textContent = payload.events.length.toLocaleString();
  refreshOutput();
  if (compactOnSuccess) setWorkbenchCompact(true);
  else elements.reviewJson.hidden = false;
}

function renderInvalid(message, isEmpty = false) {
  state.payload = null;
  state.outputs = [];
  elements.summary.hidden = true;
  elements.summaryEmpty.hidden = false;
  elements.customizer.hidden = true;
  setWorkbenchCompact(false);
  elements.liveStatus.textContent = isEmpty ? "Waiting For Timetable Data" : "JSON Needs Attention";
  elements.liveStatus.className = isEmpty ? "live-status" : "live-status invalid";
  elements.validationMessage.hidden = isEmpty;
  elements.validationMessage.textContent = message;
}

function processJson({ compactOnSuccess = false } = {}) {
  const value = elements.jsonInput.value.trim();
  elements.characterCount.textContent = `${elements.jsonInput.value.length.toLocaleString()} Characters`;
  if (!value) {
    renderInvalid("", true);
    return;
  }
  try {
    renderValid(validatePayload(JSON.parse(value)), compactOnSuccess);
    return true;
  } catch (error) {
    renderInvalid(error.message);
    return false;
  }
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast("That file is larger than the 5 MB limit.");
    return;
  }
  elements.jsonInput.value = await file.text();
  processJson({ compactOnSuccess: true });
  showToast(`${file.name} loaded.`);
}

function bindPreference(element, key, eventName = "input", transform = (value) => value) {
  element.addEventListener(eventName, () => {
    if (!state.preferences) return;
    state.preferences[key] = transform(element.value);
    refreshOutput();
  });
}

elements.bookmarklet.setAttribute("href", bookmarkletCode);
elements.bookmarklet.addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Drag this button to your bookmarks bar, then use it on the timetable page.");
});
elements.copyBookmarklet.addEventListener("click", () => copyText(bookmarkletCode, "Bookmarklet code copied."));
elements.pasteClipboard.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error("empty");
    elements.jsonInput.value = text;
    processJson({ compactOnSuccess: true });
    elements.workbench.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Clipboard content pasted.");
  } catch {
    elements.jsonInput.focus();
    showToast("Clipboard access was unavailable. Paste into the editor manually.");
  }
});

elements.jsonInput.addEventListener("paste", () => {
  state.compactAfterPaste = true;
});
elements.jsonInput.addEventListener("input", (event) => {
  clearTimeout(state.inputTimer);
  const compactOnSuccess = state.compactAfterPaste || event.inputType === "insertFromPaste";
  state.compactAfterPaste = false;
  state.inputTimer = setTimeout(() => processJson({ compactOnSuccess }), 180);
});
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
for (const type of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragover");
  });
}
for (const type of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragover");
  });
}
elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));
elements.loadSample.addEventListener("click", async () => {
  try {
    const response = await fetch("timetable.sample.json");
    if (!response.ok) throw new Error();
    elements.jsonInput.value = JSON.stringify(await response.json(), null, 2);
    processJson({ compactOnSuccess: true });
    showToast("Included sample loaded.");
  } catch {
    showToast("Start the local server to load the included sample.");
  }
});
elements.clearJson.addEventListener("click", () => {
  elements.jsonInput.value = "";
  elements.fileInput.value = "";
  processJson();
  elements.jsonInput.focus();
});
elements.editJson.addEventListener("click", () => {
  setWorkbenchCompact(false);
  requestAnimationFrame(() => {
    elements.jsonInput.focus();
    elements.jsonInput.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});
elements.reviewJson.addEventListener("click", () => {
  processJson({ compactOnSuccess: true });
});

const configTabs = [...document.querySelectorAll(".config-tab")];

function selectConfigTab(tab, focus = false) {
  for (const item of configTabs) {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(item.getAttribute("aria-controls"));
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
  if (focus) tab.focus();
}

configTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectConfigTab(tab));
  tab.addEventListener("keydown", (event) => {
    const targets = {
      ArrowDown: configTabs[(index + 1) % configTabs.length],
      ArrowRight: configTabs[(index + 1) % configTabs.length],
      ArrowUp: configTabs[(index - 1 + configTabs.length) % configTabs.length],
      ArrowLeft: configTabs[(index - 1 + configTabs.length) % configTabs.length],
      Home: configTabs[0],
      End: configTabs.at(-1),
    };
    if (!targets[event.key]) return;
    event.preventDefault();
    selectConfigTab(targets[event.key], true);
  });
});

elements.titleFormat.addEventListener("change", () => {
  if (!state.preferences) return;
  state.preferences.titleFormat = elements.titleFormat.value;
  elements.customTitleGroup.hidden = state.preferences.titleFormat !== "custom";
  refreshOutput();
});
elements.reminderMinutes.addEventListener("change", () => {
  if (!state.preferences) return;
  state.preferences.reminderMinutes = elements.reminderMinutes.value;
  elements.customReminderGroup.hidden = state.preferences.reminderMinutes !== "custom";
  refreshOutput();
});

bindPreference(elements.customTitle, "customTitle");
bindPreference(elements.calendarName, "calendarName");
bindPreference(elements.fileName, "fileName");
bindPreference(elements.calendarDescription, "calendarDescription");
bindPreference(elements.calendarColor, "calendarColor");
bindPreference(elements.locationFormat, "locationFormat", "change");
bindPreference(elements.customReminder, "customReminderMinutes", "input", Number);
elements.weekOne.addEventListener("change", () => {
  if (!state.preferences) return;
  state.preferences = changeWeekOne(state.preferences, elements.weekOne.value);
  syncControls(elements, state.payload, state.preferences, loadProfiles(), refreshOutput);
  refreshOutput();
});
bindPreference(elements.timezone, "timezone");
bindPreference(elements.semesterStart, "semesterStart", "change");
bindPreference(elements.semesterEnd, "semesterEnd", "change");
bindPreference(elements.includeWeeks, "includeWeeks");
bindPreference(elements.excludeWeeks, "excludeWeeks");
bindPreference(elements.readingWeek, "readingWeek");

for (const name of ["recurrence-mode", "split-mode"]) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!state.preferences || !radio.checked) return;
      state.preferences[name === "recurrence-mode" ? "recurrenceMode" : "splitMode"] = radio.value;
      refreshOutput();
    });
  });
}

elements.selectAllTypes.addEventListener("click", () => {
  if (!state.payload || !state.preferences) return;
  const all = [...new Set(state.payload.events.map((event) => event.deliveryType || "Not Specified"))];
  state.preferences.includedDeliveryTypes = state.preferences.includedDeliveryTypes.length === all.length ? [] : all;
  syncControls(elements, state.payload, state.preferences, loadProfiles(), refreshOutput);
  refreshOutput();
});
elements.selectAllActivities.addEventListener("click", () => {
  if (!state.payload || !state.preferences) return;
  const all = [...new Set(state.payload.events.map((event) => event.activity))];
  state.preferences.includedActivities = state.preferences.includedActivities.length === all.length ? [] : all;
  syncControls(elements, state.payload, state.preferences, loadProfiles(), refreshOutput);
  refreshOutput();
});

elements.saveProfile.addEventListener("click", () => {
  if (!state.preferences) return;
  const name = elements.profileName.value.trim();
  if (!name) {
    showToast("Enter a profile name before saving.");
    elements.profileName.focus();
    return;
  }
  const profiles = loadProfiles();
  if (profiles[name] && !confirm(`Replace the saved profile “${name}”?`)) return;
  profiles[name] = structuredClone(state.preferences);
  if (!saveProfiles(profiles)) {
    showToast("This browser blocked saving the profile. Check private browsing or storage settings.");
    return;
  }
  renderProfiles(elements, profiles);
  elements.profileSelect.value = name;
  elements.profileName.value = "";
  showToast(`${name} saved in this browser.`);
});
elements.profileSelect.addEventListener("change", () => {
  const name = elements.profileSelect.value;
  if (!name || !state.payload) return;
  const saved = loadProfiles()[name];
  if (!saved) return;
  state.preferences = mergePreferences(saved, state.payload, state.preferences);
  syncControls(elements, state.payload, state.preferences, loadProfiles(), refreshOutput);
  elements.profileSelect.value = name;
  refreshOutput();
  showToast("Saved profile applied.");
});
elements.deleteProfile.addEventListener("click", () => {
  const name = elements.profileSelect.value;
  if (!name) {
    showToast("Choose a saved profile to delete.");
    return;
  }
  if (!confirm(`Delete the saved profile “${name}”?`)) return;
  const profiles = loadProfiles();
  delete profiles[name];
  if (!saveProfiles(profiles)) {
    showToast("This browser blocked updating saved profiles.");
    return;
  }
  elements.profileSelect.value = "";
  renderProfiles(elements, profiles);
  showToast(`${name} deleted.`);
});

elements.exportIcal.addEventListener("click", () => {
  if (!state.outputs.length) return;
  requestCalendarExport(state.outputs);
});
elements.exportDialog.addEventListener("close", () => {
  document.documentElement.classList.remove("has-open-dialog");
  if (elements.exportDialog.returnValue === "confirm") confirmCalendarExport();
  else state.pendingExports = [];
});
elements.exportDialog.addEventListener("click", (event) => {
  if (event.target === elements.exportDialog) elements.exportDialog.close("cancel");
});
elements.copyIcal.addEventListener("click", () => {
  if (!state.outputs.length) return;
  const suffix = state.outputs.length > 1 ? " The first calendar was copied." : "";
  copyText(state.outputs[0].ical, `iCalendar text copied.${suffix}`);
});

processJson();
