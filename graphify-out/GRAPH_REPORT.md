# Graph Report - stamp-pos  (2026-11-02)

## Corpus Check
- 6 files · ~10,287 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .gs 1)

## Summary
- 99 nodes · 93 edges · 9 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92aff690`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- stress-test.mjs
- pages.yml
- apps-script.yml
- steps
- Product
- Stamp POS — Setup
- steps
- appsscript.json
- deploy

## God Nodes (most connected - your core abstractions)
1. `Product` - 10 edges
2. `steps` - 7 edges
3. `steps` - 7 edges
4. `Stamp POS — Setup` - 6 edges
5. `One-time setup (≈15 min)` - 5 edges
6. `env` - 4 edges
7. `permissions` - 4 edges
8. `deploy` - 4 edges
9. `on` - 3 edges
10. `push` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "stress-test.mjs"
Cohesion: 0.12
Nodes (11): created, edited, endStock, leftovers, N, newQ, PAY, preexisting (+3 more)

### Community 1 - "pages.yml"
Cohesion: 0.14
Nodes (13): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+5 more)

### Community 2 - "apps-script.yml"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, runs-on, jobs, deploy, name, on (+4 more)

### Community 3 - "steps"
Cohesion: 0.18
Nodes (11): steps, CLASPRC_JSON, DEPLOYMENT_ID, SCRIPT_ID, env, name, run, uses (+3 more)

### Community 4 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 5 - "Stamp POS — Setup"
Cohesion: 0.18
Nodes (10): 1. Create the spreadsheet + script project, 2. Let CI log in to Google as you (`clasp`), 3. Tell CI which script to push to, 4. First deployment, Day-to-day, One-time setup (≈15 min), Running locally without CI, Security notes (+2 more)

### Community 6 - "steps"
Cohesion: 0.22
Nodes (9): steps, DEPLOYMENT_ID, env, id, name, run, uses, with (+1 more)

### Community 7 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 8 - "deploy"
Cohesion: 0.33
Nodes (6): environment, runs-on, name, url, jobs, deploy

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `deploy` connect `deploy` to `steps`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `stress-test.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `jobs` connect `deploy` to `pages.yml`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `pages.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `steps` connect `steps` to `deploy`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._