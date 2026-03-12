import { WhereClause } from '../models/Clause';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../models/SelectQuery';
import {
    BinaryExpression,
    InlineQuery,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    RawString,
    SqlParameterValue,
    UnaryExpression,
    ValueComponent
} from '../models/ValueComponent';
import { ParameterCollector } from './ParameterCollector';

export type OptionalConditionPruningParameters = Record<string, SqlParameterValue>;
export type OptionalConditionParameterState = 'absent' | 'present' | 'unknown';
export type OptionalConditionParameterStates = Record<string, OptionalConditionParameterState>;

const SUPPORTED_COMPARISON_OPERATORS = new Set(['=', '<>', '!=', '>', '>=', '<', '<=']);

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

const isSupportedScalarPredicate = (expression: ValueComponent, parameterName: string): boolean => {
    const candidate = unwrapSingleOuterParen(expression);
    if (!(candidate instanceof BinaryExpression)) {
        return false;
    }

    const operator = candidate.operator.value.trim().toLowerCase();
    if (!SUPPORTED_COMPARISON_OPERATORS.has(operator)) {
        return false;
    }

    const leftIsTargetParameter = candidate.left instanceof ParameterExpression && candidate.left.name.value === parameterName;
    const rightIsTargetParameter = candidate.right instanceof ParameterExpression && candidate.right.name.value === parameterName;

    if (leftIsTargetParameter === rightIsTargetParameter) {
        return false;
    }

    return getUniqueParameterNames(candidate).size === 1;
};

const isSupportedExistsPredicate = (expression: ValueComponent, parameterName: string): boolean => {
    const candidate = unwrapSingleOuterParen(expression);
    if (!(candidate instanceof UnaryExpression) || candidate.operator.value.trim().toLowerCase() !== 'exists') {
        return false;
    }

    if (!(candidate.expression instanceof InlineQuery)) {
        return false;
    }

    const parameterNames = getUniqueParameterNames(candidate.expression);
    return parameterNames.size === 1 && parameterNames.has(parameterName);
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
    const candidate = unwrapSingleOuterParen(expression);
    if (!isBinaryOperator(candidate, 'or')) {
        return false;
    }

    const parameterName = getGuardedParameterName(candidate.left);
    if (!parameterName) {
        return false;
    }

    const supportedMeaningfulBranch =
        isSupportedScalarPredicate(candidate.right, parameterName) ||
        isSupportedExistsPredicate(candidate.right, parameterName);

    if (!supportedMeaningfulBranch) {
        return false;
    }

    return isKnownAbsentTarget(pruningParameters, parameterName);
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
