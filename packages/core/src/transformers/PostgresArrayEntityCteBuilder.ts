import { CommonTable, SourceAliasExpression, SelectItem, SelectClause, FromClause, SourceExpression, TableSource, GroupByClause } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { IdentifierString, ValueComponent, ColumnReference, FunctionCall, ValueList, LiteralValue, RawString, CastExpression, TypeValue } from '../models/ValueComponent';
import { JsonMapping } from './PostgresJsonQueryBuilder';
import { ProcessableEntity, JsonColumnMapping } from './PostgresObjectEntityCteBuilder';
import { SelectValueCollector } from './SelectValueCollector';

/**
 * Information for array entity processing
 */
interface ArrayEntityProcessingInfo {
    entity: ProcessableEntity;
    parentEntity: ProcessableEntity;
    parentIdColumnSqlName: string;
    depth: number;
}

/**
 * Builds CTEs for array entities using depth-first processing and row compression.
 * 
 * Core concepts:
 * - Column Compression: OBJECT relationships (user_id, user_name → user_json)
 * - Row Compression: ARRAY relationships (multiple rows → JSON array via GROUP BY)
 * - Depth-First: Process deepest arrays first for dependency ordering
 * - GROUP BY Exclusion: Exclude array-internal columns to prevent over-grouping
 */
export class PostgresArrayEntityCteBuilder {
    // Constants for consistent naming conventions
    private static readonly CTE_ARRAY_PREFIX = 'cte_array_depth_';
    
    // JSON function names for PostgreSQL aggregation
    private static readonly JSON_FUNCTIONS = {
        BUILD_OBJECT: 'jsonb_build_object',
        AGGREGATE: 'jsonb_agg'
    } as const;

    /**
     * Builds CTEs for all array entities using depth-first processing.
     * Collects arrays by depth, processes deepest first, chains CTEs.
     * 
     * @param ctesSoFar Array of CTEs built so far
     * @param aliasOfCteToBuildUpon Alias of the CTE to build upon
     * @param allEntities Map of all entities in the mapping
     * @param mapping The JSON mapping configuration
     * @param columnMappings Optional mappings from object entity IDs to generated JSON column names
     * @returns Object containing updated CTEs and last CTE alias
     */
    public buildArrayEntityCtes(
        ctesSoFar: CommonTable[],
        aliasOfCteToBuildUpon: string,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping,
        columnMappings?: JsonColumnMapping[]
    ): { updatedCtes: CommonTable[], lastCteAlias: string } {
        let currentCtes = [...ctesSoFar];
        let currentCteAlias = aliasOfCteToBuildUpon;

        // Collect and sort array entities by depth
        const sortedArrayInfos = this.collectAndSortArrayEntities(mapping, allEntities);

        if (sortedArrayInfos.length === 0) {
            return { updatedCtes: currentCtes, lastCteAlias: currentCteAlias };
        }

        // Group array entities by depth level for batch processing
        const entitiesByDepth = this.groupEntitiesByDepth(sortedArrayInfos);

        // Process from deepest to shallowest (depth-first)
        const depths = Array.from(entitiesByDepth.keys()).sort((a, b) => b - a);

        for (const depth of depths) {
            const infos = entitiesByDepth.get(depth)!;

            // Build CTE for all entities at this depth
            const { cte, newCteAlias } = this.buildDepthCte(
                infos,
                currentCteAlias,
                currentCtes,
                depth,
                mapping,
                columnMappings
            );

            currentCtes.push(cte);
            currentCteAlias = newCteAlias;
        }

        return { updatedCtes: currentCtes, lastCteAlias: currentCteAlias };
    }

