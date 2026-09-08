# Bedford drawing intake

Place Bedford building drawing-set PDF files in this folder. Keep their issued filenames unless a correction is genuinely required.

- Do not place specification books, reports, submittals, or correspondence here.
- Do not commit project PDFs.
- Run `npm run ingest:bedford:drawings:dry-run` after adding files.
- Review the classification report, then run `npm run ingest:bedford:drawings`.
- Run `npm run validate:bedford:drawings` to validate the source and generated manifests.

The intake command fingerprints files and reads minimal PDF structure for classification. It does not perform full drawing analysis or rasterization.
