import { CommonTable, FromClause, SelectItem, SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ColumnReference } from "../models/ValueComponent";
import {
    ClauseScopedColumnReferenceClause,
    ClauseScopedColumnReferenceCollector,
    ClauseScopedColumnReferenceInfo
} from "./ClauseScopedColumnReferenceCollector";
import { SelectOutputCollector } from "./SelectOutputCollector";

/** Kind of named query boundary whose wildcard output is being inferred. */
export type WildcardColumnInferenceTargetKind = "cte" | "derivedTable";

/** Syntax form of the wildcard SELECT item that may supply required columns. */
export type WildcardColumnInferenceWildcardKind = "qualified" | "unqualified";

/** Conservative reason why a downstream requirement could not be assigned to one wildcard supplier. */
export type WildcardColumnInferenceUnresolvedReason =
    | "duplicateOutputOwnership"
    | "multipleWildcardSuppliers"
    | "unqualifiedWildcardMultipleSources"
    | "noWildcardSupplier"
    | "unsupportedQueryShape";

/** Clause-scoped downstream reference that requires an output column from the target. */
export interface WildcardColumnInferenceRequiredBy {
    /** Clause that owns the downstream reference. */
    clause: ClauseScopedColumnReferenceClause;
    /** SQL text form of the downstream column reference. */
    qualifiedName: string;
    /** Namespace or alias used by the downstream reference, if present. */
    namespace: string | null;
    /** Output column name required by the downstream reference. */
    column: string;
}

/** Metadata for a wildcard SELECT item inside the target query. */
export interface WildcardColumnInferenceWildcard {
    /** Whether the wildcard was written as `*` or as a qualified form such as `a.*`. */
    kind: WildcardColumnInferenceWildcardKind;
    /** SELECT-list position of the wildcard item. */
    outputIndex: number;
    /** Source alias that the wildcard can safely be associated with, when known. */
    sourceAlias: string | null;
    /** Physical source name for the wildcard source, when it is statically visible. */
    sourceName: string | null;
}

/** Explicit non-wildcard output preserved alongside inferred wildcard requirements. */
export interface WildcardColumnInferenceExplicitColumn {
    /** Output name exposed by the explicit SELECT item. */
    outputName: string;
    /** Source alias for a simple qualified column expression, when uniquely known. */
    sourceAlias: string | null;
    /** Physical source name for a simple qualified column expression, when uniquely known. */
    sourceName: string | null;
    /** Source column name for a simple qualified column expression, when uniquely known. */
    sourceColumnName: string | null;
}

/** Resolved required column supplied by a single unambiguous wildcard. */
export interface WildcardColumnInferenceResolvedColumn {
    /** Output column name required from the target. */
    outputName: string;
    /** Source alias selected as the wildcard supplier. */
    sourceAlias: string | null;
    /** Physical source name selected as the wildcard supplier, when known. */
    sourceName: string | null;
    /** Source column name inferred from the downstream output requirement. */
    sourceColumnName: string;
    /** Wildcard SELECT item that supplies this required column. */
    wildcard: WildcardColumnInferenceWildcard;
    /** Distinct downstream clauses that required this column. */
    requiredByClause: ClauseScopedColumnReferenceClause[];
    /** Clause-scoped downstream references that required this column. */
    requiredBy: WildcardColumnInferenceRequiredBy[];
}

/** Required output column that could not be assigned to a single wildcard supplier. */
export interface WildcardColumnInferenceUnresolvedColumn {
    /** Output column name required from the target. */
    outputName: string;
    /** Conservative reason why inference did not choose a supplier. */
    reason: WildcardColumnInferenceUnresolvedReason;
    /** Candidate wildcard suppliers visible for this requirement. */
    candidateWildcards: WildcardColumnInferenceWildcard[];
    /** Distinct downstream clauses that required this column. */
    requiredByClause: ClauseScopedColumnReferenceClause[];
    /** Clause-scoped downstream references that required this column. */
    requiredBy: WildcardColumnInferenceRequiredBy[];
}

