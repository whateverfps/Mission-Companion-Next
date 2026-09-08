# Mission PMIS Changelog

## 2.0.4 — Deployment Cleanup
- Removed stale 1.2.2 and “Wow Polish” product labels.
- Removed “packaged workbook snapshot” wording and the packaged snapshot script.
- Replaced Bedford-only startup, help, About, map, COR, and report labels with project-neutral language.
- Added dynamic project identity based on the loaded workbook filename.
- Updated generated reports and briefing headers to use the loaded project identity.
- Updated all production cache references and visible version labels to 2.0.4.

## 2.0.3 — Purpose-Built Reports
- Executive Brief now renders leadership health, decisions required, management attention, and two-week look-ahead.
- CM/PM Operations now renders active deliverables, owners, due dates, overdue items, commissioning, pay applications, and shutdown coordination.
- Daily Command Report now renders current campus posture, selected-building priority, today's action queue, and immediate coordination.
- Field Walk Brief now renders selected-building verification items, building records, shutdowns, and field closeout steps.
- Preview buttons now switch to genuinely different report content and Print Current follows the selected report.
- Added a visible current-report title and report-specific supporting panel.

## 2.0.2 — Integration Pass
- Exposed one shared selected-building accessor for the map, workspace, search, health cards, and reports.
- Corrected Building Workspace selection so it follows the actual building dropdown instead of defaulting to the first building.
- Rebuilt Project Health cards as accessible buttons with reliable click handlers and explicit readable colors.
- Added assessment-sheet indexing for room and reference searches such as TR137A.
- Search results now open the correct building and workspace tab.
- Assessment search results show the matching source sheet, row, room/reference, and source detail.
- Search, Project Register, Shutdown Tracker, and Building Workspace now consume the same loaded workbook data model.
- Updated cache references to prevent GitHub Pages from serving stale JavaScript or CSS.

## 2.0.1 — Building Workspace Integration Fix
- Corrected invisible/grey workspace narrative text by isolating workspace colors from inherited application styles.
- Improved Project Register building matching using Building, Linked Assessment, source sheet, and related references.
- Improved Shutdown Tracker matching using multiple possible building and date fields.
- Corrected Systems tab to read the selected building's trade notes.
- Added fallback risk and question counts from active Project Register records when PMIS_Data counts are unavailable.
- Added populated assessment detail, document/evidence, and photo/evidence views.
- Split the overview into Current Status, Next Action, and Key Constraint for easier reading.

# Changelog
## 1.3.8 — Empty Shell Release

- Removed the bundled Bedford workbook from the GitHub stack.
- Removed packaged project data from the JavaScript snapshot.
- Mission PMIS now opens as a clean shell with zero project records.
- Dashboard, reports, registers, and shutdown data populate only after the user loads an Excel workbook.
- Updated status messaging so failed imports do not fall back to stale data.


## 1.3.8 — Reporting Production Pass
- Added dedicated, multi-page print documents for Reports Center and COR Reports.
- Added consistent report headers, project identification, generated date, and footer branding.
- Removed dashboard navigation and controls from printed reports.
- Added repeating table headers, print-safe page breaks, and overflow handling.
- Improved report language so summaries read as operational briefings rather than raw dashboard exports.
- COR printing now respects the selected building filter and omits empty sections.
- Added stronger browser popup guidance when print windows are blocked.

## 1.3.4
- Fixed live Excel import so CM_PM Operations and COR_Report are parsed into the COR Reporting Center.
- Preserved COR report data after loading a workbook instead of replacing it with building-only data.
- Added fallback parsing from the CM/PM manual action register.

# Changelog

## v1.2.4 — GitHub Long-Haul Stack

Prepared Mission PMIS for GitHub Pages, version control, stable releases, and long-term development.

- Added GitHub Pages workflow.
- Added documentation folder.
- Added roadmap, architecture, deployment, and contribution notes.
- Added `.gitignore` to protect workbook/private data.
- Preserved current working application files.

## 1.3.3
- Registered COR Reports in the live app-main left-rail navigation.
- Forced the COR overlay hidden during normal page load.
- Made app-main the single owner of COR open/close state.
- Prevented COR report markup from appearing below the main dashboard.

## 1.3.5 — Complete COR Campus Data
- COR Reports now reads full 30-building section ranges from CM_PM Operations.
- COR_Report remains the concise printable summary instead of limiting the web view.
- All assessment, risk, quality, design, and commissioning rows are available in the COR workspace.

## 1.3.6 — Register Architecture & COR Accordions
- Bundled Bedford VA EHRM PMIS v8.8 as the current Excel source.
- Front end now loads the bundled workbook automatically on GitHub Pages.
- Project_Register is the direct source for COR Sections 8 and 9.
- Shutdown_Tracker is the direct source for active shutdown records.
- CM_PM Operations remains the reporting layer for assessment-derived Sections 1–7.
- COR report sections and Executive Summary now open as collapsed dropdown panels.
- Added Expand All and Collapse All controls; printing expands all sections automatically.
## 2.0.0
- Added project-neutral workbook loading gate.
- Added global project search.
- Added Project Health owner view.
- Added tabbed Building Workspace.
- Expanded report launch center.
- Preserved empty-shell behavior until a workbook is loaded.
## 2.0.5 — Trade Health Source-of-Truth Fix
- Removed synthetic 55% Trade Health values for `Verify` / watch states.
- Trade Health now preserves real numeric/percentage values from Excel when available.
- PASS/complete states display 100%; unverified, failed, N/A, blank, or missing completion states display 0%.
- Removed the unsafe fallback that treated missing trade data as PASS.
- Cache-busted `app-main.js` so GitHub Pages/browser refreshes receive the corrected logic.

