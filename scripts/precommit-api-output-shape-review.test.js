import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  collectApiOutputShapeReviewFindings,
} = require('./precommit-api-output-shape-review.js');

function analyze(stagedFiles, diffByFile, contentByFile = {}) {
  const normalizedDiffByFile = Object.fromEntries(
    Object.entries(diffByFile).map(([filePath, diffText]) => [filePath.replace(/\\/g, '/'), diffText]),
  );
  const normalizedContentByFile = Object.fromEntries(
    Object.entries(contentByFile).map(([filePath, content]) => [filePath.replace(/\\/g, '/'), content]),
  );

  return collectApiOutputShapeReviewFindings(stagedFiles, {
    getDiffForFile: (filePath) => normalizedDiffByFile[filePath] || '',
    readStagedFileContent: (filePath) => normalizedContentByFile[filePath] || '',
  });
}

describe('precommit API output shape review guard', () => {
  it('passes when there are no staged files', () => {
    const result = analyze([], {});

    expect(result.ok).toBe(true);
    expect(result.blockedFiles).toEqual([]);
  });

  it('blocks a Result interface that adds sql string output without a review note', () => {
    const filePath = 'packages/core/src/transformers/ConditionOptimization.ts';
    const result = analyze(
      [filePath],
      {
        [filePath]: [
          'diff --git a/packages/core/src/transformers/ConditionOptimization.ts b/packages/core/src/transformers/ConditionOptimization.ts',
          '+export interface ConditionOptimizationResult {',
          '+  sql: string;',
          '+}',
        ].join('\n'),
      },
    );

    expect(result.ok).toBe(false);
    expect(result.blockedFiles).toHaveLength(1);
    expect(result.blockedFiles[0].filePath).toBe(filePath);
  });

  it('allows the same Result change when the staged diff contains an API output shape review note', () => {
    const filePath = 'packages/core/src/transformers/ConditionOptimization.ts';
    const result = analyze(
      [filePath],
      {
        [filePath]: [
          'diff --git a/packages/core/src/transformers/ConditionOptimization.ts b/packages/core/src/transformers/ConditionOptimization.ts',
          '+// API output shape review: kept result.sql for compatibility; model output is deferred.',
          '+export interface ConditionOptimizationResult {',
          '+  sql: string;',
          '+}',
        ].join('\n'),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.reviewNoteFound).toBe(true);
    expect(result.candidates).toHaveLength(1);
  });

  it('does not block ordinary test file changes', () => {
    const filePath = 'packages/core/tests/transformers/ConditionOptimization.test.ts';
    const result = analyze(
      [filePath],
      {
        [filePath]: [
          'diff --git a/packages/core/tests/transformers/ConditionOptimization.test.ts b/packages/core/tests/transformers/ConditionOptimization.test.ts',
          '+expect(result.sql).toBe("select 1");',
          '+const formattedSql = result.sql;',
        ].join('\n'),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it('warns but does not block docs/api generated output changes', () => {
    const filePath = 'docs/api/functions/optimizeConditions.md';
    const result = analyze(
      [filePath],
      {
        [filePath]: [
          'diff --git a/docs/api/functions/optimizeConditions.md b/docs/api/functions/optimizeConditions.md',
          '+export interface ConditionOptimizationResult',
          '+sql: string',
        ].join('\n'),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.blockedFiles).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('allows matching source changes while the api-output-shape-review skill itself is staged', () => {
    const sourcePath = 'packages/core/src/transformers/ConditionOptimization.ts';
    const skillPath = '.agents/skills/api-output-shape-review/SKILL.md';
    const result = analyze(
      [sourcePath, skillPath],
      {
        [sourcePath]: [
          'diff --git a/packages/core/src/transformers/ConditionOptimization.ts b/packages/core/src/transformers/ConditionOptimization.ts',
          '+export interface ConditionOptimizationResult {',
          '+  sql: string;',
          '+}',
        ].join('\n'),
        [skillPath]: [
          'diff --git a/.agents/skills/api-output-shape-review/SKILL.md b/.agents/skills/api-output-shape-review/SKILL.md',
          '+# API Output Shape Review',
        ].join('\n'),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.skillChanged).toBe(true);
    expect(result.candidates).toHaveLength(1);
  });
});