    /**
     * Collects array entities and calculates depth for dependency ordering.
     * Depth = distance from root. Deeper arrays processed first.
     * 
     * @param mapping The JSON mapping configuration
     * @param allEntities Map of all entities in the mapping
     * @returns Array of array entity information with depths, sorted deepest first
     */
    private collectAndSortArrayEntities(
        mapping: JsonMapping,
        allEntities: Map<string, ProcessableEntity>
    ): ArrayEntityProcessingInfo[] {
        const arrayEntityInfos: ArrayEntityProcessingInfo[] = [];

        // Helper function to calculate depth for an entity
        const getDepth = (entityId: string): number => {
            const entity = allEntities.get(entityId);
            if (!entity || entity.isRoot) return 0;
            if (!entity.parentId) return 1;
            return 1 + getDepth(entity.parentId);
        };

        // Collect all array-type nested entities
        mapping.nestedEntities.forEach(ne => {
            if (ne.relationshipType === "array") {
                const currentArrayEntity = allEntities.get(ne.id);
                const parentEntity = allEntities.get(ne.parentId!);

                if (!currentArrayEntity || !parentEntity) {
                    throw new Error(`Configuration error: Array entity '${ne.id}' or its parent '${ne.parentId}' not found.`);
                }

                // Determine the linking column from parent entity
                // This assumes the first column of the parent is a suitable key for linking.
                // More robust linking might require explicit configuration in the mapping.
                const parentSqlColumns = Object.values(parentEntity.columns);
                if (parentSqlColumns.length === 0) {
                    throw new Error(`Configuration error: Parent entity '${parentEntity.name}' (ID: ${parentEntity.id}) must have at least one column defined to serve as a linking key for child array '${ne.name}'.`);
                }
                const parentIdColumnSqlName = parentSqlColumns[0];

                arrayEntityInfos.push({
                    entity: currentArrayEntity,
                    parentEntity: parentEntity,
                    parentIdColumnSqlName: parentIdColumnSqlName,
                    depth: getDepth(ne.id)
                });
            }
        });

        // Sort by depth, deepest arrays (higher depth number) processed first (bottom-up for arrays)
        arrayEntityInfos.sort((a, b) => b.depth - a.depth);
        return arrayEntityInfos;
    }

    /**
     * Groups array entities by depth level for batch processing.
     * 
     * @param arrayInfos Array of array entity information with depths
     * @returns Map of depth level to entities at that depth
     */
    private groupEntitiesByDepth(
        arrayInfos: ArrayEntityProcessingInfo[]
    ): Map<number, ArrayEntityProcessingInfo[]> {
        const entitiesByDepth = new Map<number, ArrayEntityProcessingInfo[]>();

        arrayInfos.forEach(info => {
            const depth = info.depth;
            if (!entitiesByDepth.has(depth)) {
                entitiesByDepth.set(depth, []);
            }
            entitiesByDepth.get(depth)!.push(info);
        });

        return entitiesByDepth;
    }

