// Shared by the popup and the router content script.
const MacAddress = (() => {
  function format(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    const compact = /^[0-9a-f]{12}$/i.test(text);
    const colonSeparated = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(text);
    const dashSeparated = /^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$/i.test(text);
    if (!compact && !colonSeparated && !dashSeparated) return null;
    return text.toLowerCase().replace(/[:-]/g, "").match(/.{2}/g).join(":");
  }

  function normalizeMap(value) {
    const map = Object.create(null);
    if (!value || typeof value !== "object" || Array.isArray(value)) return map;
    for (const [key, name] of Object.entries(value)) {
      const mac = format(key);
      if (mac && typeof name === "string" && name.trim()) map[mac] = name.trim();
    }
    return map;
  }
  return { format, normalizeMap };
})();
