import { WhereClause, type JoinClause, type SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    BinaryExpression,
    CastExpression,
    ColumnReference,
    FunctionCall,
    IdentifierString,
    InlineQuery,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    RawString,
    UnaryExpression,
    type ValueComponent
} from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SqlTokenizer } from "../parsers/SqlTokenizer";
import { Lexeme, TokenType } from "../models/Lexeme";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import { SelectableColumnCollector, DuplicateDetectionMode } from "./SelectableColumnCollector";
import { ParameterCollector } from "./ParameterCollector";
import { CTECollector } from "./CTECollector";
import {
    collectSupportedOptionalConditionBranches,
    type SupportedOptionalConditionBranch
} from "./PruneOptionalConditionBranches";
import { formatSqlComponent } from "./SqlComponentFormatter";

export type SSSQLFilterValue = unknown;
export type SSSQLFilterInput = Record<string, SSSQLFilterValue>;
export type SssqlScaffoldFilters = SSSQLFilterInput;
export type SssqlScalarOperator = "=" | "<>" | "<" | "<=" | ">" | ">=" | "like" | "ilike";
export type SssqlScalarOperatorInput = SssqlScalarOperator | "!=";
export type SssqlBranchKind = "scalar" | "exists" | "not-exists" | "expression";

export interface SssqlTransformResult {
    query: SelectQuery;
}

export type SssqlRewriteEditKind = "insert" | "replace" | "delete";

export interface SssqlRewriteEdit {
    start: number;
    end: number;
    before: string;
    after: string;
    kind: SssqlRewriteEditKind;
    reason?: string;
    target?: SssqlRewriteEditTarget;
}

export interface SssqlRewriteEditTarget {
    branchKind: SssqlBranchKind;
    parameterName: string;
    column?: string;
}

export type SssqlRewriteChangedRegionKind =
    | "target-branch"
    | "where-keyword"
    | "boolean-operator"
    | "parentheses"
    | "formatter-rewrite"
    | "comment"
    | "unknown";

export interface SssqlRewriteChangedRegion {
    kind: SssqlRewriteChangedRegionKind;
    start: number;
    end: number;
    message?: string;
}

export interface SssqlRewritePlanWarning {
    code: string;
    message: string;
    detail?: unknown;
}

export interface SssqlRewritePlanError {
    code: string;
    message: string;
    detail?: unknown;
}

export interface SssqlRewriteSafety {
    tokenCountBefore: number;
    tokenCountAfter: number;
    tokenSequencePreserved: boolean;
    commentsPreserved: boolean;
    changedOnlyTargetBranches: boolean;
    changedRegions: readonly SssqlRewriteChangedRegion[];
}

export interface SssqlRewritePlan {
    ok: boolean;
    requiresFullReformat: boolean;
    edits: readonly SssqlRewriteEdit[];
    sql?: string;
    safety: SssqlRewriteSafety;
    warnings: readonly SssqlRewritePlanWarning[];
    errors: readonly SssqlRewritePlanError[];
}

export interface SssqlBranchInfo {
    parameterName: string;
    kind: SssqlBranchKind;
    operator?: SssqlScalarOperator;
    target?: string;
    query: SimpleSelectQuery;
    expression: ValueComponent;
    sql: string;
}

export interface SssqlScalarScaffoldSpec {
    kind?: "scalar";
    target: string;
    parameterName?: string;
    operator?: SssqlScalarOperatorInput;
}

export interface SssqlExistsScaffoldSpec {
    kind: "exists" | "not-exists";
    parameterName: string;
    query: string;
    anchorColumns: string[];
}

export type SssqlScaffoldSpec = SssqlScalarScaffoldSpec | SssqlExistsScaffoldSpec;

export interface SssqlRemoveSpec {
    parameterName: string;
    kind?: SssqlBranchKind;
    operator?: SssqlScalarOperatorInput;
    target?: string;
}

interface ResolvedFilterTarget {
    query: SimpleSelectQuery;
    column: ColumnReference;
    parameterName: string;
}

interface ParsedFilterName {
    table: string;
    column: string;
}

interface ExistsPredicateDetails {
    kind: "exists" | "not-exists";
    subquery: SelectQuery;
}

interface CorrelatedAnchorReference {
    namespace: string;
    column: string;
}

interface CorrelatedRefreshPlan {
    target: ResolvedFilterTarget;
    sourceAlias: string;
}

interface ScalarBranchDetails {
    operator: SssqlScalarOperator;
    target: string;
    column: ColumnReference;
}

const SUPPORTED_SCALAR_OPERATORS = new Set<SssqlScalarOperator>(["=", "<>", "<", "<=", ">", ">=", "like", "ilike"]);

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const normalizeSql = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();

interface RewriteTokenSignature {
    type: number;
    value: string;
}

const normalizeRewriteTokenType = (lexeme: Lexeme): number => {
    if ((lexeme.type & TokenType.Command) !== 0) {
        return TokenType.Command;
    }
    if ((lexeme.type & TokenType.Identifier) !== 0) {
        return TokenType.Identifier;
    }
    return lexeme.type;
};

const normalizeRewriteTokenValue = (lexeme: Lexeme): string => {
    if ((lexeme.type & TokenType.Command) !== 0) {
        return lexeme.value.toLowerCase();
    }
    return lexeme.value;
};

const tokenizeForRewritePlan = (sql: string): RewriteTokenSignature[] => {
    return new SqlTokenizer(sql).tokenize().map(lexeme => ({
        type: normalizeRewriteTokenType(lexeme),
        value: normalizeRewriteTokenValue(lexeme)
    }));
};

