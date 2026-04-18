# WiFi MAC Namer (Chrome Extension)

A Chrome extension that replaces MAC addresses in your router admin panel with human-readable device names.

## Overview

Many router admin panels display connected devices only by MAC address, which is difficult to read and manage.  
This extension allows you to assign custom names to MAC addresses and automatically replaces them in the UI.

Example:
a4:b2:39:12:f4:d8 → Studio iMac


---

## Features

- Replace MAC addresses with custom device names
- Simple UI for managing devices
- Persistent storage using `chrome.storage`
- Automatic DOM updates (works even if the page refreshes dynamically)
- Clean, modern UI design
- Strict MAC validation (`xx:xx:xx:xx:xx:xx`)

---

## Supported Format

Only the following MAC address format is accepted:
1a:44:ac:fc:81:b0

Not supported:
1a44acfc81b0
1A-44-AC-FC-81-B0


---

## Installation

1. Download or clone this repository
2. Open Chrome and go to:chrome://extensions
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

---

## Usage

1. Open your router admin panel  
Example: http://10.0.0.10

2. Click the extension icon

3. Add a device:
- Enter MAC address
- Enter device name
- Click **Add Device**

4. The extension will automatically replace MAC addresses on the page

---

## How It Works

- The extension injects a content script into the router page
- It scans all `<td>` elements for "MAC addresses"
- Matches them with saved entries
- Replaces MAC with device name in real-time
- Uses `MutationObserver` to handle dynamic updates

---

## Project Structure

mac-namer-extension/
├── manifest.json
├── content.js # DOM replacement logic
├── popup.html # UI
├── popup.js # UI logic + validation
└── style.css # Styling


---

## Permissions

- `storage` — to save MAC → name mappings
- `host_permissions` — to access router page (e.g. `http://10.0.0.10/*`)

---

## Limitations

- Works only on specified router URL
- Only replaces text visually (does not modify router settings)
- Depends on page structure (HTML changes may break detection)

---

## Future Improvements

- Edit existing devices
- Import / Export JSON
- Auto-detect vendor from MAC (OUI lookup)
- Support multiple routers
- Search and filtering

---

## License

MIT
