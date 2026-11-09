# WiFi MAC Namer (Chrome Extension)

Assign readable names to MAC addresses in the router admin panel at `http://10.0.0.10`.
The extension only changes displayed text; it does not modify router settings.

## Features

- Automatically format pasted or typed MAC addresses once all 12 hexadecimal digits are present.
- Accept compact, colon-separated and dash-separated addresses, in either case.
- Store a single canonical lowercase address, so adding it again updates its name.
- Keep device names in `chrome.storage.sync` and update open router tables immediately.
- Restore the original MAC text when a saved name is deleted.
- Support dynamically updated tables and matching router frames without removing links or controls.
- Display device names as plain text and report storage failures without losing entered data.
- Support form submission with Enter and keyboard-accessible deletion.

## Supported formats

All of these become `26:fd:83:ea:f1:27`:

```text
26fd83eaf127
26FD83EAF127
26:fd:83:ea:f1:27
26-FD-83-EA-F1-27
```

Leading/trailing whitespace is allowed. Incomplete addresses, invalid characters,
and mixed separators are rejected rather than silently repaired.

## Installation and updates

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select this project folder.
4. After updating these files, click **Reload** on the extension card and reload open router pages.

Reloading the existing extension preserves its saved devices. Avoid removing it when updating.

## Usage

1. Open the router admin panel at `http://10.0.0.10`.
2. Open the extension popup and paste or type a MAC address.
3. Enter a device name and click **Add Device**, or press Enter.
4. To rename a device, add the same MAC with its new name.
5. Use the delete button to remove a saved name and restore the MAC on open router pages.

## Project structure

```text
manifest.json           Chrome Manifest V3 configuration
mac.js                  Shared address parsing and map normalization
content.js              Live, reversible table-text replacement
popup.html / popup.js   Device management form
style.css               Popup styling
test/extension.test.js  Regression tests (Node.js + jsdom)
```

## Development checks

Use Node.js 26 or a compatible version supported by jsdom, install development
dependencies and run the regression suite:

```sh
npm ci
npm test
```

The extension itself requires no build or runtime npm dependencies. Tests exercise
MAC parsing, popup input and storage failures, safe rendering, live updates,
deletions, dynamic table changes and stale asynchronous responses using a mocked
Chrome Storage API. Confirm actual extension loading and frame injection in Chrome
when releasing an update.

## Permissions and limitations

- `storage`: persist the MAC-to-name mapping using Chrome sync storage.
- Host access remains limited to `http://10.0.0.10/*`, including matching frames.
- Replacement targets text nodes containing a complete MAC inside table cells.
  Editable fields are left intact; other router layouts may require an adapter.
- Sync storage has Chrome quotas. A rejected write is reported and can be retried;
  it is not shown as a successful save.
- Simultaneous edits from different Chrome installations are subject to Chrome's
  sync conflict behavior; the mapping is not a transactional multi-user database.

## License

MIT
