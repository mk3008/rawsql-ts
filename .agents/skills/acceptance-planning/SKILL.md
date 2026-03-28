---
name: developer-acceptance-planning
description: Draft acceptance items and verification methods for rawsql-ts developer work.
---

# Acceptance Planning

Use this skill when a rawsql-ts developer task needs a decision-complete plan that a reviewer can later compare against the final report without reconstructing the issue or next human decision from memory.

## Use It For
- Turning an issue into explicit acceptance items.
- Writing a verification method for each item.
- Recording assumptions and working rules before implementation starts.
- Making the source issue and why it matters visible in the plan itself.
- Creating a plan that the final PR report can mirror without re-deriving context.
- Making the expected human decision points visible before implementation starts.

## Workflow
1. State the developer-only scope.
2. Identify the source issue and explain why it matters.
3. Extract the smallest useful set of acceptance items or decision points.
4. Attach a verification method to each item.
5. Note assumptions, working rules, and what the human will need to decide after execution.
6. If the task is broad, hand the plan to the planning subagent for decomposition.

## Output Shape
- Source issue
- Why it matters
- Acceptance items
- Decision points
- Verification methods
- Assumptions
- Working rules

## Constraints
- Keep the plan focused on rawsql-ts developer work.
- Do not add customer-oriented guidance.
- Do not omit the source issue or why it matters.
- Do not leave verification methods implicit.
