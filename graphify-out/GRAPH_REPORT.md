# Graph Report - stamp-pos  (2026-10-18)

## Corpus Check
- 4 files · ~10,287 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .gs 1)

## Summary
- 46 nodes · 42 edges · 5 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92aff690`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- stress-test.mjs
- Product
- appsscript.json
- Stamp POS — Setup
- One-time setup (≈15 min)

## God Nodes (most connected - your core abstractions)
1. `Product` - 10 edges
2. `Stamp POS — Setup` - 6 edges
3. `One-time setup (≈15 min)` - 5 edges
4. `webapp` - 3 edges
5. `timeZone` - 1 edges
6. `exceptionLogging` - 1 edges
7. `runtimeVersion` - 1 edges
8. `executeAs` - 1 edges
9. `access` - 1 edges
10. `N` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (5 total, 0 thin omitted)

### Community 0 - "stress-test.mjs"
Cohesion: 0.12
Nodes (11): created, edited, endStock, leftovers, N, newQ, PAY, preexisting (+3 more)

### Community 1 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 2 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 3 - "Stamp POS — Setup"
Cohesion: 0.33
Nodes (5): Day-to-day, Running locally without CI, Security notes, Stamp POS — Setup, Troubleshooting

### Community 4 - "One-time setup (≈15 min)"
Cohesion: 0.40
Nodes (5): 1. Create the spreadsheet + script project, 2. Let CI log in to Google as you (`clasp`), 3. Tell CI which script to push to, 4. First deployment, One-time setup (≈15 min)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Stamp POS — Setup` connect `Stamp POS — Setup` to `One-time setup (≈15 min)`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `stress-test.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `One-time setup (≈15 min)` connect `One-time setup (≈15 min)` to `Stamp POS — Setup`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._