const tokenSequencesEqual = (left: RewriteTokenSignature[], right: RewriteTokenSignature[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((token, index) => {
        const other = right[index];
        return other !== undefined && token.type === other.type && token.value === other.value;
    });
};

const collectCommentFragments = (sql: string): string[] => {
    return new SqlTokenizer(sql).tokenize().flatMap(lexeme => {
        if (lexeme.positionedComments) {
            return lexeme.positionedComments.flatMap(positioned => positioned.comments);
        }
        return lexeme.comments ? [...lexeme.comments] : [];
    });
};

const commentsPreservedInOrder = (before: string[], after: string[]): boolean => {
    let cursor = 0;
    for (const comment of before) {
        const foundAt = after.indexOf(comment, cursor);
        if (foundAt < 0) {
            return false;
        }
        cursor = foundAt + 1;
    }
    return true;
};

const countCommandToken = (tokens: RewriteTokenSignature[], value: string): number => {
    return tokens.filter(token => token.type === TokenType.Command && token.value === value).length;
};

const applyRewriteEdits = (sql: string, edits: readonly SssqlRewriteEdit[]): string => {
    return [...edits]
        .sort((left, right) => right.start - left.start)
        .reduce((current, edit) => {
            return current.slice(0, edit.start) + edit.after + current.slice(edit.end);
        }, sql);
};

const getStatementEndPosition = (sql: string): number => {
    let end = sql.length;
    while (end > 0 && /\s/.test(sql[end - 1]!)) {
        end--;
    }
    if (end > 0 && sql[end - 1] === ";") {
        end--;
        while (end > 0 && /\s/.test(sql[end - 1]!)) {
            end--;
        }
    }
    return end;
};

const clauseBoundaryCommands = new Set(["group by", "having", "order by", "limit", "offset", "fetch", "for"]);

const isClauseBoundary = (lexeme: Lexeme): boolean => {
    return (lexeme.type & TokenType.Command) !== 0
        && clauseBoundaryCommands.has(lexeme.value.toLowerCase());
};

const findMinimalWhereInsertPosition = (sql: string): { position: number; hasWhere: boolean } => {
    const lexemes = new SqlTokenizer(sql).tokenize();
    const statementEnd = getStatementEndPosition(sql);
    const topLevelLexemes: Array<{ lexeme: Lexeme; index: number }> = [];
    let depth = 0;

    for (let index = 0; index < lexemes.length; index += 1) {
        const lexeme = lexemes[index]!;
        if ((lexeme.type & TokenType.CloseParen) !== 0) {
            depth = Math.max(0, depth - 1);
        }
        if (depth === 0) {
            topLevelLexemes.push({ lexeme, index });
        }
        if ((lexeme.type & TokenType.OpenParen) !== 0) {
            depth += 1;
        }
    }

    const where = topLevelLexemes.find(entry =>
        (entry.lexeme.type & TokenType.Command) !== 0 && entry.lexeme.value.toLowerCase() === "where"
    );

    if (where) {
        const tail = topLevelLexemes
            .filter(entry => entry.index > where.index)
            .map(entry => entry.lexeme)
            .find(isClauseBoundary);
        return {
            position: tail?.position?.startPosition ?? statementEnd,
            hasWhere: true
        };
    }

    const tail = topLevelLexemes.map(entry => entry.lexeme).find(isClauseBoundary);
    return {
        position: tail?.position?.startPosition ?? statementEnd,
        hasWhere: false
    };
};

const findMatchingParenEnd = (sql: string, start: number): number => {
    let depth = 0;
    let quote: string | null = null;

    for (let index = start; index < sql.length; index++) {
        const char = sql[index]!;
        if (quote) {
            if (char === quote) {
                if (quote === "'" && sql[index + 1] === "'") {
                    index++;
                    continue;
                }
                quote = null;
            }
            continue;
        }

        if (char === "'" || char === "\"") {
            quote = char;
            continue;
        }
        if (char === "(") {
            depth++;
        }
        if (char === ")") {
            depth--;
            if (depth === 0) {
                return index + 1;
            }
        }
    }

    return -1;
};

// Fallback for #854: findOptionalBranchSpans, findBooleanOperatorBefore, and
// findBooleanOperatorAfter recover minimal remove spans until the AST can expose
// source positions for optional parenthesized OR/IS NULL branches reliably.
// Keep regex-based rewriting limited to this fallback path.
const findOptionalBranchSpans = (sql: string, parameterName: string): Array<{ start: number; end: number; text: string }> => {
    const spans: Array<{ start: number; end: number; text: string }> = [];
    const parameterNeedle = `:${parameterName.toLowerCase()}`;
    const lowerSql = sql.toLowerCase();

    for (let index = 0; index < sql.length; index++) {
        if (sql[index] !== "(") {
            continue;
        }

        const end = findMatchingParenEnd(sql, index);
        if (end < 0) {
            break;
        }

        const text = sql.slice(index, end);
        const normalized = lowerSql.slice(index, end);
        if (normalized.includes(parameterNeedle) && normalized.includes(" is null") && normalized.includes(" or ")) {
            spans.push({ start: index, end, text });
        }
        index = end - 1;
    }

    return spans;
};

const findBooleanOperatorBefore = (sql: string, start: number): { start: number; end: number; value: string } | null => {
    const prefix = sql.slice(0, start);
    const match = /(\s+)(and|or)(\s*)$/i.exec(prefix);
    if (!match || match.index === undefined) {
        return null;
    }
    return {
        start: match.index,
        end: start,
        value: match[2]!.toLowerCase()
    };
};

const findBooleanOperatorAfter = (sql: string, end: number): { start: number; end: number; value: string } | null => {
    const suffix = sql.slice(end);
    const match = /^(\s*)(and|or)(\s+)/i.exec(suffix);
    if (!match) {
        return null;
    }
    return {
        start: end,
        end: end + match[0].length,
        value: match[2]!.toLowerCase()
    };
};

const findWhereBefore = (sql: string, position: number): { start: number; end: number } | null => {
    const lexemes = new SqlTokenizer(sql).tokenize();
    let found: Lexeme | null = null;
    for (const lexeme of lexemes) {
        if ((lexeme.position?.startPosition ?? 0) >= position) {
            break;
        }
        if ((lexeme.type & TokenType.Command) !== 0 && lexeme.value.toLowerCase() === "where") {
            found = lexeme;
        }
    }
    if (!found?.position) {
        return null;
    }
    return {
        start: found.position.startPosition,
        end: found.position.endPosition
    };
};

const findSourceColumnReferenceText = (sql: string, reference: ColumnReference): string => {
    const namespace = normalizeIdentifier(reference.getNamespace());
    const column = normalizeIdentifier(reference.column.name);
    const lexemes = new SqlTokenizer(sql).tokenize();

    for (let index = 0; index < lexemes.length - 2; index++) {
        const first = lexemes[index]!;
        const dot = lexemes[index + 1]!;
        const last = lexemes[index + 2]!;
        if ((first.type & TokenType.Identifier) === 0 || dot.value !== "." || (last.type & TokenType.Identifier) === 0) {
            continue;
        }
        if (normalizeIdentifier(first.value) !== namespace || normalizeIdentifier(last.value) !== column) {
            continue;
        }
        if (!first.position || !last.position) {
            continue;
        }
        return sql.slice(first.position.startPosition, last.position.endPosition);
    }

    return normalizeColumnReferenceText(reference);
};

const normalizeColumnReferenceKey = (reference: ColumnReference): string => {
    return `${normalizeIdentifier(reference.getNamespace())}.${normalizeIdentifier(reference.column.name)}`;
};

const normalizeColumnReferenceText = (reference: ColumnReference): string => {
    const namespace = reference.getNamespace();
    return namespace ? `${namespace}.${reference.column.name}` : reference.column.name;
};

const normalizeScalarOperator = (value: SssqlScalarOperatorInput | undefined): SssqlScalarOperator => {
    if (!value) {
        return "=";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "!=") {
        return "<>";
    }
    if (SUPPORTED_SCALAR_OPERATORS.has(normalized as SssqlScalarOperator)) {
        return normalized as SssqlScalarOperator;
    }

    throw new Error(`Unsupported SSSQL operator '${value}'.`);
};

const isExplicitEqualityScaffoldValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
        return true;
    }

    if (Array.isArray(value)) {
        return false;
    }

    if (typeof value !== "object") {
        return true;
    }

    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
    return entries.length === 1 && entries[0]?.[0] === "=";
};

const parseQualifiedFilterName = (filterName: string): ParsedFilterName | null => {
    const segments = filterName.split(".");
    if (segments.length !== 2) {
        return null;
    }

    const [table, column] = segments.map(segment => segment.trim());
    if (!table || !column) {
        return null;
    }

    return { table, column };
};

const makeParameterName = (filterName: string): string => {
    return filterName
        .trim()
        .replace(/\./g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "_");
};

const unwrapParens = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }
    return candidate;
};

const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    return expression instanceof BinaryExpression && expression.operator.value.trim().toLowerCase() === operator;
};

const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "and")) {
        return [expression];
    }

    return [
        ...collectTopLevelAndTerms(candidate.left),
        ...collectTopLevelAndTerms(candidate.right)
    ];
};

const collectTopLevelOrTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "or")) {
        return [expression];
    }

    return [
        ...collectTopLevelOrTerms(candidate.left),
        ...collectTopLevelOrTerms(candidate.right)
    ];
};

const getGuardedParameterName = (expression: ValueComponent): string | null => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "is")) {
        return null;
    }

    const left = unwrapOptionalGuardParameter(candidate.left);

    if (!(left instanceof ParameterExpression)) {
        return null;
    }

    const right = unwrapParens(candidate.right);
    const isNull = (right instanceof LiteralValue && right.value === null)
        || (right instanceof RawString && right.value.trim().toLowerCase() === "null");
    if (!isNull) {
        return null;
    }

    return left.name.value;
};

const unwrapOptionalGuardParameter = (expression: ValueComponent): ValueComponent => {
    let candidate = unwrapParens(expression);
    while (candidate instanceof CastExpression) {
        candidate = unwrapParens(candidate.input);
    }
    if (candidate instanceof FunctionCall && getFunctionCallName(candidate) === "cast" && candidate.argument) {
        const argument = unwrapParens(candidate.argument);
        if (isBinaryOperator(argument, "as")) {
            return unwrapOptionalGuardParameter(argument.left);
        }
    }
    return candidate;
};

const getFunctionCallName = (expression: FunctionCall): string => {
    const name = expression.qualifiedName.name;
    return "value" in name ? name.value.toLowerCase() : name.name.toLowerCase();
};

const buildOptionalScalarBranch = (
    column: ColumnReference,
    parameterName: string,
    operator: SssqlScalarOperator
): ValueComponent => {
    const guard = new BinaryExpression(new ParameterExpression(parameterName), "is", new LiteralValue(null));
    const predicate = new BinaryExpression(
        new ColumnReference(column.getNamespace() || null, column.column.name),
        operator,
        new ParameterExpression(parameterName)
    );
    return new ParenExpression(new BinaryExpression(guard, "or", predicate));
};

