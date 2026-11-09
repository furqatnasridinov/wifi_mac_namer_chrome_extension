const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mac = "26:fd:83:ea:f1:27";
const other = "a4:b2:39:12:f4:d8";
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise(setImmediate);
};

function storage(initial = {}) {
  const listeners = new Set();
  const state = {
    map: structuredClone(initial),
    writes: 0,
    failGet: false,
    failSet: false,
    emit(map, area = "sync") {
      const oldValue = state.map;
      if (area === "sync") state.map = structuredClone(map);
      for (const listener of listeners) listener({ macMap: { oldValue, newValue: map } }, area);
    }
  };
  state.chrome = {
    storage: {
      onChanged: { addListener: (listener) => listeners.add(listener) },
      sync: {
        async get() {
          if (state.failGet) throw new Error("Read failed");
          return { macMap: structuredClone(state.map) };
        },
        async set({ macMap }) {
          if (state.failSet) throw new Error("Write failed");
          state.writes += 1;
          state.emit(structuredClone(macMap));
        }
      }
    }
  };
  return state;
}

function page(t, html, store, script) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://10.0.0.10/status.asp" });
  t.after(() => dom.window.close());
  dom.window.chrome = store.chrome;
  dom.window.eval(source("mac.js") + "\n" + source(script));
  return dom.window;
}

function input(window, id, value) {
  const field = window.document.getElementById(id);
  field.value = value;
  field.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  return field;
}