/** Metadata-only wildcard inference result for one CTE or derived table target. */
export interface WildcardColumnInferenceResult {
    /** Kind of target whose wildcard output was inspected. */
    targetKind: WildcardColumnInferenceTargetKind;
    /** CTE name for CTE targets, otherwise null. */
    targetName: string | null;
    /** Alias used by the downstream consumer when available. */
    targetAlias: string | null;
    /** Wildcard SELECT items found inside the target query. */
    wildcards: WildcardColumnInferenceWildcard[];
    /** Explicit non-wildcard outputs found inside the target query. */
    explicitColumns: WildcardColumnInferenceExplicitColumn[];
    /** Downstream requirements assigned to exactly one wildcard supplier. */
    requiredColumns: WildcardColumnInferenceResolvedColumn[];
    /** Downstream requirements that were intentionally left unresolved. */
    unresolvedColumns: WildcardColumnInferenceUnresolvedColumn[];
}

interface TargetDescriptor {
    key: string;
    targetKind: WildcardColumnInferenceTargetKind;
    targetName: string | null;
    targetAlias: string | null;
    query: SelectQuery;
}

interface TargetRequirement {
    descriptor: TargetDescriptor;
    requiredByColumn: Map<string, WildcardColumnInferenceRequiredBy[]>;
}

interface TargetOutputMetadata {
    wildcards: WildcardColumnInferenceWildcard[];
    explicitColumns: WildcardColumnInferenceExplicitColumn[];
    unqualifiedWildcardWithMultipleSources: boolean;
}

const clauseOrder: ClauseScopedColumnReferenceClause[] = [
    "select",
    "where",
    "joinOn",
    "groupBy",
    "having",
    "orderBy",
    "window",
    "limitOffset"
];

/**
 * Infers the subset of wildcard columns required by downstream references.
 *
 * This collector only returns metadata. It does not rewrite SQL and does not attempt full
 * table-column discovery. When ownership is ambiguous, the requirement is reported as unresolved.
 */
export class WildcardColumnInferenceCollector {
    private readonly clauseCollector = new ClauseScopedColumnReferenceCollector();
    private readonly requirements = new Map<string, TargetRequirement>();
    private readonly visitedQueries = new Set<object>();
    private nextObjectId = 0;
    private objectIds = new WeakMap<object, number>();

    /**
     * Collect wildcard column inference metadata for CTEs and derived tables visible in a SELECT query.
     */
    public collect(query: SelectQuery): WildcardColumnInferenceResult[] {
        this.requirements.clear();
        this.visitedQueries.clear();
        this.nextObjectId = 0;
        this.objectIds = new WeakMap<object, number>();
        this.collectFromSelectQuery(query, []);
        return [...this.requirements.values()].map(item => this.inferTarget(item));
    }

    private collectFromSelectQuery(query: SelectQuery, commonTables: CommonTable[]): void {
        if (this.visitedQueries.has(query)) {
            return;
        }
        this.visitedQueries.add(query);

        if (query instanceof BinarySelectQuery) {
            const rightCommonTables = this.mergeCommonTables(commonTables, this.collectLeadingCommonTables(query.left));
            this.collectFromSelectQuery(query.left, commonTables);
            this.collectFromSelectQuery(query.right, rightCommonTables);
            return;
        }

        if (!(query instanceof SimpleSelectQuery)) {
            return;
        }

        const scopedCommonTables = this.mergeCommonTables(commonTables, query.withClause?.tables ?? []);
        this.collectConsumerRequirements(query, scopedCommonTables);
        this.collectNestedSources(query.fromClause, scopedCommonTables);

        for (const commonTable of query.withClause?.tables ?? []) {
            this.collectCteQuery(commonTable.query, scopedCommonTables);
        }
    }

    private collectCteQuery(query: unknown, commonTables: CommonTable[]): void {
        if (this.isSelectQuery(query)) {
            this.collectFromSelectQuery(query, commonTables);
        }
    }

