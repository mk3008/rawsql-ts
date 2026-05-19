---
title: ztd-cli Review Authority Model Draft
outline: deep
---

# ztd-cli Review Authority Model Draft

<div class="concept-definition-summary">Draft authority model for ztd-cli concept, policy, generated artifacts, AI review, and CLI checks.</div>

<div class="concept-review-summary dense">
  <div class="concept-summary-top">
    <div class="concept-header-meta">
      <span>id <code>ztd-cli-review-authority-model</code></span>
      <span>format <code>draft markdown</code></span>
    </div>
    <span class="concept-status warn">draft</span>
  </div>
  <div class="concept-primary-statuses">
    <span class="concept-status warn">validation: draft</span>
    <span class="concept-status warn">coverage: partial</span>
    <span class="concept-status warn">open questions present</span>
  </div>
  <div class="concept-summary-row concept-checks">
    <span class="concept-status ok">authority classes: present</span>
    <span class="concept-status ok">generated view boundary: present</span>
    <span class="concept-status ok">AI boundary: present</span>
    <span class="concept-status neutral">rules index: not registered</span>
  </div>
  <div class="concept-related-concepts">
    <a href="./package-concept">Package Concept</a>
    <a href="./testing-policy">Testing Policy</a>
    <a href="./technology-policy">Technology Policy</a>
  </div>
</div>

This document defines who owns review authority for the target `ztd-cli` direction.
It is not the Concept Spec body and does not replace human approval.

## Purpose

The `ztd-cli` direction depends on a clear split between human-owned intent, AI-assisted review, CLI-owned mechanical checks, and generated artifacts.

This model prevents generated output, AI summaries, or implementation convenience from becoming the source of truth for the package concept or policies.

## Authority Classes

### Human-owned Intent

Humans own durable package direction and acceptance of concept/policy changes.

Primary examples:

- Package Concept.
- Testing Policy.
- Review Authority Model.
- Technology Policy.
- Issue goals and explicit human decisions.
- Decisions to deprecate, split, or rename packages.

AI may draft, compare, ask questions, and propose wording.
Those proposals are review input until accepted by a human.

### AI-led Review Management

AI may lead review workflow and consistency checking.

Primary examples:

- Finding contradictions between Package Concept, Testing Policy, Technology Policy, and current implementation.
- Separating current-state facts from target-state concept statements.
- Proposing staged migration plans.
- Reporting risks, blockers, and open decisions.

AI review output is not policy.
It must cite or point to the human-owned source that supports the claim.

### CLI-owned Mechanical Checks

CLI checks own deterministic mechanical detection.

Primary examples:

- Generated mapper drift checks.
- Generated project smoke checks.
- Structured metadata checks.
- Generated review packets or reports.
- Dependency and runtime-free verification scripts once they exist.

CLI output is evidence, not final judgment.
When a generated view is wrong, the source artifact or generator should be fixed.

### Generated Artifacts

Generated artifacts are machine-owned outputs.

Primary examples:

- AOT row mappers.
- Generated test plans.
- Generated analysis files.
- Generated review pages.
- Generated DAO scaffolds when marked as generated.

Generated artifacts must remain reproducible from source artifacts.
Humans review their meaning through source SQL, DDL, query contracts, policies, tests, and drift checks.

## Required Review Posture

Reviews must distinguish:

- target concept versus current implementation;
- human-approved policy versus AI proposal;
- generated evidence versus source of truth;
- runtime-free standard path versus optional advanced runtime libraries.

## Open Questions

- Which ztd-cli policy documents should become structured metadata-backed pages?
- Which CLI checks should be considered merge-blocking once the runtime-free path is implemented?
- Who owns acceptance of advanced runtime package boundaries?