const buildOptionalExistsBranch = (
    parameterName: string,
    subquery: SelectQuery,
    kind: "exists" | "not-exists"
): ValueComponent => {
    const guard = new BinaryExpression(new ParameterExpression(parameterName), "is", new LiteralValue(null));
    const existsExpression = new UnaryExpression("exists", new InlineQuery(subquery));
    const predicate = kind === "exists"
        ? existsExpression
        : new UnaryExpression("not", existsExpression);

    return new ParenExpression(new BinaryExpression(guard, "or", predicate));
};

const rebuildWhereWithoutTerm = (query: SimpleSelectQuery, termToRemove: ValueComponent): void => {
    if (!query.whereClause) {
        return;
    }

    const terms = collectTopLevelAndTerms(query.whereClause.condition).filter(term => term !== termToRemove);
    if (terms.length === 0) {
        query.whereClause = null;
        return;
    }

    let rebuilt = terms[0]!;
    for (let index = 1; index < terms.length; index += 1) {
        rebuilt = new BinaryExpression(rebuilt, "and", terms[index]!);
    }

    query.whereClause = new WhereClause(rebuilt);
};

const enforceSubqueryConstraints = (sql: string): void => {
    if (!sql.trim()) {
        throw new Error("SSSQL EXISTS/NOT EXISTS scaffold query must not be empty.");
    }
    if (sql.includes(";")) {
        throw new Error("SSSQL EXISTS/NOT EXISTS scaffold query must not contain semicolons or multiple statements.");
    }
    if (/\blateral\b/i.test(sql)) {
        throw new Error("LATERAL is not supported in SSSQL EXISTS/NOT EXISTS scaffold.");
    }
};

const substituteAnchorPlaceholders = (sql: string, formattedColumns: string[]): string => {
    const usedIndexes = new Set<number>();
    const replaced = sql.replace(/\$c(\d+)/g, (_, indexDigits) => {
        const index = Number(indexDigits);
        if (!Number.isInteger(index)) {
            throw new Error(`Invalid placeholder '$c${indexDigits}' in SSSQL scaffold query.`);
        }
        if (index < 0 || index >= formattedColumns.length) {
            throw new Error(`Placeholder '$c${index}' references a missing SSSQL scaffold anchor column.`);
        }
        usedIndexes.add(index);
        return formattedColumns[index]!;
    });

    if (formattedColumns.length === 0) {
        return replaced;
    }

    for (let index = 0; index < formattedColumns.length; index += 1) {
        if (!usedIndexes.has(index)) {
            throw new Error(`Missing placeholder '$c${index}' for SSSQL scaffold anchor column.`);
        }
    }

    return replaced;
};

const getScalarBranchDetails = (
    expression: ValueComponent,
    parameterName: string
): ScalarBranchDetails | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    if (!(predicate instanceof BinaryExpression)) {
        return null;
    }

    const left = unwrapParens(predicate.left);
    const right = unwrapParens(predicate.right);

    if (left instanceof ColumnReference && right instanceof ParameterExpression && right.name.value === parameterName) {
        try {
            return {
                operator: normalizeScalarOperator(predicate.operator.value as SssqlScalarOperatorInput),
                target: normalizeColumnReferenceText(left),
                column: left
            };
        } catch {
            return null;
        }
    }

    if (right instanceof ColumnReference && left instanceof ParameterExpression && left.name.value === parameterName) {
        try {
            return {
                operator: normalizeScalarOperator(predicate.operator.value as SssqlScalarOperatorInput),
                target: normalizeColumnReferenceText(right),
                column: right
            };
        } catch {
            return null;
        }
    }

    return null;
};

const hasSelectQuery = (value: unknown): value is { selectQuery: SelectQuery } => {
    return typeof value === "object" && value !== null && "selectQuery" in value;
};

const collectColumnReferencesDeep = (value: unknown): ColumnReference[] => {
    const references: ColumnReference[] = [];
    const visited = new WeakSet<object>();

    const walk = (candidate: unknown): void => {
        if (!candidate || typeof candidate !== "object") {
            return;
        }

        if (candidate instanceof ColumnReference) {
            references.push(candidate);
            return;
        }

        if (visited.has(candidate)) {
            return;
        }
        visited.add(candidate);

        if (Array.isArray(candidate)) {
            for (const item of candidate) {
                walk(item);
            }
            return;
        }

        for (const child of Object.values(candidate as Record<string, unknown>)) {
            walk(child);
        }
    };

    walk(value);
    return references;
};

const getExistsBranchKind = (
    expression: ValueComponent,
    parameterName: string
): "exists" | "not-exists" | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    const isInlineQueryValue = (value: ValueComponent): value is InlineQuery => {
        return value instanceof InlineQuery || hasSelectQuery(value);
    };

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "exists") {
        return isInlineQueryValue(unwrapParens(predicate.expression)) ? "exists" : null;
    }

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "not exists") {
        return isInlineQueryValue(unwrapParens(predicate.expression)) ? "not-exists" : null;
    }

    if (
        predicate instanceof UnaryExpression &&
        predicate.operator.value.trim().toLowerCase() === "not" &&
        unwrapParens(predicate.expression) instanceof UnaryExpression
    ) {
        const nested = unwrapParens(predicate.expression) as UnaryExpression;
        if (
            nested.operator.value.trim().toLowerCase() === "exists"
            && isInlineQueryValue(unwrapParens(nested.expression))
        ) {
            return "not-exists";
        }
    }

    return null;
};

const getExistsPredicateDetails = (
    expression: ValueComponent,
    parameterName: string
): ExistsPredicateDetails | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    const isInlineQueryValue = (value: ValueComponent): value is InlineQuery => {
        return value instanceof InlineQuery || hasSelectQuery(value);
    };

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "exists") {
        const candidate = unwrapParens(predicate.expression);
        if (isInlineQueryValue(candidate)) {
            return {
                kind: "exists",
                subquery: candidate.selectQuery
            };
        }
        return null;
    }

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "not exists") {
        const candidate = unwrapParens(predicate.expression);
        if (isInlineQueryValue(candidate)) {
            return {
                kind: "not-exists",
                subquery: candidate.selectQuery
            };
        }
        return null;
    }

    if (
        predicate instanceof UnaryExpression &&
        predicate.operator.value.trim().toLowerCase() === "not" &&
        unwrapParens(predicate.expression) instanceof UnaryExpression
    ) {
        const nested = unwrapParens(predicate.expression) as UnaryExpression;
        const candidate = unwrapParens(nested.expression);
        if (nested.operator.value.trim().toLowerCase() === "exists" && isInlineQueryValue(candidate)) {
            return {
                kind: "not-exists",
                subquery: candidate.selectQuery
            };
        }
    }

    return null;
};

const getBranchInfo = (branch: SupportedOptionalConditionBranch): SssqlBranchInfo => {
    const scalar = getScalarBranchDetails(branch.expression, branch.parameterName);
    if (scalar) {
        return {
            parameterName: branch.parameterName,
            kind: "scalar",
            operator: scalar.operator,
            target: scalar.target,
            query: branch.query,
            expression: branch.expression,
            sql: formatSqlComponent(branch.expression)
        };
    }

    const existsKind = getExistsBranchKind(branch.expression, branch.parameterName);
    if (existsKind) {
        return {
            parameterName: branch.parameterName,
            kind: existsKind,
            query: branch.query,
            expression: branch.expression,
            sql: formatSqlComponent(branch.expression)
        };
    }

    return {
        parameterName: branch.parameterName,
        kind: "expression",
        query: branch.query,
        expression: branch.expression,
        sql: formatSqlComponent(branch.expression)
    };
};

const isEquivalentScalarBranch = (
    branch: SssqlBranchInfo,
    query: SimpleSelectQuery,
    parameterName: string,
    operator: SssqlScalarOperator,
    targetColumnText: string
): boolean => {
    return branch.query === query
        && branch.kind === "scalar"
        && branch.parameterName === parameterName
        && branch.operator === operator
        && branch.target !== undefined
        && normalizeIdentifier(branch.target) === normalizeIdentifier(targetColumnText);
};

/**
 * Builds and refreshes truthful SSSQL optional filter branches.
 * Runtime callers should use pruning, not dynamic predicate injection.
 */
export class SSSQLFilterBuilder {
    private readonly finder: UpstreamSelectQueryFinder;

    constructor(private readonly tableColumnResolver?: (tableName: string) => string[]) {
        this.finder = new UpstreamSelectQueryFinder(this.tableColumnResolver);
    }

