import { WhereClause } from '../models/Clause';
import { Lexeme, TokenType } from '../models/Lexeme';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../models/SelectQuery';
import {
    BinaryExpression,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    RawString,
    SqlParameterValue,
    ValueComponent
} from '../models/ValueComponent';
import { SelectQueryParser } from '../parsers/SelectQueryParser';
import { SqlTokenizer } from '../parsers/SqlTokenizer';
import { ValueParser } from '../parsers/ValueParser';
import { ParameterCollector } from './ParameterCollector';

export type OptionalConditionPruningParameters = Record<string, SqlParameterValue>;
export type OptionalConditionParameterState = 'absent' | 'present' | 'unknown';
export type OptionalConditionParameterStates = Record<string, OptionalConditionParameterState>;
export type SupportedOptionalConditionBranchKind = 'expression';

export interface SupportedOptionalConditionBranch {
    query: SimpleSelectQuery;
    parameterName: string;
    expression: ValueComponent;
    kind: SupportedOptionalConditionBranchKind;
}

export interface OptionalConditionSourceRange {
    start: number;
    end: number;
    text: string;
}

export interface SupportedOptionalConditionBranchSpan {
    parameterName: string;
    kind: SupportedOptionalConditionBranchKind;
    sourceRange: OptionalConditionSourceRange;
    removalRange: OptionalConditionSourceRange;
}

const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    return expression instanceof BinaryExpression && expression.operator.value.trim().toLowerCase() === operator;
};

const unwrapSingleOuterParen = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;

    // Generated SQL often nests harmless wrapper parentheses, so peel them before shape matching.
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }

    return candidate;
};

const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapSingleOuterParen(expression);
    if (!isBinaryOperator(candidate, 'and')) {
        return [expression];
    }

    return [
        ...collectTopLevelAndTerms(candidate.left),
        ...collectTopLevelAndTerms(candidate.right)
    ];
};

const collectTopLevelOrTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapSingleOuterParen(expression);
    if (!isBinaryOperator(candidate, 'or')) {
        return [expression];
    }

    return [
        ...collectTopLevelOrTerms(candidate.left),
        ...collectTopLevelOrTerms(candidate.right)
    ];
};

const isNullLiteral = (expression: ValueComponent): boolean => {
    return (
        (expression instanceof LiteralValue && expression.value === null) ||
        (expression instanceof RawString && expression.value.trim().toLowerCase() === 'null')
    );
};

const isTrueSentinel = (expression: ValueComponent): boolean => {
    const candidate = unwrapSingleOuterParen(expression);
    if (candidate instanceof LiteralValue) {
        return candidate.value === true;
    }

    if (!isBinaryOperator(candidate, '=')) {
        return false;
    }

    return (
        candidate.left instanceof LiteralValue &&
        candidate.right instanceof LiteralValue &&
        candidate.left.value === 1 &&
        candidate.right.value === 1
    );
};

const getGuardedParameterName = (expression: ValueComponent): string | null => {
    const candidate = unwrapSingleOuterParen(expression);
    if (!isBinaryOperator(candidate, 'is')) {
        return null;
    }

    if (!(candidate.left instanceof ParameterExpression) || !isNullLiteral(candidate.right)) {
        return null;
    }

    return candidate.left.name.value;
};

const getUniqueParameterNames = (expression: ValueComponent): Set<string> => {
    return new Set(ParameterCollector.collect(expression).map(parameter => parameter.name.value));
};

const isSupportedMeaningfulBranch = (expression: ValueComponent, parameterName: string): boolean => {
    const candidate = unwrapSingleOuterParen(expression);
    if (candidate instanceof ParameterExpression) {
        return false;
    }

    const parameterNames = getUniqueParameterNames(candidate);
    if (parameterNames.size !== 1 || !parameterNames.has(parameterName)) {
        return false;
    }

    // Keep the matcher conservative enough to avoid pruning tautologies or half-authored branches.
    return !(candidate instanceof LiteralValue || candidate instanceof RawString);
};

const isExplicitPruningTarget = (
    pruningParameters: OptionalConditionPruningParameters,
    parameterName: string
): boolean => {
    return Object.prototype.hasOwnProperty.call(pruningParameters, parameterName);
};

