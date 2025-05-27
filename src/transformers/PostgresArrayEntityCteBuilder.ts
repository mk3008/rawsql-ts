import { CommonTable, SourceAliasExpression, SelectItem, SelectClause, FromClause, SourceExpression, TableSource, GroupByClause } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { IdentifierString, ValueComponent, ColumnReference, FunctionCall, ValueList, LiteralValue, RawString } from '../models/ValueComponent';
import { JsonMapping } from './PostgreJsonQueryBuilder';
import { ProcessableEntity } from './PostgresObjectEntityCteBuilder';
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
 * PostgreSQL-specific builder for creating CTEs for array entities (array relationships).
 * This class handles the creation of CTEs that build JSON/JSONB arrays for child entities,
 * processing them from the deepest level up to ensure proper dependency ordering.
 * 
 * Features:
 * - Depth-based CTE naming (cte_array_depth_N)
 * - Row compression using GROUP BY operations
 * - JSONB/JSON array aggregation
 * - Hierarchical processing of nested arrays
 * - Column exclusion to avoid duplication
 * 
 * Why depth calculation is critical:
 * 1. Array entities can be nested at multiple levels. We must process the deepest
 *    (most distant) arrays first to ensure their JSON representations are available
 *    when building their parent arrays.
 * 2. Array entity processing is essentially a row compression operation using GROUP BY.
 *    Unlike parent entities which use column compression, arrays require grouping
 *    to aggregate multiple rows into JSON arrays.
 * 
 * Example hierarchy:
 * Order (root, depth 0)
 *   └─ Items (array, depth 1)
 *       └─ Details (array, depth 2)
 * 
 * Processing order: depth 2 → depth 1 → depth 0
 */
export class PostgresArrayEntityCteBuilder {
    // Constants for consistent naming conventions
    private static readonly CTE_ARRAY_PREFIX = 'cte_array_depth_';

    /**
     * Build CTEs for all array entities in the correct dependency order
     * @param ctesSoFar Array of CTEs built so far (starts with the initial CTE)
     * @param aliasOfCteToBuildUpon Alias of the CTE from which the current array CTE will select
     * @param allEntities Map of all entities in the mapping
     * @param mapping The JSON mapping configuration
     * @returns Object containing the updated list of all CTEs and the alias of the last CTE created
     */
    public buildArrayEntityCtes(
        ctesSoFar: CommonTable[],
        aliasOfCteToBuildUpon: string,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping
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
                mapping
            );

            currentCtes.push(cte);
            currentCteAlias = newCteAlias;
        }

        return { updatedCtes: currentCtes, lastCteAlias: currentCteAlias };
    }

    /**
     * Collect all array entities and calculate their depth from root.
     * 
     * Depth calculation ensures proper processing order where deeper nested
     * arrays are processed first, making their aggregated data available
     * for parent array processing.
     * 
     * @param mapping The JSON mapping configuration
     * @param allEntities Map of all entities in the mapping
     * @returns Array of array entity information with calculated depths, sorted deepest first
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
     * Group array entities by their depth level.
     * 
     * Grouping by depth allows us to:
     * - Process all entities at the same level in a single CTE
     * - Optimize query performance by reducing the number of CTEs
     * - Maintain clear dependency ordering
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
     * Build a CTE that processes all array entities at a specific depth level.
     * 
     * This method creates a single CTE that aggregates multiple array entities
     * at the same depth, using GROUP BY to compress rows into JSON arrays.
     * 
     * @param infos Array entities at this depth level
     * @param currentCteAlias Alias of the CTE to build upon
     * @param currentCtes All CTEs built so far
     * @param depth Current depth level being processed
     * @param mapping JSON mapping configuration
     * @returns The new CTE and its alias
     */
    private buildDepthCte(
        infos: ArrayEntityProcessingInfo[],
        currentCteAlias: string,
        currentCtes: CommonTable[],
        depth: number,
        mapping: JsonMapping
    ): { cte: CommonTable, newCteAlias: string } {
        // Collect columns that will be compressed into arrays
        const arrayColumns = new Set<string>();
        infos.forEach(info => {
            Object.values(info.entity.columns).forEach(col => arrayColumns.add(col));
        });

        // Get columns from previous CTE
        const prevCte = currentCtes.find(c => c.aliasExpression.table.name === currentCteAlias)?.query;
        if (!prevCte) {
            throw new Error(`CTE not found: ${currentCteAlias}`);
        }

        const prevSelects = new SelectValueCollector(null, currentCtes).collect(prevCte);

        // Build SELECT items: columns that are NOT being compressed (for GROUP BY)
        const groupByItems: ValueComponent[] = [];
        const selectItems: SelectItem[] = [];

        prevSelects.forEach(sv => {
            if (!arrayColumns.has(sv.name)) {
                selectItems.push(new SelectItem(new ColumnReference(null, new IdentifierString(sv.name)), sv.name));
                groupByItems.push(new ColumnReference(null, new IdentifierString(sv.name)));
            }
        });

        // Add JSON aggregation columns for each array entity at this depth
        for (const info of infos) {
            const agg = this.buildAggregationDetailsForArrayEntity(
                info.entity,
                mapping.nestedEntities,
                new Map(), // allEntities - not needed for array aggregation
                mapping.useJsonb
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
     * Build JSON aggregation function for an array entity.
     * 
     * This method creates a jsonb_agg or json_agg function call that aggregates
     * the entity's columns into a JSON array. It also handles nested relationships
     * by including child entity properties in the JSON object.
     * 
     * @param entity The array entity being processed
     * @param nestedEntities All nested entities from the mapping
     * @param allEntities Map of all entities (not used in current implementation)
     * @param useJsonb Whether to use JSONB functions
     * @returns Object containing the JSON aggregation function
     */
    private buildAggregationDetailsForArrayEntity(
        entity: ProcessableEntity,
        nestedEntities: any[],
        allEntities: Map<string, ProcessableEntity>,
        useJsonb: boolean = false
    ): { jsonAgg: ValueComponent } {
        // Build JSON object for array elements
        const jsonBuildFunction = useJsonb ? "jsonb_build_object" : "json_build_object";
        const args: ValueComponent[] = [];

        // Add the entity's own columns
        Object.entries(entity.columns).forEach(([jsonKey, sqlColumn]) => {
            args.push(new LiteralValue(jsonKey));
            args.push(new ColumnReference(null, new IdentifierString(sqlColumn)));
        });

        // Find and process child entities (both object and array types)
        const childEntities = nestedEntities.filter((ne) => ne.parentId === entity.id);

        childEntities.forEach((childEntity) => {
            args.push(new LiteralValue(childEntity.propertyName));

            if (childEntity.relationshipType === "object") {
                // For object relationships, use pre-computed JSON column
                const jsonColumnName = `${childEntity.name.toLowerCase()}_json`;
                args.push(new ColumnReference(null, new IdentifierString(jsonColumnName)));
            } else if (childEntity.relationshipType === "array") {
                // For array relationships, use the column directly
                args.push(new ColumnReference(null, new IdentifierString(childEntity.propertyName)));
            }
        });

        // Create JSON object
        const jsonObject = new FunctionCall(null, new RawString(jsonBuildFunction), new ValueList(args), null);

        // Create JSON aggregation
        const jsonAggFunction = useJsonb ? "jsonb_agg" : "json_agg";
        const jsonAgg = new FunctionCall(
            null,
            new RawString(jsonAggFunction),
            new ValueList([jsonObject]),
            null
        );

        return { jsonAgg };
    }
}
