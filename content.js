function normalize(mac) {
  return mac.toLowerCase().trim();
}

function replaceMacs(macMap) {
  const cells = document.querySelectorAll("td");

  cells.forEach(td => {
    const text = normalize(td.innerText);
    if (macMap[text]) {
      td.innerText = macMap[text];
    }
  });
}

function init() {
  chrome.storage.sync.get(["macMap"], (result) => {
    const macMap = result.macMap || {};
    replaceMacs(macMap);

    // следим за изменениями страницы
    const observer = new MutationObserver(() => {
      replaceMacs(macMap);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

init();