const isKnownAbsentTarget = (
    pruningParameters: OptionalConditionPruningParameters,
    parameterName: string
): boolean => {
    if (!isExplicitPruningTarget(pruningParameters, parameterName)) {
        return false;
    }

    const parameterValue = pruningParameters[parameterName];
    return parameterValue === null || parameterValue === undefined;
};

const shouldPruneOptionalBranch = (
    expression: ValueComponent,
    pruningParameters: OptionalConditionPruningParameters
): boolean => {
    const branch = getSupportedOptionalConditionBranch(expression);
    return branch !== null && isKnownAbsentTarget(pruningParameters, branch.parameterName);
};

const rebuildAndCondition = (terms: ValueComponent[]): ValueComponent | null => {
    if (terms.length === 0) {
        return null;
    }

    let condition = terms[0];
    for (let index = 1; index < terms.length; index += 1) {
        condition = new BinaryExpression(condition, 'and', terms[index]);
    }

    return condition;
};

const pruneSimpleQueryWhereClause = (
    query: SimpleSelectQuery,
    pruningParameters: OptionalConditionPruningParameters
): boolean => {
    if (!query.whereClause) {
        return false;
    }

    const topLevelTerms = collectTopLevelAndTerms(query.whereClause.condition);
    const retainedTerms: ValueComponent[] = [];
    let prunedAnyBranch = false;

    // Only top-level WHERE ... AND ... terms are eligible for pruning in this MVP.
    for (const term of topLevelTerms) {
        if (shouldPruneOptionalBranch(term, pruningParameters)) {
            prunedAnyBranch = true;
            continue;
        }
        retainedTerms.push(term);
    }

    if (!prunedAnyBranch) {
        return false;
    }

    // Cleanup stays intentionally conservative: only drop trivially-true sentinels after pruning.
    const cleanedTerms = retainedTerms.filter(term => !isTrueSentinel(term));
    const rebuiltCondition = rebuildAndCondition(cleanedTerms);

    query.whereClause = rebuiltCondition ? new WhereClause(rebuiltCondition) : null;
    return true;
};

const isSelectQueryNode = (value: unknown): value is SelectQuery => {
    return value instanceof SimpleSelectQuery || value instanceof BinarySelectQuery;
};

const traverseNestedSelectQueries = (
    root: SelectQuery,
    pruningParameters: OptionalConditionPruningParameters
): boolean => {
    let changed = false;
    const visited = new WeakSet<object>();

    const walk = (value: unknown): void => {
        if (!value || typeof value !== 'object') {
            return;
        }

        if (visited.has(value as object)) {
            return;
        }
        visited.add(value as object);

        if (value !== root && isSelectQueryNode(value)) {
            changed = traverseSelectQuery(value, pruningParameters) || changed;
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }

        for (const child of Object.values(value as Record<string, unknown>)) {
            walk(child);
        }
    };

    walk(root);
    return changed;
};

const traverseSelectQuery = (
    query: SelectQuery,
    pruningParameters: OptionalConditionPruningParameters
): boolean => {
    if (query instanceof SimpleSelectQuery) {
        const selfChanged = pruneSimpleQueryWhereClause(query, pruningParameters);
        const nestedChanged = traverseNestedSelectQueries(query, pruningParameters);
        return selfChanged || nestedChanged;
    }

    if (query instanceof BinarySelectQuery) {
        const leftChanged = traverseSelectQuery(query.left, pruningParameters);
        const rightChanged = traverseSelectQuery(query.right, pruningParameters);
        return leftChanged || rightChanged;
    }

    return false;
};

const getSupportedOptionalConditionBranch = (
    expression: ValueComponent
): Omit<SupportedOptionalConditionBranch, 'query' | 'expression'> | null => {
    const orTerms = collectTopLevelOrTerms(expression);
    if (orTerms.length < 2) {
        return null;
    }

    const guardTerms = orTerms
        .map(term => ({ term, parameterName: getGuardedParameterName(term) }))
        .filter((candidate): candidate is { term: ValueComponent; parameterName: string } => candidate.parameterName !== null);

    if (guardTerms.length !== 1) {
        return null;
    }

    const [{ term: guardTerm, parameterName }] = guardTerms;
    const meaningfulTerms = orTerms.filter(term => term !== guardTerm);
    if (meaningfulTerms.length === 0) {
        return null;
    }

    if (!meaningfulTerms.every(term => isSupportedMeaningfulBranch(term, parameterName))) {
        return null;
    }

    return {
        parameterName,
        kind: 'expression'
    };
};

