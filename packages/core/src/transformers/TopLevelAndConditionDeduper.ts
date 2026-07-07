import { WhereClause } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SelectQuery";
import {
    BinaryExpression,
    ParenExpression,
    ValueComponent
} from "../models/ValueComponent";
import { formatSqlComponent, SqlComponentFormatOptions } from "./SqlComponentFormatter";

// API output shape review: this internal helper keeps optimizer result sql/query shape unchanged;
// formatSqlComponent is used only as a caller-configurable canonical key for exact duplicate detection.
const unwrapParens = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }
    return candidate;
};

const isAndExpression = (expression: ValueComponent): expression is BinaryExpression => {
    const candidate = unwrapParens(expression);
    return candidate instanceof BinaryExpression
        && candidate.operator.value.trim().toLowerCase() === "and";
};

const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isAndExpression(candidate)) {
        return [expression];
    }

    return [
        ...collectTopLevelAndTerms(candidate.left),
        ...collectTopLevelAndTerms(candidate.right)
    ];
};

export const dedupeTopLevelAndConditions = (
    expression: ValueComponent,
    options: SqlComponentFormatOptions
): ValueComponent => {
    const terms = collectTopLevelAndTerms(expression);
    if (terms.length < 2) {
        return expression;
    }

    const seen = new Set<string>();
    const uniqueTerms: ValueComponent[] = [];
    for (const term of terms) {
        const key = formatSqlComponent(unwrapParens(term), options);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        uniqueTerms.push(term);
    }

    if (uniqueTerms.length === terms.length) {
        return expression;
    }

    let rebuilt = uniqueTerms[0]!;
    for (let index = 1; index < uniqueTerms.length; index += 1) {
        rebuilt = new BinaryExpression(rebuilt, "and", uniqueTerms[index]!);
    }
    return rebuilt;
};

export const dedupeWhereTopLevelAndConditions = (
    query: SimpleSelectQuery,
    options: SqlComponentFormatOptions
): void => {
    if (!query.whereClause) {
        return;
    }

    query.whereClause = new WhereClause(dedupeTopLevelAndConditions(query.whereClause.condition, options));
};
