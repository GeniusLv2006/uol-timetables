const STORAGE_KEY = "timetablePressProfiles";

// Keeps only named profiles that are objects; their fields are checked when applied.
export function loadProfiles() {
  try {
    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return {};
    return Object.fromEntries(Object.entries(profiles).filter(([, profile]) => profile && typeof profile === "object" && !Array.isArray(profile)));
  } catch {
    return {};
  }
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}
