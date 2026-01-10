import { BinaryExpression, ColumnReference, ValueComponent } from '../models/ValueComponent';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../models/SelectQuery';
import { ColumnReferenceCollector } from './ColumnReferenceCollector';
import { CTETableReferenceCollector } from './CTETableReferenceCollector';
import { JoinClause, JoinOnClause, TableSource } from '../models/Clause';
import { SqlComponent } from '../models/SqlComponent';

/**
 * Captures the schema metadata required to safely evaluate LEFT JOIN removal.
 */
export interface SchemaTableInfo {
    /** The fully qualified table name that appears in SQL references. */
    name: string;
    /** Column names that exist on the table for any schema validation steps. */
    columns: string[];
    /**
     * Unique key declarations for the table.
     * Each entry is an array of column names that together form a uniqueness constraint.
     */
    uniqueKeys: string[][];
}

/** Ordered set of table metadata consumed by the optimizer. */
export type SchemaInfo = SchemaTableInfo[];

interface NormalizedTableInfo {
    columnSet: Set<string>;
    uniqueSetKeys: Set<string>;
}

const NAMESPACE_SEPARATOR = '|';

const normalizeIdentifier = (input: string | null | undefined): string => {
    const value = input?.trim() ?? '';
    return value === '' ? '' : value.toLowerCase();
};

const normalizeColumnSetKey = (columns: string[]): string => {
    return columns
        .map(column => normalizeIdentifier(column))
        .filter(Boolean)
        .sort()
        .join(NAMESPACE_SEPARATOR);
};

const buildSchemaMap = (schemaInfo: SchemaInfo): Map<string, NormalizedTableInfo> => {
    const map = new Map<string, NormalizedTableInfo>();

    // Normalize table names and precompute reusable sets for column lookups.
    for (const table of schemaInfo) {
        const normalizedName = normalizeIdentifier(table.name);
        if (!normalizedName) {
            continue;
        }

        const columnSet = new Set(table.columns.map(normalizeIdentifier).filter(Boolean));
        const uniqueSetKeys = new Set<string>();
        for (const uniqueKey of table.uniqueKeys) {
            const normalizedKey = normalizeColumnSetKey(uniqueKey);
            if (normalizedKey) {
                uniqueSetKeys.add(normalizedKey);
            }
        }

        if (columnSet.size === 0 && uniqueSetKeys.size === 0) {
            continue;
        }

        map.set(normalizedName, { columnSet, uniqueSetKeys });
    }

    return map;
};

interface ReferenceMetadata {
    namespaceCounts: Map<string, number>;
    unqualifiedColumns: Set<string>;
    joinConditionCounts: Map<JoinClause, Map<string, number>>;
}

const collectReferenceMetadata = (query: SimpleSelectQuery): ReferenceMetadata => {
    const collector = new ColumnReferenceCollector();
    const namespaceCounts = new Map<string, number>();
    const unqualifiedColumns = new Set<string>();

    // Track every column reference in the query so we can detect aliases used outside their JOINs.
    for (const ref of collector.collect(query)) {
        const namespace = normalizeIdentifier(ref.getNamespace());
        if (namespace) {
            namespaceCounts.set(namespace, (namespaceCounts.get(namespace) ?? 0) + 1);
        } else {
            const column = normalizeIdentifier(ref.column.name);
            if (column) {
                unqualifiedColumns.add(column);
            }
        }
    }

    const joinConditionCounts = new Map<JoinClause, Map<string, number>>();

    if (query.fromClause?.joins) {
        for (const join of query.fromClause.joins) {
            const counts = new Map<string, number>();
            if (join.condition && join.condition instanceof JoinOnClause) {
                const joinCollector = new ColumnReferenceCollector();
                for (const ref of joinCollector.collect(join.condition.condition)) {
                    const namespace = normalizeIdentifier(ref.getNamespace());
                    if (namespace) {
                        counts.set(namespace, (counts.get(namespace) ?? 0) + 1);
                    }
                }
            }
            joinConditionCounts.set(join, counts);
        }
    }

    return { namespaceCounts, unqualifiedColumns, joinConditionCounts };
};

const isLeftJoin = (join: JoinClause): boolean => {
    return join.joinType.value.toLowerCase().includes('left');
};

