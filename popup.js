const macInput = document.getElementById("mac");
const nameInput = document.getElementById("name");
const form = document.getElementById("device-form");
const addBtn = document.getElementById("add");
const list = document.getElementById("list");
const error = document.getElementById("error");
let saving = false;
let storageRevision = 0;

function formatInput() {
  const formatted = MacAddress.format(macInput.value);
  if (!formatted || formatted === macInput.value) return;

  const caretPosition = (position) => {
    const digits = macInput.value.slice(0, position).replace(/[^0-9a-f]/gi, "").length;
    return digits ? Math.min(17, digits + Math.floor((digits - 1) / 2)) : 0;
  };
  const start = caretPosition(macInput.selectionStart);
  const end = caretPosition(macInput.selectionEnd);
  macInput.value = formatted;
  macInput.setSelectionRange(start, end);
}

macInput.addEventListener("input", formatInput);

function setSaving(value) {
  saving = value;
  addBtn.disabled = value;
  macInput.disabled = value;
  nameInput.disabled = value;
  list.querySelectorAll("button").forEach((button) => { button.disabled = value; });
}

function render(macMap) {
  list.replaceChildren();
  const entries = Object.entries(macMap);
  entries.forEach(([mac, name], index) => {
    const li = document.createElement("li");
    if (index === entries.length - 1) li.classList.add("active");

    const info = document.createElement("div");
    info.className = "device-info";
    const deviceName = document.createElement("div");
    deviceName.className = "device-name";
    deviceName.textContent = name + " ";
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    deviceName.appendChild(arrow);
    const address = document.createElement("div");
    address.className = "device-mac";
    address.textContent = mac;
    info.append(deviceName, address);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", `Delete ${name}`);
    remove.disabled = saving;
    remove.addEventListener("click", () => updateMap((map) => { delete map[mac]; }));
    li.append(info, remove);
    list.appendChild(li);
  });
}

async function updateMap(update) {
  if (saving) return false;
  setSaving(true);
  error.textContent = "";
  try {
    // Read before every write, including deletion, to preserve newer entries.
    const result = await chrome.storage.sync.get(["macMap"]);
    const map = MacAddress.normalizeMap(result.macMap);
    update(map);
    await chrome.storage.sync.set({ macMap: map });
    storageRevision += 1;
    render(map);
    return true;
  } catch {
    error.textContent = "Could not save changes. Please try again.";
    return false;
  } finally {
    setSaving(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving) return;
  error.textContent = "";
  const mac = MacAddress.format(macInput.value);
  const name = nameInput.value.trim();

  if (!mac) {
    error.textContent = "Enter 12 hexadecimal digits, e.g. 26fd83eaf127 or 26:fd:83:ea:f1:27";
    macInput.focus();
    return;
  }
  formatInput();
  if (!name) {
    error.textContent = "Enter device name";
    nameInput.focus();
    return;
  }

  if (await updateMap((map) => { map[mac] = name; })) {
    macInput.value = "";
    nameInput.value = "";
    macInput.focus();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.macMap) return;
  storageRevision += 1;
  render(MacAddress.normalizeMap(changes.macMap.newValue));
});

async function load() {
  const revision = storageRevision;
  try {
    const result = await chrome.storage.sync.get(["macMap"]);
    if (revision === storageRevision) render(MacAddress.normalizeMap(result.macMap));
  } catch {
    if (revision === storageRevision) error.textContent = "Could not load saved devices. Please reopen the extension.";
  }
}

load();
