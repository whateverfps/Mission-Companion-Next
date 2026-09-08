# Mission PMIS Architecture

Mission PMIS is a lightweight engineering operations application.

## Core principle

Excel is the source of truth. HTML/CSS/JavaScript is the presentation layer.

## Current structure

```text
Mission_PMIS/
├── index.html                  # Application entry point
├── css/
│   └── app.css                 # Main UI styling
├── js/
│   ├── app-main.js             # Core app behavior and navigation
│   ├── data-snapshot.js        # Built-in demo/snapshot data
│   ├── engineering-mode.js     # Engineering mode UI
│   ├── meeting-mode.js         # Executive meeting mode UI
│   └── reports-center.js       # Report generation UI
├── assets/
│   ├── campus_map-2.png
│   ├── engineering_site_plan.png
│   ├── engineering_site_plan_landscape.png
│   ├── mission_pmis.ico
│   └── mission_pmis_icon.png
├── docs/
├── releases/
├── START_MISSION_PMIS.cmd
├── LAUNCH_MISSION_PMIS.cmd
└── README.md
```

## Development rule

Each future improvement should touch the smallest possible module:

- Reports change → `js/reports-center.js`
- Engineering mode change → `js/engineering-mode.js`
- Meeting mode change → `js/meeting-mode.js`
- Styling change → `css/app.css`
- General navigation/layout change → `js/app-main.js` and/or `index.html`

## Distribution modes

1. Standalone ZIP for offline/local use.
2. GitHub Pages link for hosted use.
3. Future wrapped desktop application.