const collectSupportedBranchesFromSimpleQuery = (
    query: SimpleSelectQuery,
    branches: SupportedOptionalConditionBranch[]
): void => {
    if (!query.whereClause) {
        return;
    }

    const topLevelTerms = collectTopLevelAndTerms(query.whereClause.condition);
    for (const term of topLevelTerms) {
        const branch = getSupportedOptionalConditionBranch(term);
        if (!branch) {
            continue;
        }

        branches.push({
            query,
            parameterName: branch.parameterName,
            expression: term,
            kind: branch.kind
        });
    }
};

const collectSupportedBranchesFromSelectQuery = (
    query: SelectQuery,
    branches: SupportedOptionalConditionBranch[]
): void => {
    if (query instanceof SimpleSelectQuery) {
        collectSupportedBranchesFromSimpleQuery(query, branches);
        traverseNestedSelectQueriesForCollection(query, branches);
        return;
    }

    if (query instanceof BinarySelectQuery) {
        collectSupportedBranchesFromSelectQuery(query.left, branches);
        collectSupportedBranchesFromSelectQuery(query.right, branches);
    }
};

const traverseNestedSelectQueriesForCollection = (
    root: SelectQuery,
    branches: SupportedOptionalConditionBranch[]
): void => {
    const visited = new WeakSet<object>();

    const walk = (value: unknown): void => {
        if (!value || typeof value !== 'object') {
            return;
        }

        if (visited.has(value as object)) {
            return;
        }
        visited.add(value as object);

        if (value !== root && isSelectQueryNode(value)) {
            collectSupportedBranchesFromSelectQuery(value, branches);
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }

        for (const child of Object.values(value as Record<string, unknown>)) {
            walk(child);
        }
    };

    walk(root);
};

/**
 * Prunes supported optional WHERE branches when an explicitly targeted parameter is absent-equivalent.
 * For the MVP, only `null` and `undefined` are treated as absent and unsupported shapes remain exact no-op.
 */
export const pruneOptionalConditionBranches = (
    query: SelectQuery,
    pruningParameters: OptionalConditionPruningParameters
): SelectQuery => {
    if (Object.keys(pruningParameters).length === 0) {
        return query;
    }

    traverseSelectQuery(query, pruningParameters);
    return query;
};

/**
 * Collects supported top-level optional condition branches from the query graph.
 * The returned branch expressions keep object identity so callers can move them without re-rendering.
 */
export const collectSupportedOptionalConditionBranches = (
    query: SelectQuery
): SupportedOptionalConditionBranch[] => {
    const branches: SupportedOptionalConditionBranch[] = [];
    collectSupportedBranchesFromSelectQuery(query, branches);
    return branches;
};

/**
 * Collects supported optional condition branches with source-text ranges.
 *
 * The AST collector remains the authority for whether a branch is supported. The range metadata
 * is derived from tokenizer positions so development tools can generate runtime metadata without
 * reparsing SQL in production.
 */
export const collectSupportedOptionalConditionBranchSpans = (
    sql: string
): SupportedOptionalConditionBranchSpan[] => {
    const parsed = SelectQueryParser.parse(sql);
    const supportedBranches = collectSupportedOptionalConditionBranches(parsed);
    if (supportedBranches.length === 0) {
        return [];
    }

    const candidates = collectOptionalConditionSpanCandidates(sql);
    const remainingSupportedCounts = countSupportedBranchesByKey(supportedBranches);
    assertUnambiguousCandidateCounts(candidates, remainingSupportedCounts);
    const spans: SupportedOptionalConditionBranchSpan[] = [];

    for (const candidate of candidates) {
        const key = getSupportedBranchKey(candidate);
        const remainingCount = remainingSupportedCounts.get(key) ?? 0;
        if (remainingCount <= 0) {
            continue;
        }
        spans.push(candidate);
        remainingSupportedCounts.set(key, remainingCount - 1);
    }

    assertNoMissingSupportedBranches(remainingSupportedCounts);
    return spans;
};

