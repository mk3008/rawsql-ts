import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { ValueComponent, LiteralValue, FunctionCall, ColumnReference, IdentifierString, RawString, ValueList, CastExpression, TypeValue, ParenExpression, BinaryExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair } from '../models/ValueComponent';
import { SelectClause, SelectItem, FromClause, WhereClause, LimitClause, SubQuerySource, SourceExpression, SourceAliasExpression, GroupByClause, CommonTable, WithClause, TableSource } from '../models/Clause';
import { SelectValueCollector } from './SelectValueCollector';
import { CTENormalizer } from './CTENormalizer';

/**
 * Universal JSON mapping definition for creating any level of JSON structures.
 * Supports flat arrays, nested objects, and unlimited hierarchical structures.
 */
export interface JsonMapping {
    /**
     * Root entity name for the result JSON array.
     * (e.g., "Products", "Categories")
     */
    rootName: string;

    /**
     * Root entity configuration (will be array items or single object).
     */
    rootEntity: {
        id: string;
        name: string;
        columns: { [jsonKey: string]: string };
    };

    /**
     * Nested entity configurations for hierarchical structures.
     */
    nestedEntities: Array<{
        id: string;
        name: string;
        parentId: string;
        propertyName: string;
        relationshipType?: "object" | "array";
        columns: { [jsonKey: string]: string };
    }>;

    useJsonb?: boolean;

    /**
     * Result format configuration.
     * @default "array"
     */
    resultFormat?: "array" | "single";

    /**
     * Default value to return when no rows are found and resultFormat is "single".
     * @default "null"
     */
    emptyResult?: string;
}

/**
 * Represents a processing stage in the bottom-up CTE construction.
 */
interface ProcessingStage {
    /** Depth from leaf (0 = leaf, higher = closer to root) */
    depth: number;
    /** Entities at this depth level */
    entities: any[];
    /** Whether this is a leaf stage (deepest children) */
    isLeaf: boolean;
    /** Whether this is the root stage */
    isRoot: boolean;
}

/**
 * SimpleSelectQuery を、PostgreSQLのJSON関数を使って
 * フラットなJSON配列または単一JSONオブジェクトを返すクエリに変換するクラスだよ。
 */
export class PostgreJsonQueryBuilder {
    private selectValueCollector: SelectValueCollector;

    constructor() {
        this.selectValueCollector = new SelectValueCollector(null);
    }

    /**
     * Build JSON query from original query and mapping configuration.
     * Always uses subquery for consistent structure regardless of result format.
     * @param originalQuery Original query to transform
     * @param mapping JSON mapping configuration
     * @returns Transformed query with JSON aggregation
     */
    public buildJson(originalQuery: SimpleSelectQuery, mapping: JsonMapping): SimpleSelectQuery {
        // Validate entity relationships
        this.validateEntityRelationships(mapping);

        // Build entity lookup map
        const entityMap = this.buildEntityMap(mapping);

        // Determine hierarchy type and delegate to appropriate builder
        const hierarchyType = this.analyzeHierarchyType(mapping, entityMap);

        switch (hierarchyType) {
            case 'simple':
                return this.buildSimpleHierarchy(originalQuery, mapping, entityMap);
            case 'grouped':
                return this.buildGroupedHierarchy(originalQuery, mapping, entityMap);
            case 'complex':
                return this.buildComplexHierarchy(originalQuery, mapping, entityMap);
            default:
                throw new Error(`Unknown hierarchy type: ${hierarchyType}`);
        }
    }

    /**
     * Validate entity relationships for consistency.
     * @param mapping JSON mapping configuration
     */
    private validateEntityRelationships(mapping: JsonMapping): void {
        const entityIds = new Set([mapping.rootEntity.id, ...mapping.nestedEntities.map(e => e.id)]);

        for (const entity of mapping.nestedEntities) {
            if (!entityIds.has(entity.parentId)) {
                throw new Error(`Parent entity '${entity.parentId}' not found for entity '${entity.id}'`);
            }
        }
    }

    /**
     * Build entity lookup map for quick access.
     * @param mapping JSON mapping configuration
     * @returns Map of entity ID to entity configuration
     */
    private buildEntityMap(mapping: JsonMapping): Map<string, any> {
        const entityMap = new Map();
        entityMap.set(mapping.rootEntity.id, mapping.rootEntity);

        for (const entity of mapping.nestedEntities) {
            entityMap.set(entity.id, entity);
        }

        return entityMap;
    }