const getJoinIdentifiers = (join: JoinClause): string[] => {
    const identifiers: Set<string> = new Set();
    const alias = normalizeIdentifier(join.source.getAliasName());
    if (alias) {
        identifiers.add(alias);
    }

    if (join.source.datasource instanceof TableSource) {
        const rawName = join.source.datasource.getSourceName();
        if (rawName) {
            identifiers.add(normalizeIdentifier(rawName));
        }

        const shortName = normalizeIdentifier(join.source.datasource.table.name);
        if (shortName) {
            identifiers.add(shortName);
        }
    }

    return [...identifiers];
};

const hasExternalReferences = (
    identifiers: string[],
    metadata: ReferenceMetadata,
    join: JoinClause
): boolean => {
    const local = metadata.joinConditionCounts.get(join) ?? new Map();
    for (const identifier of identifiers) {
        const total = metadata.namespaceCounts.get(identifier) ?? 0;
        const localCount = local.get(identifier) ?? 0;
        if (total - localCount > 0) {
            return true;
        }
    }
    return false;
};

const getJoinColumnInfo = (join: JoinClause, identifiers: Set<string>): string | null => {
    if (!(join.condition instanceof JoinOnClause)) {
        return null;
    }

    const expression = join.condition.condition;
    if (!(expression instanceof BinaryExpression)) {
        return null;
    }

    const operatorValue = expression.operator.value.trim().toLowerCase();
    if (operatorValue !== '=') {
        return null;
    }

    const resolveColumn = (component: ValueComponent): ColumnReference | null => {
        return component instanceof ColumnReference ? component : null;
    };

    const leftRef = resolveColumn(expression.left);
    const rightRef = resolveColumn(expression.right);

    if (!leftRef || !rightRef) {
        return null;
    }

    const normalizedLeftNamespace = normalizeIdentifier(leftRef.getNamespace());
    const normalizedRightNamespace = normalizeIdentifier(rightRef.getNamespace());

    if (identifiers.has(normalizedLeftNamespace)) {
        return normalizeIdentifier(leftRef.column.name);
    }

    if (identifiers.has(normalizedRightNamespace)) {
        return normalizeIdentifier(rightRef.column.name);
    }

    return null;
};

const shouldRemoveJoin = (
    join: JoinClause,
    schemaMap: Map<string, NormalizedTableInfo>,
    metadata: ReferenceMetadata
): boolean => {
    if (!isLeftJoin(join) || join.lateral) {
        return false;
    }

    if (!(join.source.datasource instanceof TableSource)) {
        return false;
    }

    const candidates = [
        normalizeIdentifier(join.source.datasource.getSourceName()),
        normalizeIdentifier(join.source.datasource.table.name)
    ].filter(Boolean);

    let tableInfo: NormalizedTableInfo | undefined;
    for (const candidate of candidates) {
        const info = schemaMap.get(candidate);
        if (info) {
            tableInfo = info;
            break;
        }
    }

    if (!tableInfo) {
        return false;
    }

    const identifiers = new Set(getJoinIdentifiers(join));
    if (identifiers.size === 0) {
        return false;
    }

    if (hasExternalReferences([...identifiers], metadata, join)) {
        return false;
    }

    const joinColumn = getJoinColumnInfo(join, identifiers);
    if (!joinColumn) {
        return false;
    }

    if (metadata.unqualifiedColumns.has(joinColumn)) {
        return false;
    }

    if (tableInfo.columnSet.size > 0 && !tableInfo.columnSet.has(joinColumn)) {
        return false;
    }

    const uniqueKey = normalizeColumnSetKey([joinColumn]);
    if (!tableInfo.uniqueSetKeys.has(uniqueKey)) {
        return false;
    }

    return true;
};

const optimizeSimpleQuery = (
    query: SimpleSelectQuery,
    schemaMap: Map<string, NormalizedTableInfo>
): boolean => {
    if (!query.fromClause?.joins?.length) {
        return false;
    }

    const metadata = collectReferenceMetadata(query);
    const retainedJoins: JoinClause[] = [];
    let removed = false;

    for (const join of query.fromClause.joins) {
        if (shouldRemoveJoin(join, schemaMap, metadata)) {
            removed = true;
            continue;
        }
        retainedJoins.push(join);
    }

    query.fromClause.joins = retainedJoins.length > 0 ? retainedJoins : null;
    return removed;
};

const traverseSelectQuery = (
    query: SelectQuery,
    schemaMap: Map<string, NormalizedTableInfo>
): boolean => {
    if (query instanceof SimpleSelectQuery) {
        return optimizeSimpleQuery(query, schemaMap);
    }

    if (query instanceof BinarySelectQuery) {
        const leftChanged = traverseSelectQuery(query.left, schemaMap);
        const rightChanged = traverseSelectQuery(query.right, schemaMap);
        return leftChanged || rightChanged;
    }

    return false;
};

