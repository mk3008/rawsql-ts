import type { QueryUsageLocation } from './types';

interface LocatedText {
  location: QueryUsageLocation | null;
  snippet: string;
  ambiguous: boolean;
}

/**
 * Locate the first matching candidate in a statement and project it to file-relative coordinates.
 */
export function locateUsageText(params: {
  statementText: string;
  statementStartOffsetInFile: number;
  candidates: string[];
}): LocatedText {
  const occurrences = collectOccurrences(params.statementText, params.candidates);
  if (occurrences.length === 0) {
    return {
      location: null,
      snippet: params.statementText.trim(),
      ambiguous: false
    };
  }

  const first = occurrences[0];
  return {
    location: buildLocation(params.statementText, params.statementStartOffsetInFile, first.start, first.end),
    snippet: extractSnippet(params.statementText, first.start, first.end),
    ambiguous: occurrences.length > 1
  };
}

function collectOccurrences(statementText: string, candidates: string[]): Array<{ start: number; end: number }> {
  const occurrences: Array<{ start: number; end: number }> = [];
  for (const candidate of Array.from(new Set(candidates.filter(Boolean)))) {
    const escaped = escapeRegex(candidate);
    const pattern = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'gi');
    for (const match of statementText.matchAll(pattern)) {
      const start = match.index ?? -1;
      if (start < 0) {
        continue;
      }
      occurrences.push({
        start,
        end: start + match[0].length
      });
    }
  }
  return occurrences.sort((a, b) => a.start - b.start || a.end - b.end);
}

function buildLocation(
  statementText: string,
  statementStartOffsetInFile: number,
  statementOffsetStart: number,
  statementOffsetEnd: number
): QueryUsageLocation {
  const start = offsetToLineColumn(statementText, statementOffsetStart);
  const end = offsetToLineColumn(statementText, statementOffsetEnd);
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    fileOffsetStart: statementStartOffsetInFile + statementOffsetStart,
    fileOffsetEnd: statementStartOffsetInFile + statementOffsetEnd,
    statementOffsetStart,
    statementOffsetEnd
  };
}

function extractSnippet(statementText: string, start: number, end: number): string {
  const lineStart = statementText.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = statementText.indexOf('\n', end);
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : statementText.length;
  return statementText.slice(lineStart, lineEnd).trim();
}

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lines = text.slice(0, safeOffset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