    list(query: SelectQuery | string): SssqlBranchInfo[] {
        const parsed = this.parseQuery(query);
        return collectSupportedOptionalConditionBranches(parsed).map(getBranchInfo);
    }

    planScaffold(query: SelectQuery | string, filters: SSSQLFilterInput): SssqlRewritePlan {
        if (typeof query === "string") {
            const entries = Object.entries(filters);
            if (entries.length === 1) {
                const [filterName, filterValue] = entries[0]!;
                if (isExplicitEqualityScaffoldValue(filterValue)) {
                    try {
                        return this.planScalarInsert(query, {
                            target: filterName,
                            parameterName: makeParameterName(filterName),
                            operator: "="
                        });
                    } catch {
                        // Fall through to the conservative formatter-backed plan, which reports rewrite errors.
                    }
                }
            }
        }
        return this.planRewrite(query, parsed => this.scaffold(parsed, filters));
    }

    dryRunScaffold(query: SelectQuery | string, filters: SSSQLFilterInput): SssqlRewritePlan {
        return this.planScaffold(query, filters);
    }

    planScaffoldBranch(query: SelectQuery | string, spec: SssqlScaffoldSpec): SssqlRewritePlan {
        if (typeof query === "string" && (spec.kind === "exists" || spec.kind === "not-exists")) {
            try {
                return this.planExistsInsert(query, spec as SssqlExistsScaffoldSpec);
            } catch {
                // Fall through to the conservative formatter-backed plan, which reports rewrite errors.
            }
        }
        if (typeof query === "string" && spec.kind !== "exists" && spec.kind !== "not-exists") {
            try {
                return this.planScalarInsert(query, spec as SssqlScalarScaffoldSpec);
            } catch {
                // Fall through to the conservative formatter-backed plan, which reports rewrite errors.
            }
        }
        return this.planRewrite(query, parsed => this.scaffoldBranch(parsed, spec));
    }

    dryRunScaffoldBranch(query: SelectQuery | string, spec: SssqlScaffoldSpec): SssqlRewritePlan {
        return this.planScaffoldBranch(query, spec);
    }

    planRefresh(query: SelectQuery | string, filters: SSSQLFilterInput): SssqlRewritePlan {
        if (typeof query === "string") {
            try {
                const parsed = SelectQueryParser.parse(query);
                const result = this.refreshParsed(parsed, filters);
                if (!result.changed) {
                    return this.buildPlanFromEdits(query, [], [], []);
                }
            } catch {
                // Fall through to the conservative formatter-backed plan, which reports rewrite errors.
            }
        }
        return this.planRewrite(query, parsed => this.refresh(parsed, filters));
    }

    dryRunRefresh(query: SelectQuery | string, filters: SSSQLFilterInput): SssqlRewritePlan {
        return this.planRefresh(query, filters);
    }

    planRemove(query: SelectQuery | string, spec: SssqlRemoveSpec): SssqlRewritePlan {
        if (typeof query === "string") {
            try {
                return this.planBranchRemoval(query, spec);
            } catch {
                // Fall through to the conservative formatter-backed plan, which reports rewrite errors.
            }
        }
        return this.planRewrite(query, parsed => this.remove(parsed, spec));
    }

    dryRunRemove(query: SelectQuery | string, spec: SssqlRemoveSpec): SssqlRewritePlan {
        return this.planRemove(query, spec);
    }

    planRemoveAll(query: SelectQuery | string): SssqlRewritePlan {
        return this.planRewrite(query, parsed => this.removeAll(parsed));
    }

    dryRunRemoveAll(query: SelectQuery | string): SssqlRewritePlan {
        return this.planRemoveAll(query);
    }

    scaffold(query: SelectQuery | string, filters: SSSQLFilterInput): SelectQuery {
        const parsed = this.parseQuery(query);

        for (const [filterName, filterValue] of Object.entries(filters)) {
            if (!isExplicitEqualityScaffoldValue(filterValue)) {
                throw new Error(
                    `SSSQL scaffold only supports equality filters in v1. Use structured scaffold or refresh for pre-authored branches: '${filterName}'.`
                );
            }

            this.scaffoldBranch(parsed, {
                target: filterName,
                parameterName: makeParameterName(filterName),
                operator: "="
            });
        }

        return parsed;
    }

    scaffoldBranch(query: SelectQuery | string, spec: SssqlScaffoldSpec): SelectQuery {
        const parsed = this.parseQuery(query);

        if (spec.kind === "exists" || spec.kind === "not-exists") {
            this.scaffoldExistsBranch(parsed, spec as SssqlExistsScaffoldSpec);
            return parsed;
        }

        this.scaffoldScalarBranch(parsed, spec as SssqlScalarScaffoldSpec);
        return parsed;
    }

    refresh(query: SelectQuery | string, filters: SSSQLFilterInput): SelectQuery {
        const parsed = this.parseQuery(query);
        this.refreshParsed(parsed, filters);
        return parsed;
    }

    private refreshParsed(parsed: SelectQuery, filters: SSSQLFilterInput): { query: SelectQuery; changed: boolean } {
        let changed = false;
        for (const [filterName, filterValue] of Object.entries(filters)) {
            let parameterName = filterName;
            let target: ResolvedFilterTarget | null = null;
            let matches = collectSupportedOptionalConditionBranches(parsed)
                .filter(branch => branch.parameterName === parameterName);

            if (matches.length === 0) {
                target = this.resolveTarget(parsed, filterName);
                parameterName = target.parameterName;
                matches = collectSupportedOptionalConditionBranches(parsed)
                    .filter(branch => branch.parameterName === parameterName);
            }

            if (matches.length === 0) {
                if (!target) {
                    target = this.resolveTarget(parsed, filterName);
                    parameterName = target.parameterName;
                }
                if (!isExplicitEqualityScaffoldValue(filterValue)) {
                    throw new Error(
                        `No existing SSSQL branch was found for '${filterName}', and v1 scaffold only supports equality filters.`
                    );
                }

                this.scaffoldScalarBranch(parsed, {
                    target: filterName,
                    parameterName: target.parameterName,
                    operator: "="
                });
                changed = true;
                continue;
            }

            if (matches.length > 1) {
                throw new Error(`Multiple SSSQL branches matched parameter ':${parameterName}'. Refresh is ambiguous.`);
            }

            const [match] = matches;
            if (!match) {
                continue;
            }

            const scalarDetails = getScalarBranchDetails(match.expression, match.parameterName);
            if (scalarDetails && this.isNullableBranchColumn(match.query, scalarDetails.column)) {
                continue;
            }

            const correlatedPlan = this.buildCorrelatedRefreshPlan(parsed, match);
            if (correlatedPlan) {
                if (correlatedPlan.target.query === match.query) {
                    continue;
                }

                this.rebaseMovedBranchByAlias(match.expression, correlatedPlan.sourceAlias, correlatedPlan.target.column);
                rebuildWhereWithoutTerm(match.query, match.expression);
                correlatedPlan.target.query.appendWhere(match.expression);
                changed = true;
                continue;
            }

            const scalarPlan = scalarDetails
                ? this.buildScalarRefreshPlan(parsed, match, scalarDetails)
                : null;
            if (scalarPlan) {
                if (scalarPlan.query === match.query) {
                    continue;
                }

                this.rebaseMovedBranch(match.expression, match.query, scalarPlan.column);
                rebuildWhereWithoutTerm(match.query, match.expression);
                scalarPlan.query.appendWhere(match.expression);
                changed = true;
                continue;
            }

            if (!target) {
                target = this.tryResolveTarget(parsed, filterName);
                if (!target) {
                    continue;
                }
            }
            if (match.query !== target.query) {
                this.rebaseMovedBranch(match.expression, match.query, target.column);
                rebuildWhereWithoutTerm(match.query, match.expression);
                target.query.appendWhere(match.expression);
                changed = true;
            }
        }

        return { query: parsed, changed };
    }

    remove(query: SelectQuery | string, spec: SssqlRemoveSpec): SelectQuery {
        const parsed = this.parseQuery(query);
        const matches = this.findMatchingBranchInfos(parsed, spec);

        if (matches.length === 0) {
            return parsed;
        }

        if (matches.length > 1) {
            throw new Error(`Multiple SSSQL branches matched parameter ':${spec.parameterName}'. Remove is ambiguous.`);
        }

        const [match] = matches;
        if (!match) {
            return parsed;
        }

        rebuildWhereWithoutTerm(match.query, match.expression);
        return parsed;
    }