const optimizeUnusedLeftJoinsOnce = (
    query: SelectQuery,
    schemaMap: Map<string, NormalizedTableInfo>
): boolean => {
    if (schemaMap.size === 0) {
        return false;
    }
    return traverseSelectQuery(query, schemaMap);
};

/**
 * Removes LEFT JOIN clauses from the provided query when AST references prove the join target is unused and schema metadata certifies the join column is unique.
 */
export const optimizeUnusedLeftJoins = (query: SelectQuery, schemaInfo: SchemaInfo): SelectQuery => {
    optimizeUnusedLeftJoinsOnce(query, buildSchemaMap(schemaInfo));
    return query;
};

/**
 * Applies the unused left join optimizer until no further joins can be trimmed, ensuring cascading removals stabilize.
 */
export const optimizeUnusedLeftJoinsToFixedPoint = (
    query: SelectQuery,
    schemaInfo: SchemaInfo
): SelectQuery => {
    const schemaMap = buildSchemaMap(schemaInfo);
    let changed = true;
    while (changed) {
        changed = optimizeUnusedLeftJoinsOnce(query, schemaMap);
    }
    return query;
};

const collectTableSourceNames = (component: SqlComponent): Set<string> => {
    const collector = new CTETableReferenceCollector();
    const names = new Set<string>();
    for (const source of collector.collect(component)) {
        const normalizedName = normalizeIdentifier(source.table.name);
        if (normalizedName) {
            names.add(normalizedName);
        }
    }
    return names;
};

const isReferencedByOthers = (
    cteName: string,
    mainReferences: Set<string>,
    cteReferenceMap: Map<string, Set<string>>
): boolean => {
    if (mainReferences.has(cteName)) {
        return true;
    }

    for (const [otherName, references] of cteReferenceMap) {
        if (otherName === cteName) {
            continue;
        }
        if (references.has(cteName)) {
            return true;
        }
    }

    return false;
};

const optimizeSimpleQueryCtes = (query: SimpleSelectQuery): boolean => {
    const withClause = query.withClause;

    if (!withClause || withClause.recursive || withClause.tables.length === 0) {
        return false;
    }

    const mainReferences = collectTableSourceNames(query);
    const cteReferenceMap = new Map<string, Set<string>>();

    for (const table of withClause.tables) {
        const normalizedName = normalizeIdentifier(table.aliasExpression.table.name);
        if (!normalizedName) {
            continue;
        }
        cteReferenceMap.set(normalizedName, collectTableSourceNames(table.query));
    }

    const removableNames: string[] = [];
    for (const table of withClause.tables) {
        const normalizedName = normalizeIdentifier(table.aliasExpression.table.name);
        if (!normalizedName) {
            continue;
        }

        const body = table.query;
        if (!(body instanceof SimpleSelectQuery) && !(body instanceof BinarySelectQuery)) {
            continue;
        }

        if (isReferencedByOthers(normalizedName, mainReferences, cteReferenceMap)) {
            continue;
        }

        removableNames.push(normalizedName);
    }

    if (removableNames.length === 0) {
        return false;
    }

    // Use the public removal API so the internal CTE cache stays consistent.
    for (const name of removableNames) {
        query.removeCTE(name);
    }

    return true;
};

const optimizeCtesInSelectQuery = (query: SelectQuery): boolean => {
    if (query instanceof SimpleSelectQuery) {
        return optimizeSimpleQueryCtes(query);
    }

    if (query instanceof BinarySelectQuery) {
        const leftChanged = optimizeCtesInSelectQuery(query.left);
        const rightChanged = optimizeCtesInSelectQuery(query.right);
        return leftChanged || rightChanged;
    }

    return false;
};

const optimizeUnusedCtesOnce = (query: SelectQuery): boolean => {
    return optimizeCtesInSelectQuery(query);
};

/**
 * Removes unused SELECT-only CTEs from the query when AST references confirm they are never consumed.
 */
export const optimizeUnusedCtes = (query: SelectQuery): SelectQuery => {
    optimizeUnusedCtesOnce(query);
    return query;
};

/**
 * Repeatedly prunes unused CTEs until a fixed point is reached so chained removals complete deterministically.
 */
export const optimizeUnusedCtesToFixedPoint = (query: SelectQuery): SelectQuery => {
    let changed = true;
    while (changed) {
        changed = optimizeUnusedCtesOnce(query);
    }
    return query;
};