    /**
     * Builds CTE for specific depth level using row compression.
     * Uses GROUP BY to aggregate multiple rows into JSON arrays.
     * Excludes array-internal columns from GROUP BY to prevent over-grouping.
     * 
     * @param infos Array entities at this depth level
     * @param currentCteAlias Alias of the CTE to build upon
     * @param currentCtes All CTEs built so far
     * @param depth Current depth level being processed
     * @param mapping JSON mapping configuration
     * @param columnMappings Optional mappings from object entity IDs to generated JSON column names
     * @returns The new CTE and its alias
     */
    private buildDepthCte(
        infos: ArrayEntityProcessingInfo[],
        currentCteAlias: string,
        currentCtes: CommonTable[],
        depth: number,
        mapping: JsonMapping,
        columnMappings?: JsonColumnMapping[]
    ): { cte: CommonTable, newCteAlias: string } {
        // Collect columns that will be compressed into arrays
        // This includes both direct columns and columns from nested entities within the array
        const arrayColumns = new Set<string>();
        infos.forEach(info => {
            // Add direct columns from the array entity
            Object.values(info.entity.columns).forEach(col => arrayColumns.add(col));

            // Also add columns from all nested entities within this array entity
            const collectNestedColumns = (parentEntityId: string) => {
                mapping.nestedEntities
                    .filter(nestedEntity => nestedEntity.parentId === parentEntityId)
                    .forEach(nestedEntity => {
                        Object.values(nestedEntity.columns).forEach(column => {
                            const columnName = typeof column === 'string' ? column : (column as any).column;
                            arrayColumns.add(columnName);
                        });
                        // Recursively collect from deeper nested entities
                        collectNestedColumns(nestedEntity.id);
                    });
            };

            collectNestedColumns(info.entity.id);
        });

        // Get columns from previous CTE
        const prevCte = currentCtes.find(c => c.aliasExpression.table.name === currentCteAlias)?.query;
        if (!prevCte) {
            throw new Error(`CTE not found: ${currentCteAlias}`);
        }
        const prevSelects = new SelectValueCollector(null, currentCtes).collect(prevCte);        // Build SELECT items: columns that are NOT being compressed (for GROUP BY)
        const groupByItems: ValueComponent[] = [];
        const selectItems: SelectItem[] = [];

        // Get columns from the current level's array entities that will be aggregated
        // These should be included in GROUP BY since they're being processed at this level
        const currentLevelArrayColumns = new Set<string>();
        infos.forEach(info => {
            Object.values(info.entity.columns).forEach(col => currentLevelArrayColumns.add(col));
        });

        // Collect array entity columns organized by depth for GROUP BY exclusion strategy
        const arrayEntityColumns = this.collectArrayEntityColumnsByDepth(mapping, depth);

        // Identify JSON columns from objects within the arrays being processed at this depth
        const arrayInternalObjectColumns = new Set<string>();
        if (columnMappings) {
            infos.forEach(info => {
                // Find all object-type nested entities within this array entity
                mapping.nestedEntities
                    .filter(ne => ne.parentId === info.entity.id && ne.relationshipType === "object")
                    .forEach(objectEntity => {
                        // Find the corresponding JSON column mapping for this object entity
                        const columnMapping = columnMappings.find(cm => cm.entityId === objectEntity.id);
                        if (columnMapping) {
                            arrayInternalObjectColumns.add(columnMapping.generatedColumnName);
                        }
                    });
            });
        }

        // Process existing SELECT variables to determine which should be included in GROUP BY
        this.processSelectVariablesForGroupBy(
            prevSelects,
            arrayColumns,
            arrayEntityColumns,
            depth,
            selectItems,
            groupByItems,
            arrayInternalObjectColumns
        );

        // Add JSON aggregation columns for each array entity at this depth
        for (const info of infos) {
            const agg = this.buildAggregationDetailsForArrayEntity(
                info.entity,
                mapping.nestedEntities,
                new Map(), // allEntities - not needed for array aggregation
                columnMappings
            );
            selectItems.push(new SelectItem(agg.jsonAgg, info.entity.propertyName));
        }

        // Create the new CTE
        const cteAlias = `${PostgresArrayEntityCteBuilder.CTE_ARRAY_PREFIX}${depth}`;
        const cteSelect = new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, new IdentifierString(currentCteAlias)),
                    null
                ),
                null
            ),
            groupByClause: groupByItems.length > 0 ? new GroupByClause(groupByItems) : null,
        });

        const cte = new CommonTable(cteSelect, new SourceAliasExpression(cteAlias, null), null);

        return { cte, newCteAlias: cteAlias };
    }

    /**
     * Creates jsonb_agg function for array entity.
     * Handles entity columns and nested child relationships.
     * Uses originalPropertyName to avoid sequential numbering.
     * 
     * @param entity The array entity being processed
     * @param nestedEntities All nested entities from the mapping
     * @param allEntities Map of all entities (not used in current implementation)
     * @param columnMappings Mappings from object entity IDs to generated JSON column names
     * @returns Object containing the JSON aggregation function
     */
    private buildAggregationDetailsForArrayEntity(
        entity: ProcessableEntity,
        nestedEntities: any[],
        allEntities: Map<string, ProcessableEntity>,
        columnMappings?: JsonColumnMapping[]
    ): { jsonAgg: ValueComponent } {
        // Build JSON object for array elements using JSONB functions
        const jsonBuildFunction = PostgresArrayEntityCteBuilder.JSON_FUNCTIONS.BUILD_OBJECT;
        const args: ValueComponent[] = [];

        // Add the entity's own columns
        Object.entries(entity.columns).forEach(([jsonKey, sqlColumn]) => {
            args.push(new LiteralValue(jsonKey, undefined, true));
            args.push(new ColumnReference(null, new IdentifierString(sqlColumn)));
        });

        // Find and process child entities (both object and array types)
        const childEntities = nestedEntities.filter((ne) => ne.parentId === entity.id); childEntities.forEach((childEntity) => {
            // Use originalPropertyName if available to avoid sequential numbering in final JSON
            const propertyNameForJson = (childEntity as any).originalPropertyName || childEntity.propertyName;
            args.push(new LiteralValue(propertyNameForJson, undefined, true));

            if (childEntity.relationshipType === "object") {
                // For object relationships, use pre-computed JSON column from column mappings
                if (!columnMappings) {
                    throw new Error(
                        `❌ PostgresArrayEntityCteBuilder Error: Column mappings not provided\n` +
                        `\n` +
                        `🔍 Details:\n` +
                        `  - Entity ID: ${childEntity.id}\n` +
                        `  - Entity Name: ${childEntity.name || 'unknown'}\n` +
                        `  - Property Name: ${childEntity.propertyName}\n` +
                        `  - Relationship Type: ${childEntity.relationshipType}\n` +
                        `\n` +
                        `💡 Solution:\n` +
                        `  Column mappings are required for hybrid JSON column naming.\n` +
                        `  This error indicates that PostgresObjectEntityCteBuilder did not\n` +
                        `  pass column mappings to PostgresArrayEntityCteBuilder.\n` +
                        `\n` +
                        `🔧 Check:\n` +
                        `  1. Ensure PostgresJsonQueryBuilder.buildJsonWithCteStrategy() passes columnMappings\n` +
                        `  2. Verify PostgresObjectEntityCteBuilder.buildObjectEntityCtes() returns columnMappings\n` +
                        `  3. Check that Model-driven mapping conversion generates unique entity IDs`
                    );
                }

                const mapping = columnMappings.find(m => m.entityId === childEntity.id);
                if (!mapping) {
                    const availableMappings = columnMappings.map(m => `${m.entityId} → ${m.generatedColumnName}`).join(', ');
                    throw new Error(
                        `❌ PostgresArrayEntityCteBuilder Error: Column mapping not found\n` +
                        `\n` +
                        `🔍 Details:\n` +
                        `  - Looking for Entity ID: ${childEntity.id}\n` +
                        `  - Entity Name: ${childEntity.name || 'unknown'}\n` +
                        `  - Property Name: ${childEntity.propertyName}\n` +
                        `  - Relationship Type: ${childEntity.relationshipType}\n` +
                        `\n` +
                        `📋 Available Mappings:\n` +
                        `  ${availableMappings || 'None'}\n` +
                        `\n` +
                        `💡 Solution:\n` +
                        `  Entity IDs must match between mapping generation and usage.\n` +
                        `  This suggests a mismatch in entity ID generation or processing.\n` +
                        `\n` +
                        `🔧 Check:\n` +
                        `  1. Model-driven mapping conversion generates consistent entity IDs\n` +
                        `  2. PostgresObjectEntityCteBuilder processes all entities correctly\n` +
                        `  3. Entity hierarchy and parentId relationships are correct`
                    );
                }
                args.push(new ColumnReference(null, new IdentifierString(mapping.generatedColumnName)));
            } else if (childEntity.relationshipType === "array") {
                // For array relationships, use the column directly
                args.push(new ColumnReference(null, new IdentifierString(childEntity.propertyName)));
            }
        });

        // Create JSON object
        const jsonObject = new FunctionCall(null, new RawString(jsonBuildFunction), new ValueList(args), null);

        // Create JSON aggregation using JSONB with NULL filtering
        // Use FILTER clause to exclude rows where primary key is NULL (no actual data)
        const jsonAggFunction = PostgresArrayEntityCteBuilder.JSON_FUNCTIONS.AGGREGATE;

        // Find the primary column (typically the first column) to use for NULL filtering
        const primaryColumn = Object.values(entity.columns)[0];

        // For now, create standard jsonb_agg and handle NULL filtering in post-processing
        // TODO: Implement proper FILTER clause support in SQL AST
        const jsonAgg = new FunctionCall(
            null,
            new RawString(jsonAggFunction),
            new ValueList([jsonObject]),
            null
        );

        return { jsonAgg };
    }

    /**
     * Collects array entity columns by depth for GROUP BY exclusion strategy.
     * 
     * @param mapping The JSON mapping configuration containing all entities
     * @param currentDepth The current aggregation depth being processed
     * @returns A map where keys are depth levels and values are sets of column names
     */
    private collectArrayEntityColumnsByDepth(
        mapping: JsonMapping,
        currentDepth: number
    ): Map<number, Set<string>> {
        const arrayEntitiesByDepth = new Map<number, Set<string>>();        // Initialize depth maps for current and deeper levels
        // Use a reasonable maximum depth limit to avoid infinite loops
        const maxDepth = Math.max(currentDepth + 3, 5);
        for (let d = currentDepth; d <= maxDepth; d++) {
            arrayEntitiesByDepth.set(d, new Set());
        }

        // Process all array entities to collect their columns by depth
        mapping.nestedEntities
            .filter(entity => entity.relationshipType === 'array')
            .forEach(entity => {
                // Calculate entity depth in the hierarchy
                const entityDepth = this.calculateEntityDepth(entity, mapping);

                if (!arrayEntitiesByDepth.has(entityDepth)) {
                    arrayEntitiesByDepth.set(entityDepth, new Set());
                }

                // Add direct columns from the array entity
                this.addEntityColumnsToDepthSet(entity, entityDepth, arrayEntitiesByDepth);

                // Collect columns from all descendant entities recursively
                this.collectDescendantColumns(entity.id, entityDepth, mapping, arrayEntitiesByDepth);
            });

        return arrayEntitiesByDepth;
    }

    /**
     * Calculates entity depth by traversing up to root.
     * 
     * @param entity The entity to calculate depth for
     * @param mapping The JSON mapping containing all entities
     * @returns The depth level (0 for root level, 1 for first level, etc.)
     */
    private calculateEntityDepth(entity: any, mapping: JsonMapping): number {
        let entityDepth = 0;
        let currentEntity = entity;

        while (currentEntity.parentId && currentEntity.parentId !== mapping.rootEntity.id) {
            entityDepth++;
            currentEntity = mapping.nestedEntities.find(e => e.id === currentEntity.parentId) || currentEntity;
        }

        return entityDepth;
    }

    /**
     * Adds entity columns to depth set.
     * 
     * @param entity The entity whose columns should be added
     * @param depth The depth level to add columns to
     * @param arrayEntitiesByDepth The map to update
     */
    private addEntityColumnsToDepthSet(
        entity: any,
        depth: number,
        arrayEntitiesByDepth: Map<number, Set<string>>
    ): void {
        Object.values(entity.columns).forEach(column => {
            const columnName = typeof column === 'string' ? column : (column as any).column;
            arrayEntitiesByDepth.get(depth)!.add(columnName);
        });
    }

    /**
     * Recursively collects columns from descendant entities.
     * 
     * @param parentEntityId The ID of the parent entity
     * @param targetDepth The depth level to assign collected columns to
     * @param mapping The JSON mapping containing all entities
     * @param arrayEntitiesByDepth The map to update with collected columns
     */
    private collectDescendantColumns(
        parentEntityId: string,
        targetDepth: number,
        mapping: JsonMapping,
        arrayEntitiesByDepth: Map<number, Set<string>>
    ): void {
        mapping.nestedEntities
            .filter(nestedEntity => nestedEntity.parentId === parentEntityId)
            .forEach(nestedEntity => {
                // Add all columns from this descendant to the target depth
                this.addEntityColumnsToDepthSet(nestedEntity, targetDepth, arrayEntitiesByDepth);

                // Recursively collect from deeper nested entities
                this.collectDescendantColumns(nestedEntity.id, targetDepth, mapping, arrayEntitiesByDepth);
            });
    }

    /**
     * Implements GROUP BY exclusion strategy for array aggregation.
     * Excludes current array columns and array-internal object JSON columns.
     * 
     * @param prevSelects SELECT variables from the previous CTE
     * @param arrayColumns Columns that are being aggregated (should be excluded from GROUP BY)
     * @param arrayEntitiesByDepth Map of depth levels to their column sets
     * @param currentDepth The current aggregation depth being processed
     * @param selectItems Output array for SELECT items
     * @param groupByItems Output array for GROUP BY items
     * @param arrayInternalObjectColumns JSON columns from objects within arrays being processed
     */
    private processSelectVariablesForGroupBy(
        prevSelects: any[],
        arrayColumns: Set<string>,
        arrayEntitiesByDepth: Map<number, Set<string>>,
        currentDepth: number,
        selectItems: SelectItem[],
        groupByItems: ValueComponent[],
        arrayInternalObjectColumns?: Set<string>
    ): void {
        prevSelects.forEach(sv => {
            if (!arrayColumns.has(sv.name)) {
                // Exclude JSON columns from objects within arrays being processed
                if (arrayInternalObjectColumns && arrayInternalObjectColumns.has(sv.name)) {
                    // Skip this column - it's an object within the array being aggregated
                    return;
                }

                const shouldInclude = this.shouldIncludeColumnInGroupBy(
                    sv.name,
                    arrayEntitiesByDepth,
                    currentDepth
                );

                if (shouldInclude) {
                    selectItems.push(new SelectItem(
                        new ColumnReference(null, new IdentifierString(sv.name)),
                        sv.name
                    ));
                    // Exclude JSON columns from GROUP BY as PostgreSQL doesn't support equality operators for JSON type
                    if (!sv.name.endsWith('_json')) {
                        groupByItems.push(new ColumnReference(null, new IdentifierString(sv.name)));
                    }
                }
            }
        });
    }

    /**
     * Determines if column should be included in GROUP BY clause.
     * Applies depth-based filtering and special handling for JSON columns.
     * 
     * @param columnName The name of the column to evaluate
     * @param arrayEntitiesByDepth Map of depth levels to their column sets
     * @param currentDepth The current aggregation depth
     * @returns True if the column should be included in GROUP BY, false otherwise
     */
    private shouldIncludeColumnInGroupBy(
        columnName: string,
        arrayEntitiesByDepth: Map<number, Set<string>>,
        currentDepth: number
    ): boolean {
        const isJsonColumn = columnName.endsWith('_json');
        let shouldInclude = true;

        // Check if this column belongs to array entities at current depth or deeper
        // These columns are being aggregated and should not be in GROUP BY
        for (const [entityDepth, columns] of arrayEntitiesByDepth.entries()) {
            if (entityDepth >= currentDepth && columns.has(columnName)) {
                shouldInclude = false;
                break;
            }
        }

        // Critical: JSON columns from objects within arrays being processed 
        // must be excluded from GROUP BY as they are aggregated within the array
        if (isJsonColumn) {
            // Legacy handling for entity_ prefixed JSON columns
            if (columnName.startsWith('entity_')) {
                shouldInclude = this.shouldIncludeJsonColumn(columnName, currentDepth);
            }
        }

        return shouldInclude;
    }

    /**
     * Applies heuristics for entity JSON column inclusion in GROUP BY.
     * Uses entity numbering patterns to identify deeply nested entities.
     * 
     * @param columnName The JSON column name (expected format: entity_N_json)
     * @param currentDepth The current aggregation depth
     * @returns True if the JSON column should be included, false otherwise
     */
    private shouldIncludeJsonColumn(columnName: string, currentDepth: number): boolean {
        const entityMatch = columnName.match(/entity_(\d+)_json/);
        if (!entityMatch) {
            return true;
        }

        // For depth > 0, exclude JSON columns from highly nested entities
        // This heuristic assumes entities with higher numbers are more deeply nested
        if (currentDepth > 0) {
            const entityNumber = parseInt(entityMatch[1]);
            // Entities with numbers > 2 are typically nested within arrays and should be excluded
            return entityNumber <= 2;
        }

        return true;
    }
}
