const ANALYTICS_COOKIE = "uol_timetable_analytics";
const DISABLED_VALUE = "disabled";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const RELOAD_STATE_KEY = "uol_timetable_analytics_reload";

function cookieValue(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function analyticsEnabled() {
  return cookieValue(ANALYTICS_COOKIE) !== DISABLED_VALUE;
}

export function setAnalyticsEnabled(enabled) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const maxAge = enabled ? 0 : ONE_YEAR_SECONDS;
  const value = enabled ? "" : DISABLED_VALUE;
  document.cookie = `${encodeURIComponent(ANALYTICS_COOKIE)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function storeReloadState(enabled) {
  try {
    sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify({
      enabled,
      scrollY: window.scrollY,
    }));
  } catch {
    // The preference cookie still applies if session storage is unavailable.
  }
}

function takeReloadState() {
  try {
    const value = sessionStorage.getItem(RELOAD_STATE_KEY);
    sessionStorage.removeItem(RELOAD_STATE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function installPrivacyControls({
  openButton,
  dialog,
  toggle,
  stateLabel,
  saveRegion,
  saveButton,
  notify,
}) {
  if (!openButton || !dialog || !toggle || !stateLabel || !saveRegion || !saveButton) return;

  let savedEnabled = analyticsEnabled();
  let pendingEnabled = savedEnabled;

  const syncState = () => {
    savedEnabled = analyticsEnabled();
    pendingEnabled = savedEnabled;
    toggle.checked = savedEnabled;
    stateLabel.textContent = savedEnabled ? "On" : "Off";
    saveRegion.hidden = true;
    saveButton.disabled = false;
    saveButton.textContent = "Save & Reload";
  };

  syncState();

  const reloadState = takeReloadState();
  if (reloadState) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Number.isFinite(reloadState.scrollY)) window.scrollTo(0, reloadState.scrollY);
      notify?.(reloadState.enabled ? "Analytics enabled." : "Analytics disabled.");
    }));
  }

  openButton.addEventListener("click", () => {
    syncState();
    dialog.showModal();
    document.documentElement.classList.add("has-open-dialog");
  });

  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("has-open-dialog");
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  toggle.addEventListener("change", () => {
    pendingEnabled = toggle.checked;
    stateLabel.textContent = pendingEnabled ? "On" : "Off";
    saveRegion.hidden = pendingEnabled === savedEnabled;
  });

  saveButton.addEventListener("click", () => {
    setAnalyticsEnabled(pendingEnabled);
    if (analyticsEnabled() !== pendingEnabled) {
      notify?.("Your analytics preference could not be saved.");
      syncState();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Applying…";
    storeReloadState(pendingEnabled);
    location.reload();
  });
}
