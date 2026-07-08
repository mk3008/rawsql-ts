import { WhereClause } from "../models/Clause";
import {
    BinaryExpression,
    ColumnReference,
    ParenExpression,
    ValueComponent
} from "../models/ValueComponent";
import { ValueParser } from "../parsers/ValueParser";
import { formatSqlComponent, SqlComponentFormatOptions } from "./SqlComponentFormatter";

export const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const isCaseSensitiveIdentifier = (value: string): boolean => /[A-Z]/.test(value.trim());

export const identifiersEqual = (left: string, right: string): boolean => {
    const trimmedLeft = left.trim();
    const trimmedRight = right.trim();
    return isCaseSensitiveIdentifier(trimmedLeft) || isCaseSensitiveIdentifier(trimmedRight)
        ? trimmedLeft === trimmedRight
        : trimmedLeft.toLowerCase() === trimmedRight.toLowerCase();
};

export const unwrapParens = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }
    return candidate;
};

export const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    const candidate = unwrapParens(expression);
    return candidate instanceof BinaryExpression
        && candidate.operator.value.trim().toLowerCase() === operator;
};

export const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "and")) {
        return [expression];
    }

    return [
        ...collectTopLevelAndTerms(candidate.left),
        ...collectTopLevelAndTerms(candidate.right)
    ];
};

export const rebuildWhereWithoutTerms = (
    query: { whereClause: WhereClause | null },
    termsToRemove: ReadonlySet<ValueComponent>
): void => {
    if (!query.whereClause || termsToRemove.size === 0) {
        return;
    }

    const remaining = collectTopLevelAndTerms(query.whereClause.condition)
        .filter(term => !termsToRemove.has(term));

    if (remaining.length === 0) {
        query.whereClause = null;
        return;
    }

    let rebuilt = remaining[0]!;
    for (let index = 1; index < remaining.length; index += 1) {
        rebuilt = new BinaryExpression(rebuilt, "and", remaining[index]!);
    }
    query.whereClause = new WhereClause(rebuilt);
};

// API output shape review: this helper preserves the existing AST -> SQL -> AST clone path used by callers without changing public result.sql/result.query shapes.
export const cloneValueComponent = (
    expression: ValueComponent,
    options: SqlComponentFormatOptions
): ValueComponent => {
    return ValueParser.parse(formatSqlComponent(expression, options));
};

export const cloneColumnReference = (reference: ColumnReference): ColumnReference => {
    const namespaces = reference.namespaces?.map(namespace => namespace.name) ?? null;
    return new ColumnReference(namespaces, reference.column.name);
};

export const columnReferenceText = (reference: ColumnReference): string => {
    const namespace = reference.getNamespace();
    return namespace ? `${namespace}.${reference.column.name}` : reference.column.name;
};

export const sameColumnReference = (left: ColumnReference, right: ColumnReference): boolean => {
    return identifiersEqual(left.column.name, right.column.name)
        && identifiersEqual(left.getNamespace(), right.getNamespace());
};

export const appendUnique = <T>(items: T[], value: T): void => {
    if (!items.includes(value)) {
        items.push(value);
    }
};
