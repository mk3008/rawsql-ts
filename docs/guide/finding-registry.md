---
title: Finding Registry
outline: deep
---

# Finding Registry

This guide defines the machine-readable shape used to track dogfooding findings before and after remediation.
The goal is to keep the finding itself separate from the fix, the prevention layer, and the evidence.

## Why this exists

Dogfooding results are easier to act on when every finding is recorded with the same fields.
That makes it possible to:

- classify the failure surface
- choose a prevention layer intentionally
- keep the remediation status explicit
- point at evidence instead of relying on memory

## Registry shape

Each finding entry should carry these fields:

- `id`
- `title`
- `symptom`
- `source`
- `failure_surface`
- `category`
- `severity`
- `detectability`
- `recurrence_risk`
- `desired_prevention_layer`
- `candidate_action`
- `verification_evidence`
- `status`

Recommended status progression:

- `planned`
- `implemented`
- `evidence_collected`
- `verified`

## Reading the example

The example registry at [finding-registry.example.json](./finding-registry.example.json) contains representative findings from the ztd-cli dogfooding work.
It is intentionally small and should be treated as a starting point, not as a complete audit log.

Validate the example registry with `npx ztd findings validate docs/guide/finding-registry.example.json` when you want a deterministic CI check.

## How to use it

When you add a new finding:

- keep the symptom short and concrete
- keep the candidate action focused on one prevention layer
- record the verification evidence as a command, artifact, or both
- move the status forward only when the evidence exists

## Notes

- The registry is meant to be machine-readable.
- The registry should stay stable enough to diff cleanly.
- If a finding does not yet have evidence, keep it in `planned` or `implemented` instead of marking it verified early.
