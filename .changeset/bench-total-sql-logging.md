---
"type": "chore",
"summary": "Customer summary benchmark now logs all SQL statements and reports total completion times."
---

The customer summary benchmark now collects every SQL statement (setup DDL, seed, repository query, cleanup, and rewritten SQL) into `tmp/customer-summary-stage-costs.jsonl`, and the report/measurements focus on the total time to finish each configured test count rather than per-test averages.