interface OptionalConditionSpanCandidate extends SupportedOptionalConditionBranchSpan {
    openParenIndex: number;
    closeParenIndex: number;
}

const getSupportedBranchKey = (
    branch: Pick<SupportedOptionalConditionBranch, 'parameterName' | 'kind'>
): string => `${branch.kind}:${branch.parameterName}`;

const countSupportedBranchesByKey = (
    branches: Pick<SupportedOptionalConditionBranch, 'parameterName' | 'kind'>[]
): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const branch of branches) {
        const key = getSupportedBranchKey(branch);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
};

const assertUnambiguousCandidateCounts = (
    candidates: OptionalConditionSpanCandidate[],
    supportedCounts: Map<string, number>
): void => {
    const candidateCounts = countSupportedBranchesByKey(candidates);
    for (const [key, supportedCount] of supportedCounts) {
        const candidateCount = candidateCounts.get(key) ?? 0;
        if (candidateCount < supportedCount) {
            throw new Error(`Could not locate source range for supported optional condition branch '${key}'.`);
        }
        if (candidateCount > supportedCount) {
            throw new Error(`Ambiguous source ranges for supported optional condition branch '${key}'.`);
        }
    }
};

const assertNoMissingSupportedBranches = (supportedCounts: Map<string, number>): void => {
    const missingKeys = [...supportedCounts.entries()]
        .filter(([, count]) => count > 0)
        .map(([key]) => key);
    if (missingKeys.length > 0) {
        throw new Error(`Could not locate source ranges for supported optional condition branches: ${missingKeys.join(', ')}.`);
    }
};

const collectOptionalConditionSpanCandidates = (sql: string): OptionalConditionSpanCandidate[] => {
    const lexemes = new SqlTokenizer(sql).readLexemes();
    const candidates: OptionalConditionSpanCandidate[] = [];
    const stack: number[] = [];

    for (let index = 0; index < lexemes.length; index += 1) {
        const lexeme = lexemes[index];
        if (isOpenParen(lexeme)) {
            stack.push(index);
            continue;
        }
        if (!isCloseParen(lexeme)) {
            continue;
        }
        const openParenIndex = stack.pop();
        if (openParenIndex === undefined) {
            continue;
        }
        const candidate = buildOptionalConditionSpanCandidate(sql, lexemes, openParenIndex, index);
        if (candidate) {
            candidates.push(candidate);
        }
    }

    return candidates.sort((left, right) => left.sourceRange.start - right.sourceRange.start);
};

const buildOptionalConditionSpanCandidate = (
    sql: string,
    lexemes: Lexeme[],
    openParenIndex: number,
    closeParenIndex: number
): OptionalConditionSpanCandidate | null => {
    const inside = lexemes.slice(openParenIndex + 1, closeParenIndex);
    const orTermRanges = splitTopLevelTermsByKeyword(inside, 'or');
    if (orTermRanges.length < 2) {
        return null;
    }

    const guardTerms = orTermRanges
        .map(range => ({ range, parameterName: getGuardedParameterNameFromLexemes(inside.slice(range.start, range.end)) }))
        .filter((candidate): candidate is { range: LexemeRange; parameterName: string } => candidate.parameterName !== null);
    if (guardTerms.length !== 1) {
        return null;
    }

    const [{ range: guardRange, parameterName }] = guardTerms;
    const meaningfulTerms = orTermRanges.filter(range => range !== guardRange);
    if (meaningfulTerms.length === 0) {
        return null;
    }
    if (!meaningfulTerms.every(range => isSupportedMeaningfulBranchFromLexemes(inside.slice(range.start, range.end), parameterName))) {
        return null;
    }

    const expandedRange = expandWrappingParenRange(lexemes, openParenIndex, closeParenIndex);
    const sourceStart = requiredPosition(lexemes[expandedRange.openParenIndex]).startPosition;
    const sourceEnd = requiredPosition(lexemes[expandedRange.closeParenIndex]).endPosition;
    const removalRange = getRemovalRange(sql, lexemes, expandedRange.openParenIndex, expandedRange.closeParenIndex);

    return {
        parameterName,
        kind: 'expression',
        sourceRange: {
            start: sourceStart,
            end: sourceEnd,
            text: sql.slice(sourceStart, sourceEnd)
        },
        removalRange,
        openParenIndex: expandedRange.openParenIndex,
        closeParenIndex: expandedRange.closeParenIndex
    };
};