function submit(window) {
  window.document.getElementById("device-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

test("MAC parser accepts complete compact, colon and dash formats without discarding invalid characters", () => {
  const parser = vm.runInNewContext(source("mac.js") + "\nMacAddress");
  for (const value of ["26fd83eaf127", "26FD83EAF127", mac, "26-FD-83-EA-F1-27", "  26fd83eaf127\n"]) {
    assert.equal(parser.format(value), mac);
  }
  for (const value of ["", "26fd83eaf12", "26fd83eaf1270", "26:fd-83:ea:f1:27", "26fd83eaf12g", "26fd83eaf127!", "26 fd 83 ea f1 27", null]) {
    assert.equal(parser.format(value), null, String(value));
  }
  assert.deepEqual({ ...parser.normalizeMap({ [mac]: " TV ", bad: "bad", [other]: {} }) }, { [mac]: "TV" });
});

test("paste inserts colons immediately; submitting saves canonical MAC and clears fields after success", async (t) => {
  const store = storage();
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  const field = input(window, "mac", "26fd83eaf127");
  assert.equal(field.value, mac);
  assert.equal(field.selectionStart, 17);
  input(window, "name", "  Living Room TV  ");
  submit(window);
  await settle();
  assert.deepEqual(store.map, { [mac]: "Living Room TV" });
  assert.equal(field.value, "");
  assert.match(window.document.querySelector("#list").textContent, /Living Room TV/);
});

test("typing a compact address formats only when complete, and invalid paste is rejected", async (t) => {
  const store = storage();
  const window = page(t, source("popup.html"), store, "popup.js");
  for (let length = 1; length < 12; length++) {
    const partial = "26fd83eaf127".slice(0, length);
    assert.equal(input(window, "mac", partial).value, partial);
  }
  assert.equal(input(window, "mac", "26FD83EAF127").value, mac);
  input(window, "mac", "26fd83eaf127!");
  input(window, "name", "TV");
  submit(window);
  await settle();
  assert.equal(store.writes, 0);
  assert.match(window.document.getElementById("error").textContent, /hexadecimal/);
});

test("empty names are rejected and equivalent MAC spellings update one entry", async (t) => {
  const store = storage({ [mac]: "Old name" });
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  input(window, "mac", "26-FD-83-EA-F1-27");
  input(window, "name", "   ");
  submit(window);
  await settle();
  assert.equal(store.writes, 0);
  input(window, "name", "New name");
  submit(window);
  await settle();
  assert.deepEqual(store.map, { [mac]: "New name" });
  assert.equal(window.document.querySelectorAll("li").length, 1);
});

test("device names render as literal text, never HTML", async (t) => {
  const name = '<img src=x onerror="alert(1)"><button>Injected</button>';
  const window = page(t, source("popup.html"), storage({ [mac]: name }), "popup.js");
  await settle();
  assert.equal(window.document.querySelectorAll("img").length, 0);
  assert.equal(window.document.querySelector(".device-name").textContent, name + " →");
  assert.equal(window.document.querySelectorAll("#list button").length, 1);
});

test("failed saves preserve input and existing entries and permit retry", async (t) => {
  const store = storage({ [other]: "Phone" });
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  store.failSet = true;
  input(window, "mac", "26fd83eaf127");
  input(window, "name", "TV");
  submit(window);
  await settle();
  assert.equal(window.document.getElementById("mac").value, mac);
  assert.equal(window.document.getElementById("name").value, "TV");
  assert.equal(window.document.getElementById("add").disabled, false);
  assert.deepEqual(store.map, { [other]: "Phone" });
  assert.match(window.document.getElementById("error").textContent, /Could not save/);
  store.failSet = false;
  submit(window);
  await settle();
  assert.equal(store.map[mac], "TV");
});

test("deleting reads the latest map instead of erasing newer entries; failure preserves the row", async (t) => {
  const store = storage({ [mac]: "TV" });
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  store.map[other] = "New phone";
  store.failSet = true;
  window.document.querySelector(".delete").click();
  await settle();
  assert.equal(window.document.querySelectorAll("li").length, 1);
  assert.equal(store.map[mac], "TV");
  store.failSet = false;
  window.document.querySelector(".delete").click();
  await settle();
  assert.deepEqual(store.map, { [other]: "New phone" });
  assert.match(window.document.getElementById("list").textContent, /New phone/);
});

test("repeated submits while saving write only once", async (t) => {
  const store = storage();
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  let finish;
  const set = store.chrome.storage.sync.set;
  store.chrome.storage.sync.set = (value) => new Promise((resolve) => { finish = async () => { await set(value); resolve(); }; });
  input(window, "mac", "26fd83eaf127");
  input(window, "name", "TV");
  submit(window);
  submit(window);
  await settle();
  assert.equal(window.document.getElementById("add").disabled, true);
  await finish();
  await settle();
  assert.equal(store.writes, 1);
});

test("popup observes sync changes and ignores a stale initial read", async (t) => {
  const store = storage();
  let finish;
  store.chrome.storage.sync.get = () => new Promise((resolve) => { finish = resolve; });
  const window = page(t, source("popup.html"), store, "popup.js");
  store.emit({ [mac]: "Latest name" });
  finish({ macMap: { [mac]: "Old name" } });
  await settle();
  assert.match(window.document.getElementById("list").textContent, /Latest name/);
  store.emit({}, "local");
  assert.equal(window.document.querySelectorAll("li").length, 1);
  store.emit({});
  assert.equal(window.document.querySelectorAll("li").length, 0);
});

test("storage read failures are visible in the popup and do not cause writes", async (t) => {
  const store = storage();
  store.failGet = true;
  const window = page(t, source("popup.html"), store, "popup.js");
  await settle();
  assert.match(window.document.getElementById("error").textContent, /Could not load/);
  input(window, "mac", mac);
  input(window, "name", "TV");
  submit(window);
  await settle();
  assert.equal(store.writes, 0);
  assert.equal(window.document.getElementById("mac").value, mac);
});

test("a successful local save supersedes an initial read even before onChanged arrives", async (t) => {
  const store = storage();
  let finishInitialRead;
  let reads = 0;
  store.chrome.storage.sync.get = () => {
    if (reads++ === 0) return new Promise((resolve) => { finishInitialRead = resolve; });
    return Promise.resolve({ macMap: {} });
  };
  store.chrome.storage.sync.set = async ({ macMap }) => { store.map = structuredClone(macMap); };
  const window = page(t, source("popup.html"), store, "popup.js");
  input(window, "mac", mac);
  input(window, "name", "Just saved");
  submit(window);
  await settle();
  finishInitialRead({ macMap: {} });
  await settle();
  assert.match(window.document.getElementById("list").textContent, /Just saved/);
});

test("router names update live and deletion restores original MAC text and markup", async (t) => {
  const original = " 26-FD-83-EA-F1-27 ";
  const store = storage({ [mac]: "TV" });
  const window = page(t, `<table><tr><td><a href="#device">${original}</a><button>Details</button></td></tr></table>`, store, "content.js");
  const link = window.document.querySelector("a");
  const button = window.document.querySelector("button");
  let clicks = 0;
  button.addEventListener("click", () => clicks++);
  await settle();
  assert.equal(link.textContent, "TV");
  store.emit({ [mac]: "Bedroom TV" });
  assert.equal(link.textContent, "Bedroom TV");
  store.emit({});
  await settle();
  assert.equal(link.textContent, original);
  assert.equal(window.document.querySelector("a"), link);
  button.click();
  assert.equal(clicks, 1);
});

test("router text changes and dynamically added rows receive current names", async (t) => {
  const store = storage({ [mac]: "TV", [other]: "Phone" });
  const window = page(t, `<table><tbody><tr><td>${mac}</td></tr></tbody></table>`, store, "content.js");
  await settle();
  const cell = window.document.querySelector("td");
  cell.firstChild.nodeValue = "A4B23912F4D8";
  await settle();
  assert.equal(cell.textContent, "Phone");
  const row = window.document.querySelector("tbody").insertRow();
  row.insertCell().textContent = "26fd83eaf127";
  await settle();
  assert.equal(row.textContent, "TV");
  store.emit({});
  await settle();
  assert.equal(cell.textContent, "A4B23912F4D8");
});

test("names that look like other MACs do not cascade or loop", async (t) => {
  const store = storage({ [mac]: other, [other]: mac });
  const window = page(t, `<table><tr><td>${mac}</td><td>${other}</td></tr></table>`, store, "content.js");
  await settle();
  assert.deepEqual([...window.document.querySelectorAll("td")].map((cell) => cell.textContent), [other, mac]);
  store.emit({});
  await settle();
  assert.deepEqual([...window.document.querySelectorAll("td")].map((cell) => cell.textContent), [mac, other]);
});

test("content script ignores stale initial storage and preserves editable fields", async (t) => {
  const store = storage();
  let finish;
  store.chrome.storage.sync.get = () => new Promise((resolve) => { finish = resolve; });
  const window = page(t, `<table><tr><td>${mac}</td><td contenteditable="true">${mac}</td><td><textarea>${mac}</textarea></td></tr></table>`, store, "content.js");
  store.emit({ [mac]: "Current name" });
  finish({ macMap: { [mac]: "Old name" } });
  await settle();
  assert.deepEqual([...window.document.querySelectorAll("td")].map((cell) => cell.textContent), ["Current name", mac, mac]);
});

test("content script can recover from an initial read failure on the next storage change", async (t) => {
  const store = storage();
  store.failGet = true;
  const window = page(t, `<table><tr><td>${mac}</td></tr></table>`, store, "content.js");
  await settle();
  assert.equal(window.document.querySelector("td").textContent, mac);
  store.emit({ [mac]: "Recovered" });
  await settle();
  assert.equal(window.document.querySelector("td").textContent, "Recovered");
});
