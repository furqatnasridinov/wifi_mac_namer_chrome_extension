(() => {
  let macMap = Object.create(null);
  let storageRevision = 0;
  const replacements = new WeakMap();

  function replaceMacs() {
    document.querySelectorAll("td").forEach((cell) => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement.closest("script, style, textarea, [contenteditable]")) continue;

        let replacement = replacements.get(node);
        // A router refresh may reuse the same text node for another device.
        if (replacement && node.nodeValue !== replacement.displayed) {
          replacements.delete(node);
          replacement = undefined;
        }

        const original = replacement ? replacement.original : node.nodeValue;
        const mac = MacAddress.format(original);
        if (!mac) continue;

        const displayed = macMap[mac] ?? original;
        if (displayed === original) replacements.delete(node);
        else replacements.set(node, { original, displayed });

        // Preserve surrounding links, buttons and router event handlers.
        if (node.nodeValue !== displayed) node.nodeValue = displayed;
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.macMap) return;
    storageRevision += 1;
    macMap = MacAddress.normalizeMap(changes.macMap.newValue);
    replaceMacs();
  });

  const observer = new MutationObserver(replaceMacs);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });

  const revision = storageRevision;
  chrome.storage.sync.get(["macMap"]).then((result) => {
    if (revision !== storageRevision) return;
    macMap = MacAddress.normalizeMap(result.macMap);
    replaceMacs();
  }).catch(() => {
    console.warn("WiFi MAC Namer: could not load saved device names.");
  });
})();
