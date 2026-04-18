const macInput = document.getElementById("mac");
const nameInput = document.getElementById("name");
const addBtn = document.getElementById("add");
const list = document.getElementById("list");
const error = document.getElementById("error");

function normalize(mac) {
  return mac.toLowerCase().replace(/[^a-f0-9]/g, "");
}

// валидатор MAC
function isValidMac(mac) {
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac.trim());
}

// формат в красивый вид
function formatMac(mac) {
  const clean = normalize(mac);
  return clean.match(/.{1,2}/g)?.join(":") || mac;
}

function load() {
  chrome.storage.sync.get(["macMap"], (result) => {
    render(result.macMap || {});
  });
}

function save(macMap) {
  chrome.storage.sync.set({ macMap });
}

function render(macMap) {
  list.innerHTML = "";

  Object.entries(macMap).forEach(([mac, name], index) => {
    const li = document.createElement("li");

    // выделяем последний как active (как на твоём скрине)
    if (index === Object.keys(macMap).length - 1) {
      li.classList.add("active");
    }

    li.innerHTML = `
      <div class="device-info">
        <div class="device-name">
          ${name} <span>→</span>
        </div>
        <div class="device-mac">${mac}</div>
      </div>
      <button class="delete" data-mac="${mac}">✕</button>
    `;

    li.querySelector(".delete").onclick = () => {
      delete macMap[mac];
      save(macMap);
      render(macMap);
    };

    list.appendChild(li);
  });
}

addBtn.onclick = () => {
  const mac = macInput.value.trim();
  const name = nameInput.value.trim();

  error.innerText = "";

  if (!isValidMac(mac)) {
    error.innerText = "Format: xx:xx:xx:xx:xx:xx";
    return;
  }

  if (!name) {
    error.innerText = "Enter device name";
    return;
  }

  chrome.storage.sync.get(["macMap"], (result) => {
    const macMap = result.macMap || {};

    macMap[mac.toLowerCase()] = name;

    save(macMap);
    render(macMap);

    macInput.value = "";
    nameInput.value = "";
  });
};

load();