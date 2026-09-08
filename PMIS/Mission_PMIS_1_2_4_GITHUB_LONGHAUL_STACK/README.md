# Mission PMIS

**Mission PMIS** is a lightweight engineering operations platform for project readiness, building status, field coordination, executive briefing, and reporting.

The application uses:

- **Excel workbook** as the source of truth.
- **HTML/CSS/JavaScript** as the application interface.
- **Campus maps and engineering plans** as visual navigation layers.
- **GitHub Pages** for optional live hosting.
- **Standalone ZIP** for offline/local distribution.

## Current release

**Version:** 1.2.4 GitHub Long-Haul Stack

## How to run locally

1. Extract the ZIP.
2. Open `index.html`, or run:
   - `START_MISSION_PMIS.cmd`
   - `LAUNCH_MISSION_PMIS.cmd`
3. Load the latest Excel workbook from the top-right workbook control.

Do not run directly from inside the ZIP preview. Extract first so maps, icons, CSS, and JavaScript load correctly.

## How to launch live with GitHub Pages

See: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Repository structure

```text
Mission_PMIS/
├── index.html
├── css/
├── js/
├── assets/
├── docs/
├── releases/
├── .github/workflows/pages.yml
├── CHANGELOG.md
├── VERSION
└── README.md
```

## Development principle

**Excel remains the backend. Mission PMIS is the presentation and operations layer.**

Do not move business logic out of the workbook unless there is a deliberate operational reason.

## Distribution options

### Option 1 — Email ZIP
Send the extracted app package or ZIP to users. They load the latest workbook locally.

### Option 2 — GitHub Pages
Host the app as a link. Users open the link and load the latest workbook locally.

### Option 3 — Future desktop wrapper
Package the same HTML app into a desktop-style launcher.
