import { WhereClause } from '../models/Clause';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../models/SelectQuery';
import {
    BinaryExpression,
    InlineQuery,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    RawString,
    UnaryExpression,
    ValueComponent
} from '../models/ValueComponent';
import { ParameterCollector } from './ParameterCollector';

export type OptionalConditionParameterState = 'absent' | 'present' | 'unknown';
export type OptionalConditionParameterStates = Record<string, OptionalConditionParameterState>;

const SUPPORTED_COMPARISON_OPERATORS = new Set(['=', '<>', '!=', '>', '>=', '<', '<=']);

const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    return expression instanceof BinaryExpression && expression.operator.value.trim().toLowerCase() === operator;
};

const unwrapSingleOuterParen = (expression: ValueComponent): ValueComponent => {
    return expression instanceof ParenExpression ? expression.expression : expression;
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

const shouldPruneOptionalBranch = (
    expression: ValueComponent,
    parameterStates: OptionalConditionParameterStates
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

    return parameterStates[parameterName] === 'absent';
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
    parameterStates: OptionalConditionParameterStates
): boolean => {
    if (!query.whereClause) {
        return false;
    }

    const topLevelTerms = collectTopLevelAndTerms(query.whereClause.condition);
    const retainedTerms: ValueComponent[] = [];
    let prunedAnyBranch = false;

    // Only top-level WHERE ... AND ... terms are eligible for pruning in this MVP.
    for (const term of topLevelTerms) {
        if (shouldPruneOptionalBranch(term, parameterStates)) {
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
    parameterStates: OptionalConditionParameterStates
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
            changed = traverseSelectQuery(value, parameterStates) || changed;
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
    parameterStates: OptionalConditionParameterStates
): boolean => {
    if (query instanceof SimpleSelectQuery) {
        const selfChanged = pruneSimpleQueryWhereClause(query, parameterStates);
        const nestedChanged = traverseNestedSelectQueries(query, parameterStates);
        return selfChanged || nestedChanged;
    }

    if (query instanceof BinarySelectQuery) {
        const leftChanged = traverseSelectQuery(query.left, parameterStates);
        const rightChanged = traverseSelectQuery(query.right, parameterStates);
        return leftChanged || rightChanged;
    }

    return false;
};

/**
 * Prunes supported optional WHERE branches when their guard parameter is known absent.
 * Unsupported or ambiguous shapes remain exact no-op for the MVP.
 */
export const pruneOptionalConditionBranches = (
    query: SelectQuery,
    parameterStates: OptionalConditionParameterStates
): SelectQuery => {
    if (Object.keys(parameterStates).length === 0) {
        return query;
    }

    traverseSelectQuery(query, parameterStates);
    return query;
};
