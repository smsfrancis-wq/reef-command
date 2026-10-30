# Reef Command — private aquarium manager (v1)

A standalone, dependency-free, offline-first Progressive Web App for Android and Windows. No Replit credits required.

## What works

- Dashboard showing actual, manually recorded measurements, not synthetic sensor data
- Date-stamped chemistry logging with editable history, target ranges, trend charts, CSV export
- Recurring tasks, completion history, maintenance records, natural seawater deliveries and water changes
- Equipment inventory and service intervals
- Livestock register: current, planned, lost; no invented fish species
- Complete JSON backup and restoration
- Installable Android/Windows PWA, with offline web-app shell **after first HTTPS visit**

## What is not included yet

- No GHL connection (this needs a local-network read-only bridge and testing)
- No background alert notifications
- No automatic sync between phone and PC
- No user accounts or central database
- No photo uploads or automatic backup

## How to run locally on Windows

Double-click `standalone.html` from the parent download, or open `index.html` in a browser. The HTML version has all application features. For a more reliable local environment, serve these files from a local HTTP server (for example `python -m http.server 8000` and browse to `http://localhost:8000`).

## Install as an app on Android and Windows

Host the contents of this folder on any HTTPS static web host, such as GitHub Pages, Cloudflare Pages or another static host you control. There is no back-end and hosting the app code does not expose aquarium records because records are stored in the visitor's local browser storage; however, anyone who knows your website address could open an empty copy of the application. Avoid entering sensitive information beyond aquarium logs.

- Android/Chrome: open the HTTPS URL, browser menu > **Add to Home screen** / **Install app**.
- Windows/Edge: open the HTTPS URL, **... > Apps > Install this site as an app**.
- After the first successful connection, the app shell is cached for offline use.

For GitHub Pages: create a new repository, add the contents of the `reef-command` folder to its root, choose **Settings > Pages > Deploy from branch > main / root**, and use the resulting HTTPS URL. In a public repository the **code is public**, not the locally stored records. Use only if that is acceptable.

## Your data and backups

Your data stays in your browser's `localStorage` (key `reef-command-data-v1`), not on Replit or a cloud service. **Data from your phone will not appear automatically on your PC.** To transfer, download **Settings > Download complete JSON backup** from device A and **Restore JSON backup** on device B. A restore **replaces** existing records on B; there is no automatic merge. Export a backup before clearing browser data, using a private mode, uninstalling, or changing devices. Do not rely on browser storage as your only copy. Browser storage may be limited or unreliable when opening `file://` pages directly.

## Safety

ProfiLux continues independently controlling life support and dosing. The app is not a medical/safety-critical alarm or controller. The defaults are editable reef-keeping references, not automatic treatment recommendations. Initial livestock totals contain approximate/unknown counts and should be corrected when possible.