const expandWrappingParenRange = (
    lexemes: Lexeme[],
    openParenIndex: number,
    closeParenIndex: number
): { openParenIndex: number; closeParenIndex: number } => {
    let expandedOpenParenIndex = openParenIndex;
    let expandedCloseParenIndex = closeParenIndex;
    while (
        isOpenParen(lexemes[expandedOpenParenIndex - 1]) &&
        isCloseParen(lexemes[expandedCloseParenIndex + 1])
    ) {
        expandedOpenParenIndex -= 1;
        expandedCloseParenIndex += 1;
    }
    return {
        openParenIndex: expandedOpenParenIndex,
        closeParenIndex: expandedCloseParenIndex
    };
};

interface LexemeRange {
    start: number;
    end: number;
}

const splitTopLevelTermsByKeyword = (lexemes: Lexeme[], keyword: string): LexemeRange[] => {
    const ranges: LexemeRange[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < lexemes.length; index += 1) {
        const lexeme = lexemes[index];
        if (isOpenParen(lexeme)) {
            depth += 1;
            continue;
        }
        if (isCloseParen(lexeme)) {
            depth -= 1;
            continue;
        }
        if (depth === 0 && isKeyword(lexeme, keyword)) {
            ranges.push({ start, end: index });
            start = index + 1;
        }
    }
    ranges.push({ start, end: lexemes.length });
    return ranges;
};

const getGuardedParameterNameFromLexemes = (lexemes: Lexeme[]): string | null => {
    const compact = lexemes.filter(lexeme => !isWrappingParen(lexeme));
    if (compact.length !== 3) {
        return null;
    }
    if (!isParameter(compact[0]) || !isKeyword(compact[1], 'is') || !isKeyword(compact[2], 'null')) {
        return null;
    }
    return normalizeParameterName(compact[0].value);
};

const isSupportedMeaningfulBranchFromLexemes = (lexemes: Lexeme[], parameterName: string): boolean => {
    try {
        const parsed = ValueParser.parseFromLexeme(lexemes, 0);
        if (parsed.newIndex !== lexemes.length) {
            return false;
        }
        return isSupportedMeaningfulBranch(parsed.value, parameterName);
    } catch {
        return false;
    }
};

const getRemovalRange = (
    sql: string,
    lexemes: Lexeme[],
    openParenIndex: number,
    closeParenIndex: number
): OptionalConditionSourceRange => {
    const previous = lexemes[openParenIndex - 1];
    const next = lexemes[closeParenIndex + 1];
    let start = requiredPosition(lexemes[openParenIndex]).startPosition;
    let end = requiredPosition(lexemes[closeParenIndex]).endPosition;

    if (previous && isKeyword(previous, 'and')) {
        start = requiredPosition(previous).startPosition;
    } else if (next && isKeyword(next, 'and')) {
        end = requiredPosition(next).endPosition;
    } else if (previous && isKeyword(previous, 'where')) {
        start = requiredPosition(previous).startPosition;
    }

    return {
        start,
        end,
        text: sql.slice(start, end)
    };
};

const isParameter = (lexeme: Lexeme): boolean => (lexeme.type & TokenType.Parameter) !== 0;
const isOpenParen = (lexeme: Lexeme): boolean => (lexeme.type & TokenType.OpenParen) !== 0;
const isCloseParen = (lexeme: Lexeme): boolean => (lexeme.type & TokenType.CloseParen) !== 0;
const isKeyword = (lexeme: Lexeme, keyword: string): boolean => lexeme.value.toLowerCase() === keyword;
const isWrappingParen = (lexeme: Lexeme): boolean => isOpenParen(lexeme) || isCloseParen(lexeme);

const normalizeParameterName = (value: string): string => {
    if (value.startsWith('${') && value.endsWith('}')) {
        return value.slice(2, -1);
    }
    return value.replace(/^[:@$]/, '');
};

const requiredPosition = (lexeme: Lexeme): NonNullable<Lexeme['position']> => {
    if (!lexeme.position) {
        throw new Error(`Lexeme '${lexeme.value}' is missing source position metadata.`);
    }
    return lexeme.position;
};