    private collectConsumerRequirements(query: SimpleSelectQuery, commonTables: CommonTable[]): void {
        if (!query.fromClause) {
            return;
        }

        const targets = this.collectConsumerTargets(query.fromClause, commonTables);
        if (targets.length === 0) {
            return;
        }

        const targetByMatchName = new Map<string, TargetDescriptor[]>();
        for (const target of targets) {
            for (const name of this.getTargetMatchNames(target)) {
                const existing = targetByMatchName.get(name) ?? [];
                existing.push(target);
                targetByMatchName.set(name, existing);
            }
        }

        const singleUnqualifiedTarget = query.fromClause.getSources().length === 1 && targets.length === 1 ? targets[0] : null;
        for (const reference of this.flattenReferences(this.clauseCollector.collect(query))) {
            if (reference.column === "*") {
                continue;
            }

            const matchedTarget = reference.namespace
                ? this.getUniqueTarget(targetByMatchName.get(reference.namespace) ?? [])
                : singleUnqualifiedTarget;

            if (matchedTarget) {
                this.addRequirement(matchedTarget, reference.column, this.createRequiredBy(reference));
            }
        }
    }

    private collectConsumerTargets(fromClause: FromClause, commonTables: CommonTable[]): TargetDescriptor[] {
        const targets: TargetDescriptor[] = [];
        for (const source of fromClause.getSources()) {
            const cteTarget = this.createCteTarget(source, commonTables);
            if (cteTarget) {
                targets.push(cteTarget);
                continue;
            }

            const derivedTarget = this.createDerivedTableTarget(source);
            if (derivedTarget) {
                targets.push(derivedTarget);
            }
        }
        return targets;
    }

    private createCteTarget(source: SourceExpression, commonTables: CommonTable[]): TargetDescriptor | null {
        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const tableName = source.datasource.getSourceName();
        const commonTable = commonTables.find(item => item.getSourceAliasName() === tableName);
        if (!commonTable || !this.isSelectQuery(commonTable.query)) {
            return null;
        }

        return {
            key: `cte:${this.getObjectId(commonTable)}`,
            targetKind: "cte",
            targetName: commonTable.getSourceAliasName(),
            targetAlias: source.aliasExpression ? source.getAliasName() : commonTable.getSourceAliasName(),
            query: commonTable.query
        };
    }

    private createDerivedTableTarget(source: SourceExpression): TargetDescriptor | null {
        if (!(source.datasource instanceof SubQuerySource)) {
            return null;
        }

        return {
            key: `derived:${this.getObjectId(source.datasource.query)}`,
            targetKind: "derivedTable",
            targetName: null,
            targetAlias: source.getAliasName(),
            query: source.datasource.query
        };
    }

    private collectNestedSources(fromClause: FromClause | null, commonTables: CommonTable[]): void {
        if (!fromClause) {
            return;
        }

        for (const source of fromClause.getSources()) {
            if (source.datasource instanceof SubQuerySource) {
                this.collectFromSelectQuery(source.datasource.query, commonTables);
            }
        }
    }

    private addRequirement(target: TargetDescriptor, column: string, requiredBy: WildcardColumnInferenceRequiredBy): void {
        let requirement = this.requirements.get(target.key);
        if (!requirement) {
            requirement = {
                descriptor: target,
                requiredByColumn: new Map()
            };
            this.requirements.set(target.key, requirement);
        }

        const existing = requirement.requiredByColumn.get(column) ?? [];
        existing.push(requiredBy);
        requirement.requiredByColumn.set(column, existing);
    }