    removeAll(query: SelectQuery | string): SelectQuery {
        const parsed = this.parseQuery(query);
        const matches = this.list(parsed);

        for (const match of matches) {
            rebuildWhereWithoutTerm(match.query, match.expression);
        }

        return parsed;
    }

    private parseQuery(query: SelectQuery | string): SelectQuery {
        return typeof query === "string" ? SelectQueryParser.parse(query) : query;
    }

    private planScalarInsert(sourceSql: string, spec: SssqlScalarScaffoldSpec): SssqlRewritePlan {
        const parsed = SelectQueryParser.parse(sourceSql);
        const target = this.resolveTarget(parsed, spec.target);
        if (target.query !== parsed) {
            return this.planRewrite(sourceSql, query => this.scaffoldBranch(query, spec));
        }
        const parameterName = spec.parameterName?.trim() || target.parameterName;
        const operator = normalizeScalarOperator(spec.operator);
        const targetColumnText = findSourceColumnReferenceText(sourceSql, target.column);
        const branchSql = `(:${parameterName} is null or ${targetColumnText} ${operator} :${parameterName})`;
        const normalizedBranch = normalizeSql(branchSql);
        const duplicate = this.list(parsed).find(existing =>
            (existing.query === target.query && normalizeSql(existing.sql) === normalizedBranch)
            || isEquivalentScalarBranch(existing, target.query, parameterName, operator, targetColumnText)
        );

        if (duplicate) {
            return this.buildPlanFromEdits(sourceSql, [], [], []);
        }

        return this.buildMinimalInsertPlan(sourceSql, branchSql, {
            branchKind: "scalar",
            parameterName,
            column: targetColumnText
        });
    }

