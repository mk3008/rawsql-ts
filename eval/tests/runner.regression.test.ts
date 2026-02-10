import { describe, expect, it } from 'vitest';

import { __internal } from '../runner';

describe('runner regression guards', () => {
  it('detects read-only blocker from observed phrases', () => {
    const stdoutHead = [
      'Write access is denied in this environment (read-only sandbox).',
      'Attempts to create/update files via `apply_patch` were rejected.'
    ].join('\n');
    const result = __internal.detectAiExecutionBlocker(stdoutHead, '');
    expect(result.detected).toBe(true);
    expect(result.kind).toBe('read_only');
  });

  it('does not detect blocker on ambiguous wording', () => {
    const stdoutHead = 'Workspace check completed. No blocker keywords were observed.';
    const stderrHead = 'read only checks passed';
    const result = __internal.detectAiExecutionBlocker(stdoutHead, stderrHead);
    expect(result.detected).toBe(false);
    expect(result.kind).toBe('none');
  });

  it('treats marker-only touched files as non-effective write', () => {
    const result = __internal.analyzeAiTouchedFiles(['tests/__eval_ai_marker__.txt']);
    expect(result.markerOnly).toBe(true);
    expect(result.nonMarkerTouchedCount).toBe(0);
    expect(result.effectiveWrite).toBe(false);
  });

  it('treats non-marker touch as effective write', () => {
    const result = __internal.analyzeAiTouchedFiles(['tests/__eval_ai_marker__.txt', 'src/sql/x.sql']);
    expect(result.markerOnly).toBe(false);
    expect(result.nonMarkerTouchedCount).toBe(1);
    expect(result.effectiveWrite).toBe(true);
  });
});