    private inferTarget(requirement: TargetRequirement): WildcardColumnInferenceResult {
        const descriptor = requirement.descriptor;
        const baseResult: WildcardColumnInferenceResult = {
            targetKind: descriptor.targetKind,
            targetName: descriptor.targetName,
            targetAlias: descriptor.targetAlias,
            wildcards: [],
            explicitColumns: [],
            requiredColumns: [],
            unresolvedColumns: []
        };

        if (!(descriptor.query instanceof SimpleSelectQuery)) {
            for (const [outputName, requiredBy] of requirement.requiredByColumn) {
                baseResult.unresolvedColumns.push(this.createUnresolved(outputName, "unsupportedQueryShape", [], requiredBy));
            }
            return baseResult;
        }

        const outputMetadata = this.collectTargetOutputMetadata(descriptor.query);
        baseResult.wildcards = outputMetadata.wildcards;
        baseResult.explicitColumns = outputMetadata.explicitColumns;

        for (const [outputName, requiredBy] of requirement.requiredByColumn) {
            const explicitMatches = outputMetadata.explicitColumns.filter(item => item.outputName === outputName);
            const candidateWildcards = outputMetadata.wildcards;

            if (explicitMatches.length > 0 && candidateWildcards.length > 0) {
                baseResult.unresolvedColumns.push(this.createUnresolved(outputName, "duplicateOutputOwnership", candidateWildcards, requiredBy));
                continue;
            }

            if (explicitMatches.length > 0) {
                continue;
            }

            if (outputMetadata.unqualifiedWildcardWithMultipleSources) {
                baseResult.unresolvedColumns.push(this.createUnresolved(outputName, "unqualifiedWildcardMultipleSources", candidateWildcards, requiredBy));
                continue;
            }

            if (candidateWildcards.length === 0) {
                baseResult.unresolvedColumns.push(this.createUnresolved(outputName, "noWildcardSupplier", [], requiredBy));
                continue;
            }

            if (candidateWildcards.length > 1) {
                baseResult.unresolvedColumns.push(this.createUnresolved(outputName, "multipleWildcardSuppliers", candidateWildcards, requiredBy));
                continue;
            }

            const wildcard = candidateWildcards[0];
            baseResult.requiredColumns.push({
                outputName,
                sourceAlias: wildcard.sourceAlias,
                sourceName: wildcard.sourceName,
                sourceColumnName: outputName,
                wildcard,
                requiredByClause: this.collectRequiredByClauses(requiredBy),
                requiredBy
            });
        }

        return baseResult;
    }

    private collectTargetOutputMetadata(query: SimpleSelectQuery): TargetOutputMetadata {
        const wildcards: WildcardColumnInferenceWildcard[] = [];
        let unqualifiedWildcardWithMultipleSources = false;

        query.selectClause.items.forEach((item, outputIndex) => {
            const wildcard = this.collectWildcardMetadata(item, outputIndex, query.fromClause);
            if (wildcard === "unqualifiedWildcardMultipleSources") {
                unqualifiedWildcardWithMultipleSources = true;
                wildcards.push({
                    kind: "unqualified",
                    outputIndex,
                    sourceAlias: null,
                    sourceName: null
                });
                return;
            }
            if (wildcard) {
                wildcards.push(wildcard);
            }
        });

        const explicitColumns = new SelectOutputCollector()
            .collect(query)
            .filter(item => !(item.value instanceof ColumnReference && item.value.column.name === "*"))
            .map(item => ({
                outputName: item.name,
                sourceAlias: item.sourceAlias,
                sourceName: item.sourceName,
                sourceColumnName: item.sourceColumnName
            }));

        return {
            wildcards,
            explicitColumns,
            unqualifiedWildcardWithMultipleSources
        };
    }

    private collectWildcardMetadata(
        item: SelectItem,
        outputIndex: number,
        fromClause: FromClause | null
    ): WildcardColumnInferenceWildcard | "unqualifiedWildcardMultipleSources" | null {
        if (!(item.value instanceof ColumnReference) || item.value.column.name !== "*") {
            return null;
        }

        if (!fromClause) {
            return null;
        }

        if (item.value.namespaces === null) {
            const sources = fromClause.getSources();
            if (sources.length !== 1) {
                return "unqualifiedWildcardMultipleSources";
            }
            return {
                kind: "unqualified",
                outputIndex,
                sourceAlias: sources[0].getAliasName(),
                sourceName: this.getSourceName(sources[0])
            };
        }

        const namespace = item.value.getNamespace();
        const source = this.getUniqueSource(fromClause.getSources().filter(candidate => this.getSourceMatchNames(candidate).includes(namespace)));
        return {
            kind: "qualified",
            outputIndex,
            sourceAlias: namespace,
            sourceName: source ? this.getSourceName(source) : null
        };
    }

