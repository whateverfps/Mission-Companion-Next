# Mission PMIS Deployment

## GitHub Pages deployment

1. Create a GitHub repository, for example `mission-pmis`.
2. Upload all files from this folder to the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to `main`.
6. GitHub will publish the site at a URL like:
   `https://YOUR-USERNAME.github.io/mission-pmis/`

## Updating the application

1. Replace edited files in the repo.
2. Commit with a clear message, for example:
   `Update executive meeting mode`.
3. Push to `main`.
4. GitHub Actions deploys automatically.

## Updating project data

Mission PMIS reads the Excel workbook locally in the browser. The workbook is not stored in GitHub unless you intentionally add it.

Recommended workflow:

- Keep the app public/private in GitHub.
- Email or distribute updated Excel workbooks separately.
- Users open the live Mission PMIS link and load the latest workbook.

## Desktop app workflow

For local/offline use:

1. Download the repo as ZIP.
2. Extract the ZIP.
3. Run `START_MISSION_PMIS.cmd` or `LAUNCH_MISSION_PMIS.cmd`.

Always extract the ZIP before launching so relative assets load correctly.
