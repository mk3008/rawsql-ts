import type { QueryUsageClauseAnchor, QueryUsageLocation } from './types';

const MAX_SNIPPET_LENGTH = 200;
const MAX_STATEMENT_CACHE_SIZE = 256;

interface LocatedText {
  location: QueryUsageLocation | null;
  snippet: string;
  ambiguous: boolean;
}

interface OccurrenceRange {
  start: number;
  end: number;
}

interface ClauseMarker {
  start: number;
  end: number;
  keyword: string;
}

interface StatementLocationCache {
  clauseMarkers: ClauseMarker[];
}

const statementCache = new Map<string, StatementLocationCache>();

export function clearStatementCache(): void {
  statementCache.clear();
}

/**
 * Locate the best matching occurrence in a statement and project it to file-relative coordinates.
 */
export function locateUsageText(params: {
  statementText: string;
  statementStartOffsetInFile: number;
  candidates: string[];
  clauseAnchor?: QueryUsageClauseAnchor;
  snippetMode?: 'clause' | 'line';
}): LocatedText {
  const cache = getStatementCache(params.statementText);
  const occurrences = collectOccurrences(params.statementText, params.candidates);
  if (occurrences.length === 0) {
    return {
      location: null,
      snippet: params.statementText.trim(),
      ambiguous: false
    };
  }

  const clauseWindow = params.clauseAnchor
    ? findClauseWindow(cache, params.clauseAnchor)
    : null;

  const selected = selectOccurrence(occurrences, clauseWindow);
  if (!selected) {
    return {
      location: null,
      snippet: extractSnippet(params.statementText, 0, Math.min(params.statementText.length, MAX_SNIPPET_LENGTH)),
      ambiguous: occurrences.length > 1
    };
  }

  const snippet = params.snippetMode === 'line'
    ? extractLineSnippet(params.statementText, selected.start, selected.end)
    : extractClauseSnippet(params.statementText, selected.start, selected.end, clauseWindow);

  return {
    location: buildLocation(params.statementText, params.statementStartOffsetInFile, selected.start, selected.end),
    snippet,
    ambiguous: selected.ambiguous
  };
}

function getStatementCache(statementText: string): StatementLocationCache {
  const cached = statementCache.get(statementText);
  if (cached) {
    // Refresh cache recency on access so older statements are evicted first.
    statementCache.delete(statementText);
    statementCache.set(statementText, cached);
    return cached;
  }

  const clauseMarkers = Array.from(statementText.matchAll(/\b(WHERE|ORDER\s+BY|GROUP\s+BY|HAVING|RETURNING|SET|JOIN|ON|USING|FROM|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/gi))
    .map((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      keyword: match[0].toUpperCase()
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const value = { clauseMarkers };
  setStatementCache(statementText, value);
  return value;
}

function setStatementCache(statementText: string, value: StatementLocationCache): void {
  if (statementCache.has(statementText)) {
    statementCache.delete(statementText);
  }
  statementCache.set(statementText, value);

  // Keep the cache bounded for long-running CLI processes and large batch scans.
  while (statementCache.size > MAX_STATEMENT_CACHE_SIZE) {
    const oldestKey = statementCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    statementCache.delete(oldestKey);
  }
}

function selectOccurrence(
  occurrences: OccurrenceRange[],
  clauseWindow: { anchorStart: number; start: number; end: number } | null
): (OccurrenceRange & { ambiguous: boolean }) | null {
  if (!clauseWindow) {
    return occurrences.length > 0
      ? {
          ...occurrences[0],
          ambiguous: occurrences.length > 1
        }
      : null;
  }

  const inWindow = occurrences.filter((occurrence) =>
    occurrence.start >= clauseWindow.start &&
    occurrence.start < clauseWindow.end
  );
  const candidates = inWindow.length > 0
    ? inWindow
    : occurrences.filter((occurrence) => occurrence.start >= clauseWindow.start);
  const selectedPool = candidates.length > 0 ? candidates : occurrences;
  if (selectedPool.length === 0) {
    return null;
  }

  const selected = [...selectedPool].sort((left, right) =>
    Math.abs(left.start - clauseWindow.start) - Math.abs(right.start - clauseWindow.start) ||
    left.start - right.start ||
    (right.end - right.start) - (left.end - left.start)
  )[0];

  return {
    ...selected,
    ambiguous: selectedPool.length > 1
  };
}

function findClauseWindow(
  cache: StatementLocationCache,
  clauseAnchor: QueryUsageClauseAnchor
): { anchorStart: number; start: number; end: number } | null {
  const anchorPattern = clauseAnchor.tokens.join(' ').toUpperCase();
  const anchor = cache.clauseMarkers.find((marker) => marker.keyword === anchorPattern);
  if (!anchor) {
    return null;
  }

  const nextClause = cache.clauseMarkers.find((marker) => marker.start > anchor.end);
  return {
    anchorStart: anchor.start,
    start: anchor.end,
    end: nextClause?.start ?? Number.MAX_SAFE_INTEGER
  };
}

function collectOccurrences(statementText: string, candidates: string[]): OccurrenceRange[] {
  const occurrences: OccurrenceRange[] = [];
  for (const candidate of Array.from(new Set(candidates.filter(Boolean)))) {
    const pattern = buildCandidatePattern(candidate);
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
  return dedupeOccurrences(occurrences);
}

function buildCandidatePattern(candidate: string): RegExp {
  const parts = candidate.split('.');
  const pattern = parts
    .map((part) => `(?:"${escapeRegex(part)}"|${escapeRegex(part)})`)
    .join('\\s*\\.\\s*');
  return new RegExp(`(?<![A-Za-z0-9_])${pattern}(?![A-Za-z0-9_])`, 'gi');
}

function dedupeOccurrences(occurrences: OccurrenceRange[]): OccurrenceRange[] {
  const sorted = [...occurrences].sort((left, right) =>
    left.start - right.start ||
    (right.end - right.start) - (left.end - left.start) ||
    left.end - right.end
  );
  const deduped: OccurrenceRange[] = [];
  for (const occurrence of sorted) {
    const duplicate = deduped.find((entry) =>
      (entry.start === occurrence.start && entry.end === occurrence.end) ||
      (occurrence.start >= entry.start && occurrence.end <= entry.end)
    );
    if (!duplicate) {
      deduped.push(occurrence);
    }
  }
  return deduped.sort((left, right) =>
    left.start - right.start ||
    (right.end - right.start) - (left.end - left.start)
  );
}

function clampSnippetEnd(selectedEnd: number, clauseEnd: number): number {
  return Math.min(Math.max(selectedEnd, 0) + MAX_SNIPPET_LENGTH, clauseEnd);
}

function extractClauseSnippet(
  statementText: string,
  selectedStart: number,
  selectedEnd: number,
  clauseWindow: { anchorStart: number; start: number; end: number } | null
): string {
  const snippetStart = clauseWindow ? clauseWindow.anchorStart : selectedStart;
  const snippetEnd = clampSnippetEnd(selectedEnd, clauseWindow?.end ?? statementText.length);
  return extractSnippet(statementText, snippetStart, snippetEnd);
}

function extractLineSnippet(statementText: string, start: number, end: number): string {
  // Keep table snippets anchored to the concrete identifier line so the reason for the match is obvious.
  const lineStart = statementText.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = statementText.indexOf('\n', end);
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : statementText.length;
  return extractSnippet(statementText, lineStart, lineEnd);
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
  return statementText.slice(Math.max(0, start), Math.min(end, statementText.length)).trim();
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
