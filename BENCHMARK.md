# Retrieval Performance Baseline

This baseline measures the production hierarchy-first retrieval implementation in `src/retrieval.js`. It does not measure browser rendering, IndexedDB latency, PDF extraction, network requests, or AI response latency.

## Run

```sh
npm run benchmark
```

The command runs Node with exposed garbage collection and prints a JSON report suitable for archiving or comparison. It has no fixed latency threshold because timings vary by machine. It exits unsuccessfully only if cold and warm retrieval produce different ranked IDs or scores.

## Environment

- Date: 2026-07-30
- Node: v24.14.0
- Platform: Linux 6.8.0-1052-azure x64
- CPU: AMD EPYC 7763 64-Core Processor
- Logical CPUs available: 2
- Memory available: 7.8 GiB
- Explicit garbage collection: enabled

## Dataset

The runner builds deterministic, production-shaped hierarchy records in memory. Records include document, project, library, division, parent, CSI section number, title, path, page location, semantic metadata, and cross-reference fields.

| Sections | Words |
|---:|---:|
| 100 | 11,880 |
| 1,000 | 119,520 |
| 2,229 | 996,780 |

No proprietary documents or application-specific evaluation corpus is used.

## Metrics

- Cold retrieval includes hierarchy-index construction, section analysis, corpus statistics, scoring, and ranking.
- Warm retrieval is the median of five identical production retrieval calls after caches are populated.
- Hierarchy traversal uses a title/semantic hierarchy query.
- Section lookup uses an exact CSI section number.
- Cross-reference expansion uses a referenced CSI number.
- Invalidation rebuild explicitly clears the production retrieval caches and repeats the primary query.
- Heap growth is `heapUsed` growth from before dataset construction through the first cold query. It is an indicative Node measurement, not retained-cache size.
- Stability compares complete cold and warm ranked ID/score signatures.

## Baseline

| Sections | Cold ms | Warm median ms | Speedup | Traversal ms | Section lookup ms | Cross-reference ms | Rebuild ms | Heap growth MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 138.23 | 41.35 | 3.34× | 32.79 | 12.07 | 30.38 | 92.33 | 2.73 |
| 1,000 | 220.74 | 85.35 | 2.59× | 68.47 | 17.95 | 70.38 | 162.46 | 17.40 |
| 2,229 | 705.18 | 308.75 | 2.28× | 221.42 | 55.39 | 114.87 | 540.91 | 55.46 |

Cold and warm results were identical for every workload. Hierarchy narrowing activated for the 2,229-section workload; the smaller workloads fit within the retrieval candidate limits.

## Comparing Future Changes

Run the benchmark at least three times on the same machine with minimal background load. Compare medians or ratios rather than a single absolute duration. Investigate when:

- cold/warm result stability becomes false;
- warm speedup materially decreases across repeated runs;
- latency ratios regress consistently for more than one workload size;
- heap growth increases materially without a corresponding capability change; or
- invalidation rebuild stops tracking cold-query behavior.

Record the Node version, CPU, available logical CPUs, and commit SHA with future results. Do not compare absolute browser and Node timings.

## Limitations

- Synthetic records represent the shape and approximate size of production specifications but not every linguistic distribution.
- Node memory measurements include the generated dataset, runtime allocations, and garbage-collector timing.
- Internal phases are intentionally measured through public production retrieval behavior; index construction is part of the cold metric rather than a private-function microbenchmark.
- No browser runtime was available for this baseline, so Source Inspector responsiveness and browser IndexedDB invalidation were not measured.