    private createUnresolved(
        outputName: string,
        reason: WildcardColumnInferenceUnresolvedReason,
        candidateWildcards: WildcardColumnInferenceWildcard[],
        requiredBy: WildcardColumnInferenceRequiredBy[]
    ): WildcardColumnInferenceUnresolvedColumn {
        return {
            outputName,
            reason,
            candidateWildcards,
            requiredByClause: this.collectRequiredByClauses(requiredBy),
            requiredBy
        };
    }

    private flattenReferences(references: ReturnType<ClauseScopedColumnReferenceCollector["collect"]>): ClauseScopedColumnReferenceInfo[] {
        return clauseOrder.flatMap(clause => references[clause]);
    }

    private createRequiredBy(reference: ClauseScopedColumnReferenceInfo): WildcardColumnInferenceRequiredBy {
        return {
            clause: reference.clause,
            qualifiedName: reference.qualifiedName,
            namespace: reference.namespace,
            column: reference.column
        };
    }

    private collectRequiredByClauses(requiredBy: WildcardColumnInferenceRequiredBy[]): ClauseScopedColumnReferenceClause[] {
        const clauses = new Set(requiredBy.map(item => item.clause));
        return clauseOrder.filter(clause => clauses.has(clause));
    }

    private getTargetMatchNames(target: TargetDescriptor): string[] {
        if (target.targetAlias) {
            return [target.targetAlias];
        }
        return target.targetName ? [target.targetName] : [];
    }

    private getUniqueTarget(targets: TargetDescriptor[]): TargetDescriptor | null {
        return targets.length === 1 ? targets[0] : null;
    }

    private getUniqueSource(sources: SourceExpression[]): SourceExpression | null {
        return sources.length === 1 ? sources[0] : null;
    }

    private getSourceMatchNames(source: SourceExpression): string[] {
        const names = new Set<string>();
        const aliasName = source.getAliasName();
        if (aliasName) {
            names.add(aliasName);
        }
        if (source.datasource instanceof TableSource) {
            names.add(source.datasource.table.name);
            names.add(source.datasource.getSourceName());
        }
        return [...names];
    }

    private getSourceName(source: SourceExpression): string | null {
        if (source.datasource instanceof TableSource) {
            return source.datasource.getSourceName();
        }
        return null;
    }

    private collectLeadingCommonTables(query: SelectQuery): CommonTable[] {
        if (query instanceof SimpleSelectQuery) {
            return query.withClause?.tables ?? [];
        }

        if (query instanceof BinarySelectQuery) {
            return this.collectLeadingCommonTables(query.left);
        }

        return [];
    }

    private mergeCommonTables(left: CommonTable[], right: CommonTable[]): CommonTable[] {
        const merged = [...left];
        for (const table of right) {
            const existingIndex = merged.findIndex(item => item.getSourceAliasName() === table.getSourceAliasName());
            if (existingIndex === -1) {
                merged.push(table);
            } else {
                merged[existingIndex] = table;
            }
        }
        return merged;
    }

    private getObjectId(value: object): number {
        const existing = this.objectIds.get(value);
        if (existing !== undefined) {
            return existing;
        }

        const id = this.nextObjectId++;
        this.objectIds.set(value, id);
        return id;
    }

    private isSelectQuery(query: unknown): query is SelectQuery {
        return !!query && typeof query === "object" && "__selectQueryType" in query && (query as SelectQuery).__selectQueryType === "SelectQuery";
    }
}