    /**
     * Analyze hierarchy type based on relationships.
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @returns Hierarchy type classification
     */
    private analyzeHierarchyType(mapping: JsonMapping, entityMap: Map<string, any>): 'simple' | 'grouped' | 'complex' {
        if (mapping.nestedEntities.length === 0) {
            return 'simple'; // Flat structure
        }

        const arrayEntities = mapping.nestedEntities.filter(entity =>
            (entity.relationshipType || "object") === "array"
        );

        if (arrayEntities.length === 0) {
            return 'simple'; // Only object relationships
        }

        if (arrayEntities.length === 1) {
            return 'grouped'; // Single level of array aggregation
        }

        return 'complex'; // Multiple levels of arrays requiring bottom-up processing
    }

    /**
     * Build simple hierarchy with object relationships only.
     * Always uses subquery for consistent structure.
     * @param originalQuery Original query
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @returns Query with nested JSON objects
     */
    private buildSimpleHierarchy(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        entityMap: Map<string, any>
    ): SimpleSelectQuery {
        const jsonPrefix = mapping.useJsonb ? "jsonb" : "json";
        const sourceAliasName = "_sub";

        // Always wrap original query in subquery for consistency
        const subQuerySource = originalQuery.toSource(sourceAliasName);

        // Build hierarchical JSON structure
        const rootObject = this.buildEntityObject(
            mapping.rootEntity.id,
            mapping,
            jsonPrefix,
            entityMap,
            sourceAliasName
        );

        // Create final aggregation based on result format
        let finalAggFunc: ValueComponent;

        if (mapping.resultFormat === "single") {
            // Single object: use jsonb_build_object + LIMIT 1 (no coalesce needed)
            finalAggFunc = rootObject;
        } else {
            // Array format: use jsonb_agg (no coalesce needed - returns empty array when no data)
            finalAggFunc = new FunctionCall(
                null,
                new RawString(`${jsonPrefix}_agg`),
                new ValueList([rootObject]),
                null
            );
        }

        const selectItem = new SelectItem(finalAggFunc, mapping.rootName);
        const selectClause = new SelectClause([selectItem]);

        // Create final query with subquery
        const finalQuery = new SimpleSelectQuery({
            selectClause: selectClause,
            fromClause: new FromClause(subQuerySource, null)
        });

        // Add LIMIT 1 for single object format
        if (mapping.resultFormat === "single") {
            finalQuery.limitClause = new LimitClause(new LiteralValue(1));
        }

        return finalQuery;
    }