    private planExistsInsert(sourceSql: string, spec: SssqlExistsScaffoldSpec): SssqlRewritePlan {
        const parameterName = spec.parameterName.trim();
        if (!parameterName) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires parameterName.");
        }
        if (spec.anchorColumns.length === 0) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires at least one anchorColumn.");
        }

        const parsed = SelectQueryParser.parse(sourceSql);
        const anchorTargets = spec.anchorColumns.map(anchorColumn => this.resolveTarget(parsed, anchorColumn));
        const targetQueries = [...new Set(anchorTargets.map(target => target.query))];
        if (targetQueries.length !== 1) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold anchor columns must resolve within one query scope.");
        }

        const targetQuery = targetQueries[0]!;
        if (targetQuery !== parsed) {
            return this.planRewrite(sourceSql, query => this.scaffoldBranch(query, spec));
        }
        const sourceColumns = anchorTargets.map(target => findSourceColumnReferenceText(sourceSql, target.column));
        const substitutedSql = substituteAnchorPlaceholders(spec.query, sourceColumns).trim();
        enforceSubqueryConstraints(substitutedSql);

        const subquery = SelectQueryParser.parse(substitutedSql);
        const parameterNames = new Set(ParameterCollector.collect(subquery).map(parameter => parameter.name.value));
        if (parameterNames.size !== 1 || !parameterNames.has(parameterName)) {
            throw new Error(
                `SSSQL ${spec.kind.toUpperCase()} scaffold query must reference only parameter ':${parameterName}'.`
            );
        }

        const branchSql = `(:${parameterName} is null or ${spec.kind === "not-exists" ? "not exists" : "exists"} (${substitutedSql}))`;
        const duplicate = this.list(parsed).find(existing =>
            existing.query === targetQuery && normalizeSql(existing.sql) === normalizeSql(branchSql)
        );
        if (duplicate) {
            return this.buildPlanFromEdits(sourceSql, [], [], []);
        }

        return this.buildMinimalInsertPlan(sourceSql, branchSql, {
            branchKind: spec.kind,
            parameterName,
            column: sourceColumns.join(", ")
        });
    }

    private buildMinimalInsertPlan(
        sourceSql: string,
        branchSql: string,
        target: SssqlRewriteEditTarget
    ): SssqlRewritePlan {
        const insertPosition = findMinimalWhereInsertPosition(sourceSql);
        const needsLeadingSpace = insertPosition.position === 0
            || !/\s/.test(sourceSql[insertPosition.position - 1]!);
        const prefix = `${needsLeadingSpace ? " " : ""}${insertPosition.hasWhere ? "and" : "where"} `;
        const suffix = insertPosition.position < getStatementEndPosition(sourceSql) ? " " : "";
        const branchLabel = target.branchKind === "scalar" ? "scalar" : target.branchKind;
        const edit: SssqlRewriteEdit = {
            start: insertPosition.position,
            end: insertPosition.position,
            before: "",
            after: `${prefix}${branchSql}${suffix}`,
            kind: "insert",
            reason: insertPosition.hasWhere
                ? `Append SSSQL ${branchLabel} branch to the existing WHERE clause.`
                : `Create a WHERE clause for the SSSQL ${branchLabel} branch.`,
            target
        };
        const changedRegions: SssqlRewriteChangedRegion[] = [{
            kind: "target-branch",
            start: edit.start + prefix.length,
            end: edit.start + edit.after.length - suffix.length,
            message: `Inserted SSSQL ${branchLabel} optional branch.`
        }];
        if (insertPosition.hasWhere) {
            changedRegions.unshift({
                kind: "boolean-operator",
                start: edit.start,
                end: edit.start + prefix.length,
                message: `Inserted AND before the SSSQL ${branchLabel} branch.`
            });
        } else {
            changedRegions.unshift({
                kind: "where-keyword",
                start: edit.start,
                end: edit.start + prefix.length,
                message: `Inserted WHERE before the SSSQL ${branchLabel} branch.`
            });
        }

        return this.buildPlanFromEdits(sourceSql, [edit], changedRegions, []);
    }

    private planBranchRemoval(sourceSql: string, spec: SssqlRemoveSpec): SssqlRewritePlan {
        const parsed = SelectQueryParser.parse(sourceSql);
        const matches = this.findMatchingBranchInfos(parsed, spec);
        if (matches.length > 1) {
            return this.buildPlanFromEdits(sourceSql, [], [], [], [{
                code: "REWRITE_FAILED",
                message: "SSSQL remove planning found multiple matching branches.",
                detail: `Multiple SSSQL branches matched parameter ':${spec.parameterName}'. Remove is ambiguous.`
            }]);
        }
        if (matches.length === 0) {
            return this.buildPlanFromEdits(sourceSql, [], [], []);
        }

        const branchSpans = findOptionalBranchSpans(sourceSql, spec.parameterName);
        if (branchSpans.length > 1) {
            return this.planRewrite(sourceSql, query => this.remove(query, spec));
        }
        const span = branchSpans[0];
        if (!span) {
            return this.planRewrite(sourceSql, query => this.remove(query, spec));
        }

        const beforeOperator = findBooleanOperatorBefore(sourceSql, span.start);
        const afterOperator = findBooleanOperatorAfter(sourceSql, span.end);
        const where = findWhereBefore(sourceSql, span.start);
        let start = span.start;
        let end = span.end;
        const changedRegions: SssqlRewriteChangedRegion[] = [{
            kind: "target-branch",
            start: span.start,
            end: span.end,
            message: "Removed SSSQL optional branch."
        }];

        if (beforeOperator) {
            start = beforeOperator.start;
            changedRegions.unshift({
                kind: "boolean-operator",
                start: beforeOperator.start,
                end: beforeOperator.end,
                message: `Removed adjacent ${beforeOperator.value.toUpperCase()} before the SSSQL branch.`
            });
        } else if (afterOperator) {
            end = afterOperator.end;
            changedRegions.push({
                kind: "boolean-operator",
                start: afterOperator.start,
                end: afterOperator.end,
                message: `Removed adjacent ${afterOperator.value.toUpperCase()} after the SSSQL branch.`
            });
        } else if (where) {
            start = where.start;
            while (end < sourceSql.length && /\s/.test(sourceSql[end]!)) {
                end++;
            }
            changedRegions.unshift({
                kind: "where-keyword",
                start: where.start,
                end: where.end,
                message: "Removed WHERE because the SSSQL branch was the only condition."
            });
        }

        const edit: SssqlRewriteEdit = {
            start,
            end,
            before: sourceSql.slice(start, end),
            after: "",
            kind: "delete",
            reason: "Remove the targeted SSSQL optional branch from the source SQL.",
            target: {
                branchKind: matches[0]!.kind,
                parameterName: matches[0]!.parameterName,
                column: matches[0]!.target
            }
        };

        return this.buildPlanFromEdits(sourceSql, [edit], changedRegions, []);
    }

    private buildPlanFromEdits(
        sourceSql: string,
        edits: readonly SssqlRewriteEdit[],
        changedRegions: readonly SssqlRewriteChangedRegion[],
        warnings: readonly SssqlRewritePlanWarning[],
        errors: readonly SssqlRewritePlanError[] = []
    ): SssqlRewritePlan {
        const plannedSql = errors.length === 0 ? applyRewriteEdits(sourceSql, edits) : undefined;
        const beforeTokens = tokenizeForRewritePlan(sourceSql);
        const beforeComments = collectCommentFragments(sourceSql);
        const afterTokens = plannedSql !== undefined ? tokenizeForRewritePlan(plannedSql) : [];
        const afterComments = plannedSql !== undefined ? collectCommentFragments(plannedSql) : [];
        const commentsPreserved = plannedSql !== undefined
            ? commentsPreservedInOrder(beforeComments, afterComments)
            : false;
        const changedOnlyTargetBranches = errors.length === 0
            && changedRegions.every(region =>
                region.kind === "target-branch"
                || region.kind === "where-keyword"
                || region.kind === "boolean-operator"
                || region.kind === "parentheses"
            )
            && commentsPreserved;
        const planWarnings = [...warnings];

        if (plannedSql !== undefined && applyRewriteEdits(sourceSql, edits) !== plannedSql) {
            errors = [...errors, {
                code: "APPLY_PLAN_MISMATCH",
                message: "Applying SSSQL rewrite plan edits did not reproduce the planned SQL."
            }];
        }
        if (plannedSql !== undefined) {
            try {
                SelectQueryParser.parse(plannedSql);
            } catch (error) {
                errors = [...errors, {
                    code: "PARSE_AFTER_FAILED",
                    message: "The SQL produced by SSSQL rewrite planning could not be parsed.",
                    detail: error instanceof Error ? error.message : error
                }];
            }
        }
        if (plannedSql !== undefined && !commentsPreserved) {
            planWarnings.push({
                code: "COMMENTS_NOT_PRESERVED",
                message: "One or more input SQL comments are missing or reordered after the SSSQL rewrite."
            });
        }

        return {
            ok: errors.length === 0,
            requiresFullReformat: false,
            edits,
            sql: plannedSql,
            safety: {
                tokenCountBefore: beforeTokens.length,
                tokenCountAfter: afterTokens.length,
                tokenSequencePreserved: plannedSql !== undefined ? tokenSequencesEqual(beforeTokens, afterTokens) : false,
                commentsPreserved,
                changedOnlyTargetBranches,
                changedRegions
            },
            warnings: planWarnings,
            errors
        };
    }

    private planRewrite(
        query: SelectQuery | string,
        rewrite: (query: SelectQuery) => SelectQuery
    ): SssqlRewritePlan {
        const warnings: SssqlRewritePlanWarning[] = [];
        const errors: SssqlRewritePlanError[] = [];
        const sourceSql = typeof query === "string"
            ? query
            : formatSqlComponent(query);

        if (typeof query !== "string") {
            warnings.push({
                code: "SOURCE_SQL_UNAVAILABLE",
                message: "SSSQL rewrite planning received an AST, so the source SQL had to be formatter-generated before analysis."
            });
        }

        let beforeTokens: RewriteTokenSignature[] = [];
        let beforeComments: string[] = [];
        try {
            beforeTokens = tokenizeForRewritePlan(sourceSql);
            beforeComments = collectCommentFragments(sourceSql);
        } catch (error) {
            errors.push({
                code: "TOKENIZE_BEFORE_FAILED",
                message: "Could not tokenize the input SQL before SSSQL rewrite planning.",
                detail: error instanceof Error ? error.message : error
            });
        }

        let plannedSql: string | undefined;
        let afterTokens: RewriteTokenSignature[] = [];
        let afterComments: string[] = [];

        if (errors.length === 0) {
            try {
                const parsed = SelectQueryParser.parse(sourceSql);
                const rewritten = rewrite(parsed);
                plannedSql = formatSqlComponent(rewritten);
            } catch (error) {
                errors.push({
                    code: "REWRITE_FAILED",
                    message: "SSSQL rewrite planning could not produce a rewritten query.",
                    detail: error instanceof Error ? error.message : error
                });
            }
        }

        if (plannedSql !== undefined) {
            try {
                SelectQueryParser.parse(plannedSql);
            } catch (error) {
                errors.push({
                    code: "PARSE_AFTER_FAILED",
                    message: "The SQL produced by SSSQL rewrite planning could not be parsed.",
                    detail: error instanceof Error ? error.message : error
                });
            }

            try {
                afterTokens = tokenizeForRewritePlan(plannedSql);
                afterComments = collectCommentFragments(plannedSql);
            } catch (error) {
                errors.push({
                    code: "TOKENIZE_AFTER_FAILED",
                    message: "Could not tokenize the SQL produced by SSSQL rewrite planning.",
                    detail: error instanceof Error ? error.message : error
                });
            }
        }

        const edits = plannedSql !== undefined && plannedSql !== sourceSql
            ? [{
                start: 0,
                end: sourceSql.length,
                before: sourceSql,
                after: plannedSql,
                kind: "replace" as const,
                reason: "Current SSSQL rewrite planning is backed by AST rewrite plus formatter output."
            }]
            : [];
        const changedRegions: SssqlRewriteChangedRegion[] = edits.length > 0
            ? [{
                kind: "formatter-rewrite",
                start: 0,
                end: sourceSql.length,
                message: "The conservative SSSQL rewrite plan requires replacing formatter output for the full SQL text."
            }]
            : [];
        const requiresFullReformat = edits.length > 0;
        const tokenSequencePreserved = plannedSql !== undefined
            ? tokenSequencesEqual(beforeTokens, afterTokens)
            : false;
        const commentsPreserved = plannedSql !== undefined
            ? commentsPreservedInOrder(beforeComments, afterComments)
            : false;
        const changedOnlyTargetBranches = edits.length === 0;

        if (requiresFullReformat) {
            warnings.push({
                code: "FULL_REFORMAT_REQUIRED",
                message: "The current SSSQL rewrite plan can only represent the change as a full SQL replacement."
            });
        }
        if (plannedSql !== undefined && !tokenSequencePreserved) {
            warnings.push({
                code: "TOKEN_SEQUENCE_CHANGED",
                message: "The SQL token sequence changes after the SSSQL rewrite. The conservative planner cannot prove that only target branches changed.",
                detail: {
                    tokenCountBefore: beforeTokens.length,
                    tokenCountAfter: afterTokens.length
                }
            });
        }
        if (plannedSql !== undefined && !commentsPreserved) {
            warnings.push({
                code: "COMMENTS_NOT_PRESERVED",
                message: "One or more input SQL comments are missing or reordered after the SSSQL rewrite."
            });
        }
        if (plannedSql !== undefined && countCommandToken(afterTokens, "as") > countCommandToken(beforeTokens, "as")) {
            warnings.push({
                code: "OPTIONAL_ALIAS_AS_ADDED",
                message: "The rewrite output contains more AS tokens than the input, which may indicate formatter-added aliases."
            });
        }
        if (plannedSql !== undefined && !sourceSql.includes("\"") && plannedSql.includes("\"")) {
            warnings.push({
                code: "IDENTIFIER_QUOTES_ADDED",
                message: "The rewrite output contains double-quoted identifiers that were not present in the input SQL."
            });
        }

        return {
            ok: errors.length === 0,
            requiresFullReformat,
            edits,
            sql: plannedSql,
            safety: {
                tokenCountBefore: beforeTokens.length,
                tokenCountAfter: afterTokens.length,
                tokenSequencePreserved,
                commentsPreserved,
                changedOnlyTargetBranches,
                changedRegions
            },
            warnings,
            errors
        };
    }

    private findMatchingBranchInfos(root: SelectQuery, spec: SssqlRemoveSpec): SssqlBranchInfo[] {
        const normalizedOperator = spec.operator ? normalizeScalarOperator(spec.operator) : undefined;
        const normalizedTarget = spec.target ? normalizeIdentifier(spec.target) : undefined;

        return this.list(root).filter(branch => {
            if (branch.parameterName !== spec.parameterName) {
                return false;
            }
            if (spec.kind && branch.kind !== spec.kind) {
                return false;
            }
            if (normalizedOperator && branch.operator !== normalizedOperator) {
                return false;
            }
            if (normalizedTarget && (!branch.target || normalizeIdentifier(branch.target) !== normalizedTarget)) {
                return false;
            }
            return true;
        });
    }

    private scaffoldScalarBranch(root: SelectQuery, spec: SssqlScalarScaffoldSpec): void {
        const target = this.resolveTarget(root, spec.target);
        const parameterName = spec.parameterName?.trim() || target.parameterName;
        const operator = normalizeScalarOperator(spec.operator);
        const branch = buildOptionalScalarBranch(target.column, parameterName, operator);
        const branchSql = normalizeSql(formatSqlComponent(branch));

        const duplicate = this.list(root).find(existing =>
            existing.query === target.query &&
            normalizeSql(existing.sql) === branchSql
        );
        if (duplicate) {
            return;
        }

        target.query.appendWhere(branch);
    }

    private scaffoldExistsBranch(root: SelectQuery, spec: SssqlExistsScaffoldSpec): void {
        const parameterName = spec.parameterName.trim();
        if (!parameterName) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires parameterName.");
        }
        if (spec.anchorColumns.length === 0) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires at least one anchorColumn.");
        }

        const anchorTargets = spec.anchorColumns.map(anchorColumn => this.resolveTarget(root, anchorColumn));
        const targetQueries = [...new Set(anchorTargets.map(target => target.query))];
        if (targetQueries.length !== 1) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold anchor columns must resolve within one query scope.");
        }

        const targetQuery = targetQueries[0]!;
        const formattedColumns = anchorTargets.map(target => formatSqlComponent(target.column));
        const substitutedSql = substituteAnchorPlaceholders(spec.query, formattedColumns).trim();
        enforceSubqueryConstraints(substitutedSql);

        const subquery = SelectQueryParser.parse(substitutedSql);
        const parameterNames = new Set(ParameterCollector.collect(subquery).map(parameter => parameter.name.value));
        if (parameterNames.size !== 1 || !parameterNames.has(parameterName)) {
            throw new Error(
                `SSSQL ${spec.kind.toUpperCase()} scaffold query must reference only parameter ':${parameterName}'.`
            );
        }

        const branch = buildOptionalExistsBranch(parameterName, subquery, spec.kind);
        const branchSql = normalizeSql(formatSqlComponent(branch));
        const duplicate = this.list(root).find(existing =>
            existing.query === targetQuery &&
            normalizeSql(existing.sql) === branchSql
        );
        if (duplicate) {
            return;
        }

        targetQuery.appendWhere(branch);
    }

    private resolveTarget(root: SelectQuery, filterName: string): ResolvedFilterTarget {
        const qualified = parseQualifiedFilterName(filterName);
        const lookupColumn = qualified?.column ?? filterName.trim();
        const candidateQueries = [...new Set(this.finder.find(root, lookupColumn))];

        const matches = candidateQueries
            .map(query => this.resolveTargetInQuery(query, filterName, qualified))
            .filter((target): target is ResolvedFilterTarget => target !== null);

        if (matches.length === 0) {
            throw new Error(`Could not resolve SSSQL filter target '${filterName}' in the current query graph.`);
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL filter target '${filterName}' is ambiguous across multiple query scopes.`);
        }

        return matches[0]!;
    }

    private resolveTargetInQuery(
        query: SimpleSelectQuery,
        filterName: string,
        qualified: ParsedFilterName | null
    ): ResolvedFilterTarget | null {
        if (qualified) {
            return this.resolveQualifiedTarget(query, qualified);
        }

        return this.resolveUnqualifiedTarget(query, filterName);
    }

    private resolveQualifiedTarget(query: SimpleSelectQuery, filterName: ParsedFilterName): ResolvedFilterTarget | null {
        const alias = this.findAliasForTable(query, filterName.table);
        if (!alias) {
            return null;
        }

        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeColumnReferenceKey(entry.value) === `${normalizeIdentifier(alias)}.${normalizeIdentifier(filterName.column)}`);

        if (matches.length === 0) {
            return null;
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL scaffold target '${filterName.table}.${filterName.column}' resolved to multiple columns.`);
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName: makeParameterName(`${filterName.table}.${filterName.column}`)
        };
    }

    private resolveUnqualifiedTarget(query: SimpleSelectQuery, filterName: string): ResolvedFilterTarget | null {
        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeIdentifier(entry.name) === normalizeIdentifier(filterName));

        if (matches.length === 0) {
            return null;
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL scaffold target '${filterName}' is ambiguous. Use a qualified table.column reference.`);
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName: makeParameterName(filterName)
        };
    }

    private tryResolveTarget(root: SelectQuery, filterName: string): ResolvedFilterTarget | null {
        try {
            return this.resolveTarget(root, filterName);
        } catch {
            return null;
        }
    }

    private findAliasForTable(query: SimpleSelectQuery, tableName: string): string | null {
        const normalizedTable = normalizeIdentifier(tableName);
        const sources = query.fromClause?.getSources() ?? [];
        const matchingAliases = sources
            .map(source => this.resolveAliasForSource(source, normalizedTable))
            .filter((alias): alias is string => alias !== null);

        if (matchingAliases.length === 0) {
            return null;
        }

        if (matchingAliases.length > 1) {
            throw new Error(`SSSQL scaffold target table '${tableName}' is ambiguous in the selected query scope.`);
        }

        return matchingAliases[0]!;
    }

    private resolveAliasForSource(source: SourceExpression, normalizedTable: string): string | null {
        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const sourceName = normalizeIdentifier(source.datasource.getSourceName());
        const shortName = normalizeIdentifier(source.datasource.table.name);
        if (sourceName !== normalizedTable && shortName !== normalizedTable) {
            return null;
        }

        return source.getAliasName() ?? source.datasource.table.name;
    }

    private buildCorrelatedRefreshPlan(
        root: SelectQuery,
        branch: SupportedOptionalConditionBranch
    ): CorrelatedRefreshPlan | null {
        const details = getExistsPredicateDetails(branch.expression, branch.parameterName);
        if (!details) {
            return null;
        }

        const sourceAliases = this.collectSourceAliases(branch.query);
        const candidatesByKey = new Map<string, CorrelatedAnchorReference>();

        for (const reference of new ColumnReferenceCollector().collect(details.subquery)) {
            const namespace = normalizeIdentifier(reference.getNamespace());
            if (!namespace || !sourceAliases.has(namespace)) {
                continue;
            }

            const column = normalizeIdentifier(reference.column.name);
            const key = `${namespace}.${column}`;
            if (!candidatesByKey.has(key)) {
                candidatesByKey.set(key, { namespace, column });
            }
        }

        const candidates = [...candidatesByKey.values()];
        if (candidates.length === 0) {
            throw new Error(
                `SSSQL refresh could not infer a correlated anchor for ':${branch.parameterName}'.`
            );
        }
        if (candidates.length > 1) {
            const listed = candidates.map(candidate => `${candidate.namespace}.${candidate.column}`).join(", ");
            throw new Error(
                `SSSQL refresh found multiple correlated anchor candidates for ':${branch.parameterName}' (${listed}).`
            );
        }

        const [anchor] = candidates;
        if (!anchor) {
            throw new Error(
                `SSSQL refresh could not infer a correlated anchor for ':${branch.parameterName}'.`
            );
        }

        return {
            target: this.resolveCorrelatedAnchorTarget(root, branch.query, anchor, branch.parameterName),
            sourceAlias: anchor.namespace
        };
    }

    private collectSourceAliases(query: SimpleSelectQuery): Set<string> {
        const aliases = new Set<string>();
        for (const source of query.fromClause?.getSources() ?? []) {
            const sourceAlias = this.getSourceAlias(source);
            if (sourceAlias) {
                aliases.add(sourceAlias);
            }
        }
        return aliases;
    }

    private resolveCorrelatedAnchorTarget(
        root: SelectQuery,
        sourceQuery: SimpleSelectQuery,
        anchor: CorrelatedAnchorReference,
        parameterName: string
    ): ResolvedFilterTarget {
        const sourceExpression = this.findSourceExpressionByAlias(sourceQuery, anchor.namespace, parameterName);
        const upstreamQuery = this.resolveSourceExpressionToUpstreamQuery(root, sourceExpression, parameterName);
        if (!upstreamQuery) {
            return {
                query: sourceQuery,
                column: new ColumnReference(anchor.namespace, anchor.column),
                parameterName
            };
        }

        return this.resolveAnchorTargetInQuery(upstreamQuery, anchor, parameterName);
    }

    private findSourceExpressionByAlias(
        query: SimpleSelectQuery,
        alias: string,
        parameterName: string
    ): SourceExpression {
        const matches = (query.fromClause?.getSources() ?? [])
            .filter(source => this.getSourceAlias(source) === alias);

        if (matches.length === 0) {
            throw new Error(
                `SSSQL refresh could not resolve correlated alias '${alias}' for ':${parameterName}'.`
            );
        }
        if (matches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple correlated sources for alias '${alias}' and ':${parameterName}'.`
            );
        }

        return matches[0]!;
    }

    private resolveSourceExpressionToUpstreamQuery(
        root: SelectQuery,
        source: SourceExpression,
        parameterName: string
    ): SimpleSelectQuery | null {
        if (source.datasource instanceof SubQuerySource) {
            if (source.datasource.query instanceof SimpleSelectQuery) {
                return source.datasource.query;
            }
            throw new Error(
                `SSSQL refresh requires a simple query anchor for ':${parameterName}'.`
            );
        }

        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const cteName = normalizeIdentifier(source.datasource.table.name);
        const cteMatches = new CTECollector()
            .collect(root)
            .filter(cte => normalizeIdentifier(cte.getSourceAliasName()) === cteName);

        if (cteMatches.length === 0) {
            return null;
        }
        if (cteMatches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple CTE anchors for ':${parameterName}' (${source.datasource.table.name}).`
            );
        }

        const [cte] = cteMatches;
        if (!cte) {
            return null;
        }

        const cteQuery = cte.query as unknown;
        if (!(cteQuery instanceof SimpleSelectQuery)) {
            throw new Error(
                `SSSQL refresh requires a simple CTE anchor for ':${parameterName}'.`
            );
        }

        return cteQuery;
    }

    private resolveAnchorTargetInQuery(
        query: SimpleSelectQuery,
        anchor: CorrelatedAnchorReference,
        parameterName: string
    ): ResolvedFilterTarget {
        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeIdentifier(entry.name) === anchor.column);

        if (matches.length === 0) {
            throw new Error(
                `SSSQL refresh could not resolve correlated anchor column '${anchor.column}' for ':${parameterName}'.`
            );
        }
        if (matches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple correlated anchor columns '${anchor.column}' for ':${parameterName}'.`
            );
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName
        };
    }

    private getSourceAlias(source: SourceExpression): string | null {
        const explicitAlias = source.getAliasName();
        if (explicitAlias) {
            return normalizeIdentifier(explicitAlias);
        }

        if (source.datasource instanceof TableSource) {
            return normalizeIdentifier(source.datasource.table.name);
        }

        return null;
    }

    private buildScalarRefreshPlan(
        root: SelectQuery,
        branch: SupportedOptionalConditionBranch,
        details: ScalarBranchDetails
    ): ResolvedFilterTarget | null {
        const sourceAlias = normalizeIdentifier(details.column.getNamespace());
        if (!sourceAlias) {
            return null;
        }

        const sourceExpression = this.findSourceExpressionByAlias(branch.query, sourceAlias, branch.parameterName);
        const upstreamQuery = this.resolveSourceExpressionToUpstreamQuery(root, sourceExpression, branch.parameterName);
        if (!upstreamQuery) {
            return null;
        }

        return this.resolveScalarTargetInQuery(upstreamQuery, details.column, branch.parameterName);
    }

    private resolveScalarTargetInQuery(
        query: SimpleSelectQuery,
        sourceColumn: ColumnReference,
        parameterName: string
    ): ResolvedFilterTarget {
        const outputColumnName = normalizeIdentifier(sourceColumn.column.name);
        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeIdentifier(entry.name) === outputColumnName);

        if (matches.length === 0) {
            throw new Error(
                `SSSQL refresh could not resolve scalar branch column '${sourceColumn.column.name}' for ':${parameterName}'.`
            );
        }
        if (matches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple scalar branch columns '${sourceColumn.column.name}' for ':${parameterName}'.`
            );
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName
        };
    }

    private isNullableBranchColumn(query: SimpleSelectQuery, column: ColumnReference): boolean {
        const alias = normalizeIdentifier(column.getNamespace());
        if (!alias || !query.fromClause) {
            return false;
        }

        const joins = query.fromClause.joins ?? [];
        const primaryAlias = this.getSourceAlias(query.fromClause.source);
        if (primaryAlias === alias) {
            return this.hasLaterJoinThatNullsPriorSources(joins, -1);
        }

        const joinIndex = joins.findIndex(join => this.getSourceAlias(join.source) === alias);
        if (joinIndex < 0) {
            return false;
        }

        const introducingJoin = joins[joinIndex]!;
        return this.isJoinedSourceNullable(introducingJoin)
            || this.hasLaterJoinThatNullsPriorSources(joins, joinIndex);
    }

    private hasLaterJoinThatNullsPriorSources(joins: readonly JoinClause[], sourceJoinIndex: number): boolean {
        return joins
            .slice(sourceJoinIndex + 1)
            .some(join => this.isPriorSourcesNullableJoin(join));
    }

    private isPriorSourcesNullableJoin(join: JoinClause): boolean {
        const joinType = join.joinType.value.toLowerCase();
        return joinType.includes("right") || joinType.includes("full");
    }

    private isJoinedSourceNullable(join: JoinClause): boolean {
        const joinType = join.joinType.value.toLowerCase();
        return joinType.includes("left") || joinType.includes("full");
    }

    private rebaseMovedBranch(
        expression: ValueComponent,
        sourceQuery: SimpleSelectQuery,
        targetColumn: ColumnReference
    ): void {
        const targetNamespace = targetColumn.qualifiedName.namespaces
            ? targetColumn.qualifiedName.namespaces.map(namespace => namespace.name)
            : null;
        const targetColumnName = normalizeIdentifier(targetColumn.column.name);
        const sourceAliases = new Set(
            collectColumnReferencesDeep(expression)
                .filter(reference => normalizeIdentifier(reference.column.name) === targetColumnName)
                .map(reference => normalizeIdentifier(reference.getNamespace()))
                .filter(namespace => namespace.length > 0)
        );

        if (sourceAliases.size === 0) {
            return;
        }

        if (sourceAliases.size > 1) {
            const aliases = [...sourceAliases].join(", ");
            throw new Error(
                `SSSQL refresh cannot safely rebase '${targetColumn.column.name}' across multiple aliases (${aliases}).`
            );
        }

        const [sourceAlias] = [...sourceAliases];
        const availableAliases = new Set(
            (sourceQuery.fromClause?.getSources() ?? [])
                .map(source => source.getAliasName())
                .filter((alias): alias is string => typeof alias === "string")
                .map(alias => normalizeIdentifier(alias))
        );

        if (!availableAliases.has(sourceAlias)) {
            return;
        }

        for (const reference of collectColumnReferencesDeep(expression)) {
            if (normalizeIdentifier(reference.getNamespace()) !== sourceAlias) {
                continue;
            }

            reference.qualifiedName.namespaces = targetNamespace?.map(namespace => new IdentifierString(namespace)) ?? null;
        }
    }

    private rebaseMovedBranchByAlias(
        expression: ValueComponent,
        sourceAlias: string,
        targetColumn: ColumnReference
    ): void {
        const normalizedSourceAlias = normalizeIdentifier(sourceAlias);
        if (!normalizedSourceAlias) {
            return;
        }

        const targetNamespace = targetColumn.qualifiedName.namespaces
            ? targetColumn.qualifiedName.namespaces.map(namespace => namespace.name)
            : null;

        for (const reference of collectColumnReferencesDeep(expression)) {
            if (normalizeIdentifier(reference.getNamespace()) !== normalizedSourceAlias) {
                continue;
            }

            reference.qualifiedName.namespaces = targetNamespace?.map(namespace => new IdentifierString(namespace)) ?? null;
        }
    }
}

export type { SupportedOptionalConditionBranch };

export const scaffoldSssqlQuery = (
    sqlContent: string,
    filters: SssqlScaffoldFilters
): SssqlTransformResult => ({
    query: new SSSQLFilterBuilder().scaffold(sqlContent, filters)
});

export const refreshSssqlQuery = (
    sqlContent: string,
    filters: SssqlScaffoldFilters
): SssqlTransformResult => ({
    query: new SSSQLFilterBuilder().refresh(sqlContent, filters)
});
