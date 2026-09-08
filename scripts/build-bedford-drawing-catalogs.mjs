#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { BUILDING_61_DRAWING_CATALOG } from '../src/building-61-drawing-catalog.js';
import { buildDrawingCatalog, compareCatalogs } from '../src/drawing-index-engine.js';

const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA = join(ROOT, 'project-data/bedford');
const SOURCE = join(ROOT, 'project-documents/bedford/drawings');
const MANIFEST = join(DATA, 'manifests/campus-drawing-manifest.json');

const JXA = `function run(argv){ObjC.import('PDFKit');var d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath($(argv[0]))),pages=[];if(!d)return JSON.stringify({pages:[]});for(var i=0;i<Math.min(10,d.pageCount);i++){var p=d.pageAtIndex(i),s=p?ObjC.unwrap(p.string)||'':'';pages.push({pageNumber:i+1,text:s})}return JSON.stringify({pageCount:Number(d.pageCount),pages:pages})}`;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const safe = value => String(value || '').replace(/[^A-Za-z0-9-]/g, '');

export async function extractIndexCandidatePages(filePath, { runner = execFileAsync } = {}) {
	const { stdout } = await runner('osascript', ['-l', 'JavaScript', '-e', JXA, filePath], { maxBuffer: 8 * 1024 * 1024 });
	return JSON.parse(stdout.trim());
}

export async function buildBedfordDrawingCatalogs({
	force = false,
	building = '',
	manifestPath = MANIFEST,
	dataDir = DATA,
	sourceDir = SOURCE,
	extractor = extractIndexCandidatePages,
	generatedAt = new Date().toISOString()
} = {}) {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	const outputDir = join(dataDir, 'drawing-catalogs');
	await mkdir(outputDir, { recursive: true });

	const results = [];
	for (const drawingSet of manifest.drawingSets.filter(item => item.documentType === 'drawing-set' && (!building || item.buildingId === building))) {
		const outputPath = join(outputDir, `building-${safe(drawingSet.buildingId)}.json`);

		if (!force) {
			try {
				const cached = JSON.parse(await readFile(outputPath, 'utf8'));
				if (cached.sourceFingerprint === drawingSet.fingerprint && (drawingSet.buildingId !== '61' || cached.oracleComparison)) {
					results.push({ buildingId: drawingSet.buildingId, status: 'cached', catalog: cached, outputPath });
					continue;
				}
			} catch {
				// Rebuild when the cached file is absent or invalid.
			}
		}

		const started = performance.now();
		try {
			const extracted = await extractor(join(sourceDir, drawingSet.sourceFileName));
			const sourcePageCount = Math.max(0, Number(extracted.pageCount) || Number(drawingSet.pageCount) || 0);
			const catalog = buildDrawingCatalog({
				drawingSet: { ...drawingSet, pageCount: sourcePageCount },
				pages: extracted.pages,
				generatedAt
			});

			if (Number(drawingSet.pageCount) !== sourcePageCount) {
				catalog.reviewItems.push(`Intake manifest page count ${drawingSet.pageCount} was reconciled to source PDF count ${sourcePageCount}.`);
			}

			catalog.durationMs = Math.max(0, performance.now() - started);
			if (drawingSet.buildingId === '61') {
				catalog.oracleComparison = compareCatalogs(catalog.sheets, BUILDING_61_DRAWING_CATALOG);
			}

			const shouldWrite = drawingSet.buildingId !== '61' || catalog.oracleComparison.matches;
			if (shouldWrite) {
				await writeFile(outputPath, json(catalog));
			} else {
				try {
					await readFile(outputPath, 'utf8');
				} catch {
					await writeFile(outputPath, json(catalog));
				}
			}
			results.push({
				buildingId: drawingSet.buildingId,
				status: drawingSet.buildingId === '61' ? (catalog.oracleComparison.matches ? 'oracle-match' : 'needs-review') : catalog.status,
				catalog,
				outputPath
			});
		} catch (error) {
			results.push({ buildingId: drawingSet.buildingId, status: 'failed', error: error.message, catalog: null, outputPath });
		}
	}

	const summary = {
		schemaVersion: 1,
		generatedAt,
		total: results.length,
		ready: results.filter(item => item.catalog && item.catalog.status === 'ready').length,
		needsReview: results.filter(item => item.catalog && item.catalog.status === 'needs-review').length,
		missingIndex: results.filter(item => item.catalog && item.catalog.missingIndex).length,
		failed: results.filter(item => item.status === 'failed').length,
		results: results.map(item => ({
			buildingId: item.buildingId,
			status: item.status,
			sheetCount: item.catalog?.sheetCount || 0,
			durationMs: item.catalog?.durationMs || 0,
			validationErrors: item.catalog?.validationErrors || [],
			outputPath: item.outputPath,
			error: item.error || ''
		}))
	};

	await mkdir(join(dataDir, 'reports'), { recursive: true });
	await writeFile(join(dataDir, 'reports/drawing-catalog-report.json'), json(summary));
	return { results, summary };
}

export async function run(argv = process.argv.slice(2)) {
	const force = argv.includes('--force');
	const building = (argv.find(arg => arg.startsWith('--building=')) || '').slice(11);
	const result = await buildBedfordDrawingCatalogs({ force, building });

	for (const item of result.summary.results) {
		console.log(`${item.buildingId.padEnd(16)} ${item.status.padEnd(14)} ${String(item.sheetCount).padStart(4)} sheets  ${item.durationMs.toFixed(1)} ms${item.validationErrors.length ? `  ${item.validationErrors.join('; ')}` : ''}`);
	}
	console.log(`Catalogs ${result.summary.total} | ready ${result.summary.ready} | review ${result.summary.needsReview} | missing index ${result.summary.missingIndex} | failed ${result.summary.failed}`);
	return result.summary.failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
	process.exitCode = await run();
}