    /**
     * Build grouped hierarchy with array relationships using CTE.
     * @param originalQuery Original query
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @returns Query with CTE-based array aggregation
     */
    private buildGroupedHierarchy(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        entityMap: Map<string, any>
    ): SimpleSelectQuery {
        const jsonPrefix = mapping.useJsonb ? "jsonb" : "json";

        // Find entities that need aggregation (array relationships)
        const arrayEntities = mapping.nestedEntities.filter(entity =>
            (entity.relationshipType || "object") === "array"
        );

        if (arrayEntities.length === 0) {
            throw new Error("No array relationships found for grouped hierarchy");
        }

        // Build GROUP BY columns and SELECT items for CTE
        const { groupByColumns, selectItems } = this.buildAggregationItems(
            mapping, entityMap, arrayEntities, jsonPrefix
        );

        // Create grouped CTE
        const groupedQuery = new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: originalQuery.fromClause,
            whereClause: originalQuery.whereClause,
            groupByClause: new GroupByClause(groupByColumns),
            havingClause: originalQuery.havingClause,
            orderByClause: originalQuery.orderByClause,
            windowClause: originalQuery.windowClause,
        });

        // Create CTE
        const cteName = this.generateCteName(mapping.rootEntity.id, arrayEntities);
        const cte = new CommonTable(groupedQuery, cteName, null);

        // Build final aggregation
        const finalAggFunc = this.buildFinalAggregation(mapping, entityMap, jsonPrefix);

        // Create final query that references the CTE
        const cteSource = new TableSource([], cteName);
        const fromClause = new FromClause(new SourceExpression(cteSource, null), null);

        const selectItem = new SelectItem(finalAggFunc, mapping.rootName);
        const selectClause = new SelectClause([selectItem]);

        return new SimpleSelectQuery({
            selectClause: selectClause,
            fromClause: fromClause,
            withClause: new WithClause(false, [cte])
        });
    }

    /**
     * Build complex hierarchy with multiple levels of arrays using bottom-up CTE construction.
     * @param originalQuery Original query
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @returns Query with multi-stage CTE hierarchy
     */
    private buildComplexHierarchy(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        entityMap: Map<string, any>
    ): SimpleSelectQuery {
        const jsonPrefix = mapping.useJsonb ? "jsonb" : "json";

        // Step 1: Build dependency tree and find processing order (bottom-up)
        const processOrder = this.calculateBottomUpProcessOrder(mapping, entityMap);

        // Step 2: Build CTEs from deepest children to root
        const ctes: CommonTable[] = [];
        let currentQuery = originalQuery;

        for (const stage of processOrder) {
            // Only create CTE if this stage has array relationships
            const arrayEntitiesInStage = stage.entities.filter((entity: any) =>
                (entity.relationshipType || "object") === "array"
            );

            if (arrayEntitiesInStage.length === 0) {
                continue; // No aggregation needed at this stage
            }

            // Build CTE for this stage
            const cteName = this.generateStageCteName(stage);
            const cteQuery = this.buildStageCTE(currentQuery, mapping, jsonPrefix, entityMap, stage);

            ctes.push(new CommonTable(cteQuery, cteName, null));

            // Update current query to use this CTE as source
            const cteSource = new TableSource([], cteName);
            const sourceExpr = new SourceExpression(cteSource, null);
            currentQuery = new SimpleSelectQuery({
                selectClause: new SelectClause([new SelectItem(new RawString("*"), null)]),
                fromClause: new FromClause(sourceExpr, null)
            });
        }

        // Step 3: Build final root aggregation
        const finalCte = this.buildFinalRootAggregation(currentQuery, mapping, jsonPrefix, entityMap);
        if (finalCte) {
            ctes.push(finalCte);

            const finalCteName = finalCte.getSourceAliasName();
            return new SimpleSelectQuery({
                selectClause: new SelectClause([new SelectItem(new ColumnReference([], "result"), mapping.rootName)]),
                fromClause: new FromClause(new SourceExpression(new TableSource([], finalCteName), null), null),
                withClause: new WithClause(false, ctes)
            });
        }

        return new SimpleSelectQuery({
            selectClause: currentQuery.selectClause,
            fromClause: currentQuery.fromClause,
            withClause: ctes.length > 0 ? new WithClause(false, ctes) : null
        });
    }

    /**
     * Build GROUP BY columns and SELECT items for array aggregation.
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @param arrayEntities Entities with array relationships
     * @param jsonPrefix JSON function prefix
     * @returns Object containing groupByColumns and selectItems
     */
    private buildAggregationItems(
        mapping: JsonMapping,
        entityMap: Map<string, any>,
        arrayEntities: any[],
        jsonPrefix: string
    ): { groupByColumns: ValueComponent[], selectItems: SelectItem[] } {
        const groupByColumns: ValueComponent[] = [];
        const selectItems: SelectItem[] = [];

        // Add root entity columns to GROUP BY and SELECT
        for (const [jsonKey, sqlColumn] of Object.entries(mapping.rootEntity.columns)) {
            const colRef = new ColumnReference([], sqlColumn as string);
            groupByColumns.push(colRef);
            selectItems.push(new SelectItem(colRef, sqlColumn as string));
        }

        // Add array aggregations
        for (const arrayEntity of arrayEntities) {
            const objectArgs: ValueComponent[] = [];
            for (const [jsonKey, sqlColumn] of Object.entries(arrayEntity.columns)) {
                objectArgs.push(new LiteralValue(jsonKey));
                objectArgs.push(new ColumnReference([], sqlColumn as string));
            }

            const buildObjectFunc = new FunctionCall(
                null,
                new RawString(`${jsonPrefix}_build_object`),
                new ValueList(objectArgs),
                null
            );

            const aggFunc = new FunctionCall(
                null,
                new RawString(`${jsonPrefix}_agg`),
                new ValueList([buildObjectFunc]),
                null
            );

            selectItems.push(new SelectItem(aggFunc, arrayEntity.propertyName));
        }

        return { groupByColumns, selectItems };
    }

    /**
     * Generate CTE name for grouped hierarchy.
     * @param rootEntityId Root entity ID
     * @param arrayEntities Array entities
     * @returns Generated CTE name
     */
    private generateCteName(rootEntityId: string, arrayEntities: any[]): string {
        const arrayEntityNames = arrayEntities.map((e: any) => e.id).join("_");
        return `${rootEntityId}_with_${arrayEntityNames}`;
    }

    /**
     * Build final aggregation for grouped hierarchy.
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @param jsonPrefix JSON function prefix
     * @returns Final aggregation function
     */
    private buildFinalAggregation(
        mapping: JsonMapping,
        entityMap: Map<string, any>,
        jsonPrefix: string
    ): ValueComponent {
        const objectArgs: ValueComponent[] = [];

        // Add root entity columns
        for (const [jsonKey, sqlColumn] of Object.entries(mapping.rootEntity.columns)) {
            objectArgs.push(new LiteralValue(jsonKey));
            objectArgs.push(new ColumnReference([], sqlColumn as string));
        }

        // Add nested array properties
        const arrayEntities = mapping.nestedEntities.filter(entity =>
            (entity.relationshipType || "object") === "array"
        );

        for (const arrayEntity of arrayEntities) {
            objectArgs.push(new LiteralValue(arrayEntity.propertyName));
            objectArgs.push(new ColumnReference([], arrayEntity.propertyName));
        }

        const buildObjectFunc = new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_build_object`),
            new ValueList(objectArgs),
            null
        );

        return new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_agg`),
            new ValueList([buildObjectFunc]),
            null
        );
    }

    /**
     * Calculate bottom-up processing order for complex hierarchies.
     * @param mapping JSON mapping configuration
     * @param entityMap Map of all entities
     * @returns Array of processing stages in bottom-up order
     */
    private calculateBottomUpProcessOrder(mapping: JsonMapping, entityMap: Map<string, any>): ProcessingStage[] {
        // This is a simplified implementation - in practice you'd build a dependency tree
        const stages: ProcessingStage[] = [];

        // Find leaf entities (those with no children)
        const parentIds = new Set(mapping.nestedEntities.map(e => e.parentId));
        const leafEntities = mapping.nestedEntities.filter(e => !parentIds.has(e.id));

        if (leafEntities.length > 0) {
            stages.push({
                depth: 0,
                entities: leafEntities,
                isLeaf: true,
                isRoot: false
            });
        }

        // Add intermediate and root stages (simplified)
        const intermediateEntities = mapping.nestedEntities.filter(e =>
            parentIds.has(e.id) && e.parentId !== mapping.rootEntity.id
        );

        if (intermediateEntities.length > 0) {
            stages.push({
                depth: 1,
                entities: intermediateEntities,
                isLeaf: false,
                isRoot: false
            });
        }

        return stages;
    }

    /**
     * Generate stage CTE name for complex hierarchy.
     * @param stage Processing stage
     * @returns Generated stage CTE name
     */
    private generateStageCteName(stage: ProcessingStage): string {
        const entityNames = stage.entities.map((e: any) => e.id).join("_");
        return `stage_${stage.depth}_${entityNames}`;
    }

    /**
     * Build CTE for a specific processing stage.
     * @param currentQuery Current query to build from
     * @param mapping JSON mapping configuration
     * @param jsonPrefix JSON function prefix
     * @param entityMap Map of all entities
     * @param stage Processing stage
     * @returns CTE query for the stage
     */
    private buildStageCTE(
        currentQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        jsonPrefix: string,
        entityMap: Map<string, any>,
        stage: ProcessingStage
    ): SimpleSelectQuery {
        // This is a simplified implementation
        // In practice, you'd build proper GROUP BY and aggregation based on the stage
        const arrayEntities = stage.entities.filter((entity: any) =>
            (entity.relationshipType || "object") === "array"
        );

        const { groupByColumns, selectItems } = this.buildAggregationItems(
            mapping, entityMap, arrayEntities, jsonPrefix
        );

        return new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: currentQuery.fromClause,
            whereClause: currentQuery.whereClause,
            groupByClause: new GroupByClause(groupByColumns)
        });
    }

    /**
     * Build final root aggregation for complex hierarchy.
     * @param currentQuery Current query
     * @param mapping JSON mapping configuration
     * @param jsonPrefix JSON function prefix
     * @param entityMap Map of all entities
     * @returns Final CTE or null if not needed
     */
    private buildFinalRootAggregation(
        currentQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        jsonPrefix: string,
        entityMap: Map<string, any>
    ): CommonTable | null {
        const finalAggFunc = this.buildFinalAggregation(mapping, entityMap, jsonPrefix);

        const finalQuery = new SimpleSelectQuery({
            selectClause: new SelectClause([new SelectItem(finalAggFunc, "result")]),
            fromClause: currentQuery.fromClause
        });

        return new CommonTable(finalQuery, "final_result", null);
    }

    /**
     * Recursively build JSON object for an entity and its children.
     * Handles null parent detection for LEFT JOIN scenarios.
     * @param entityId Entity identifier
     * @param mapping JSON mapping configuration
     * @param jsonPrefix JSON function prefix
     * @param entityMap Map of all entities
     * @param sourceAlias Source alias for column references
     * @returns ValueComponent representing the JSON object
     */
    private buildEntityObject(
        entityId: string,
        mapping: JsonMapping,
        jsonPrefix: string,
        entityMap: Map<string, any>,
        sourceAlias: string
    ): ValueComponent {
        const entity = entityMap.get(entityId);
        if (!entity) {
            throw new Error(`Entity '${entityId}' not found`);
        }

        const objectArgs: ValueComponent[] = [];

        // Add columns for current entity
        for (const [jsonKey, sqlColumn] of Object.entries(entity.columns)) {
            objectArgs.push(new LiteralValue(jsonKey));
            objectArgs.push(new ColumnReference([sourceAlias], sqlColumn as string));
        }

        // Find and add direct children (only object relationships in simple hierarchy)
        const children = mapping.nestedEntities.filter(ne => ne.parentId === entityId);
        for (const child of children) {
            const relationshipType = child.relationshipType || "object";
            if (relationshipType === "object") {
                objectArgs.push(new LiteralValue(child.propertyName));

                // Build child object with null parent detection
                const childObject = this.buildEntityObjectWithNullDetection(
                    child.id,
                    mapping,
                    jsonPrefix,
                    entityMap,
                    sourceAlias
                );
                objectArgs.push(childObject);
            }
            // Array relationships should not exist in simple hierarchy
            else if (relationshipType === "array") {
                throw new Error(`Array relationship '${child.propertyName}' found in simple hierarchy. Use grouped/complex hierarchy builder instead.`);
            }
        }

        return new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_build_object`),
            new ValueList(objectArgs),
            null
        );
    }

    /**
     * Build entity object with null parent detection for LEFT JOIN scenarios.
     * If all columns of an entity are NULL, returns NULL instead of an object with null properties.
     * @param entityId Entity identifier
     * @param mapping JSON mapping configuration
     * @param jsonPrefix JSON function prefix
     * @param entityMap Map of all entities
     * @param sourceAlias Source alias for column references
     * @returns ValueComponent that returns null for null parents or the object for valid parents
     */
    private buildEntityObjectWithNullDetection(
        entityId: string,
        mapping: JsonMapping,
        jsonPrefix: string,
        entityMap: Map<string, any>,
        sourceAlias: string
    ): ValueComponent {
        const entity = entityMap.get(entityId);
        if (!entity) {
            throw new Error(`Entity '${entityId}' not found`);
        }

        // Get all column references for this entity
        const columnRefs = Object.values(entity.columns).map(sqlColumn =>
            new ColumnReference([sourceAlias], sqlColumn as string)
        );

        // Build null detection condition: all columns are null
        let nullCondition: ValueComponent | null = null;
        for (const colRef of columnRefs) {
            const isNullExpr = new BinaryExpression(colRef, 'is', new RawString('null'));
            if (nullCondition) {
                nullCondition = new BinaryExpression(nullCondition, 'and', isNullExpr);
            } else {
                nullCondition = isNullExpr;
            }
        }

        // Build the normal object
        const normalObject = this.buildEntityObject(entityId, mapping, jsonPrefix, entityMap, sourceAlias);

        // Return CASE WHEN all_columns_null THEN NULL ELSE normal_object END
        if (nullCondition) {
            // Create switch case argument: WHEN condition THEN null ELSE normal_object
            const caseKeyValuePair = new CaseKeyValuePair(nullCondition, new RawString('null'));
            const switchCaseArg = new SwitchCaseArgument([caseKeyValuePair], normalObject);

            // Create CASE expression (no condition for simple CASE WHEN structure)
            return new CaseExpression(null, switchCaseArg);
        }

        return normalObject;
    }
}