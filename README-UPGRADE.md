# Reef Command — Triton ICP upgrade

These files were prepared against `smsfrancis-wq/reef-command` on 12 November 2026.

## Changed files

- `triton-icp.js` — new, additive extension module, supporting all 45 elements in the native Triton CSV, auto-report reference, and removing generic Flow from the UI.
- `index.html` — unchanged except for a deferred reference to `triton-icp.js` after `nav-icons.js`.
- `sw.js` — new service worker cache name and includes `triton-icp.js` as an offline asset.

## Deploy

1. Back up Reef Command's data (Settings > Download complete JSON backup).
2. Open the GitHub repository `smsfrancis-wq/reef-command` on the `main` branch.
3. Upload `triton-icp.js` into the repository root, and replace `index.html` and `sw.js` with the supplied versions. Keep all other files unchanged.
4. Allow GitHub Pages to redeploy, then close and reopen the app to pick up its new service worker, refreshing once if needed.
5. Go to Measurements > Import ICP report; select your original `Study - November 12, 2026 (B-lmrdeR).csv` file.
6. The app should detect laboratory `Triton` and report reference `B-lmrdeR` from the file name. Enter sample collection date `2026-11-08` and time `19:00` manually; these are not contained in Triton's export.
7. Preview 45 rows and inspect the reported values before importing. Re-importing the same report will skip duplicates.

The original CSV **does not** have a report-reference field. The importer reads the code in parentheses in the filename; for future exports with an explicit `report_reference`, `report_id`, or `report_code` column (or matching metadata line), it will prefer that value.

This update does not modify existing cloud records or aquarium configuration, and the generic Flow type is not deleted from historical records.

No GitHub deployment was performed from ChatGPT because the current integration returned HTTP 403 for repository updates. Upload the files manually or grant the GitHub connection write access before retrying.
