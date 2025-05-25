import { CommonTable, SourceAliasExpression, SelectItem, SelectClause, FromClause, SourceExpression, TableSource, GroupByClause, WithClause, SubQuerySource, LimitClause } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { IdentifierString, ValueComponent, ColumnReference, FunctionCall, ValueList, LiteralValue, BinaryExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair } from '../models/ValueComponent'; // Changed BinaryOperation to BinaryExpression
import { SelectValueCollector } from "./SelectValueCollector";

/**
 * Universal JSON mapping definition for creating any level of JSON structures.
 * Supports flat arrays, nested objects, and unlimited hierarchical structures.
 */
export interface JsonMapping {
    rootName: string;
    rootEntity: {
        id: string;
        name: string;
        columns: { [jsonKey: string]: string };
    };
    nestedEntities: Array<{
        id: string;
        name: string;
        parentId: string;
        propertyName: string;
        relationshipType?: "object" | "array";
        columns: { [jsonKey: string]: string };
    }>;
    useJsonb?: boolean;
    resultFormat?: "array" | "single";
    emptyResult?: string;
}

// Define a more specific type for entities within the builder logic
interface ProcessableEntity {
    id: string;
    name: string;
    columns: { [jsonKey: string]: string };
    isRoot: boolean;
    propertyName: string; // For root, this is mapping.rootName; for nested, it's nestedEntity.propertyName
    // For nested entities
    parentId?: string;
    relationshipType?: "object" | "array";
}

/**
 * Information needed to process an array entity during CTE construction.
 */
interface ArrayEntityProcessingInfo {
    entity: ProcessableEntity;
    parentEntity: ProcessableEntity;
    parentIdColumnSqlName: string; // SQL column name in the parent entity used for linking/grouping.
    depth: number; // Depth in the entity hierarchy, used for sorting.
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
    private cteCounter: number = 0; // Added for generating unique CTE names

    constructor() {
        this.selectValueCollector = new SelectValueCollector(null);
    }

    /**
     * Validates the JSON mapping and the original query.
     * @param mapping JSON mapping configuration
     * @param originalQuery Original query to transform
     */
    private validateMapping(query: SimpleSelectQuery, mapping: JsonMapping): void {
        // TODO: Implement comprehensive validation
        // 1. Check if columns in mapping exist in the query
        // 2. Check for valid parent-child relationships
        // 3. Check for unique child entity names under a parent
        // 4. An entity should not have multiple direct array children.
        const collector = new SelectValueCollector();
        const selectedValues = collector.collect(query);
        const availableColumns = new Set(selectedValues.map(sv => sv.name)); // sv.name is the alias or derived name

        // Check root entity columns
        for (const jsonKey in mapping.rootEntity.columns) {
            const sourceColumn = mapping.rootEntity.columns[jsonKey];
            if (!availableColumns.has(sourceColumn)) {
                throw new Error(`Validation Error: Column "${sourceColumn}" for JSON key "${jsonKey}" in root entity "${mapping.rootEntity.name}" not found in the query's select list.`);
            }
        }

        // Check nested entity columns and parent-child relationships
        const entityIds = new Set<string>([mapping.rootEntity.id]);
        const parentToChildrenMap = new Map<string, string[]>();

        mapping.nestedEntities.forEach(ne => {
            entityIds.add(ne.id);
            if (!parentToChildrenMap.has(ne.parentId)) {
                parentToChildrenMap.set(ne.parentId, []);
            }
            parentToChildrenMap.get(ne.parentId)!.push(ne.id);
        });

        for (const entity of mapping.nestedEntities) {
            if (!entityIds.has(entity.parentId)) {
                throw new Error(`Validation Error: Parent entity with ID "${entity.parentId}" for nested entity "${entity.name}" (ID: ${entity.id}) not found.`);
            }
            for (const jsonKey in entity.columns) {
                const sourceColumn = entity.columns[jsonKey];
                if (!availableColumns.has(sourceColumn)) {
                    throw new Error(`Validation Error: Column "${sourceColumn}" for JSON key "${jsonKey}" in nested entity "${entity.name}" (ID: ${entity.id}) not found in the query's select list.`);
                }
            }
        }

        // Validate: An entity should not have multiple direct array children.
        // Validate: Child propertyNames under a single parent must be unique.
        const allParentIds = new Set([mapping.rootEntity.id, ...mapping.nestedEntities.map(ne => ne.parentId)]);
        for (const parentId of allParentIds) {
            const directChildren = mapping.nestedEntities.filter(ne => ne.parentId === parentId);
            const directArrayChildrenCount = directChildren.filter(c => c.relationshipType === 'array').length;
            if (directArrayChildrenCount > 1) {
                const parentName = parentId === mapping.rootEntity.id ? mapping.rootEntity.name : mapping.nestedEntities.find(ne => ne.id === parentId)?.name;
                throw new Error(`Validation Error: Parent entity "${parentName}" (ID: ${parentId}) has multiple direct array children. This is not supported.`);
            }

            const propertyNames = new Set<string>();
            for (const child of directChildren) {
                if (propertyNames.has(child.propertyName)) {
                    const parentName = parentId === mapping.rootEntity.id ? mapping.rootEntity.name : mapping.nestedEntities.find(ne => ne.id === parentId)?.name;
                    throw new Error(`Validation Error: Parent entity "${parentName}" (ID: ${parentId}) has duplicate property name "${child.propertyName}" for its children.`);
                }
                propertyNames.add(child.propertyName);
            }
        }

        console.log("Mapping validation passed.");
    }

    /**
     * Build JSON query from original query and mapping configuration.
     * @param originalQuery Original query to transform
     * @param mapping JSON mapping configuration
     * @returns Transformed query with JSON aggregation
     */
    public buildJson(originalQuery: SimpleSelectQuery, mapping: JsonMapping): SimpleSelectQuery {
        this.cteCounter = 0; // Reset CTE counter for each build
        // this.validateMapping(originalQuery, mapping); // Validation is called inside buildJsonWithCteStrategy

        // Build entity lookup map (optional if direct access to mapping is preferred)
        // const entityMap = this.buildEntityMap(mapping);

        return this.buildJsonWithCteStrategy(originalQuery, mapping);
    }

    /**
     * Builds the JSON structure using a unified CTE-based strategy.
     * @param originalQuery Original query
     * @param mapping JSON mapping configuration
     * @returns Query with CTE-based JSON aggregation
     */
    private buildJsonWithCteStrategy(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
    ): SimpleSelectQuery {
        this.validateMapping(originalQuery, mapping);
        this.cteCounter = 0; // Reset CTE counter for each build

        // Step 1: Create the initial CTE from the original query
        const { initialCte, initialCteAlias } = this._createInitialCte(originalQuery);

        let ctesForProcessing: CommonTable[] = [initialCte];
        let currentAliasToBuildUpon = initialCteAlias;

        // Step 2: Prepare entity information and sort array entities by depth
        const { allEntities, sortedArrayInfos } = this._prepareEntitiesAndSortArrays(mapping);

        // Step 3: Build CTEs for array entities if any exist
        if (sortedArrayInfos.length > 0) {
            const arrayCteBuildResult = this._buildArrayEntityCtes(
                ctesForProcessing,
                currentAliasToBuildUpon,
                sortedArrayInfos,
                allEntities,
                mapping
            );
            ctesForProcessing = arrayCteBuildResult.updatedCtes;
            currentAliasToBuildUpon = arrayCteBuildResult.lastCteAlias;
        }

        // Step 4: Build the final SELECT query using all generated CTEs
        return this._buildFinalSelectQuery(
            ctesForProcessing,
            currentAliasToBuildUpon,
            allEntities,
            mapping
        );
    }

    /**
     * Creates the initial Common Table Expression (CTE) from the original query.
     * @param originalQuery The base SimpleSelectQuery.
     * @returns An object containing the initial CTE and its alias.
     */
    private _createInitialCte(originalQuery: SimpleSelectQuery): { initialCte: CommonTable, initialCteAlias: string } {
        const originCteAlias = "origin_query";
        const originCte = new CommonTable(
            originalQuery,
            new SourceAliasExpression(originCteAlias, null),
            null
        );
        return { initialCte: originCte, initialCteAlias: originCteAlias };
    }

    /**
     * Prepares a map of all processable entities and a sorted list of array entity information.
     * Array entities are sorted by depth (descending) to ensure deeper arrays are processed first.
     * @param mapping The JSON mapping configuration.
     * @returns An object containing the map of all entities and the sorted array entity information.
     */
    private _prepareEntitiesAndSortArrays(mapping: JsonMapping): { allEntities: Map<string, ProcessableEntity>, sortedArrayInfos: ArrayEntityProcessingInfo[] } {
        const allEntities = new Map<string, ProcessableEntity>();
        allEntities.set(mapping.rootEntity.id, { ...mapping.rootEntity, isRoot: true, propertyName: mapping.rootName });
        mapping.nestedEntities.forEach(ne => allEntities.set(ne.id, { ...ne, isRoot: false, propertyName: ne.propertyName }));

        const getDepth = (entityId: string, visited: Set<string> = new Set()): number => {
            if (visited.has(entityId)) throw new Error(`Circular dependency detected in entity hierarchy involving ID ${entityId}`);
            visited.add(entityId);

            const entity = allEntities.get(entityId);
            if (!entity || entity.isRoot || !entity.parentId) return 0; // Root or no parent means depth 0 relative to its own chain start

            const parentEntity = allEntities.get(entity.parentId);
            if (!parentEntity) {
                // This case should ideally be caught by validation earlier, but good to handle.
                console.warn(`Parent ID ${entity.parentId} not found for entity ${entityId} during depth calculation. This might indicate a broken chain or an orphaned entity.`);
                return 0; // Treat as depth 0 if parent is missing to prevent further errors
            }
            return 1 + getDepth(entity.parentId, new Set(visited)); // Recurse with a new Set for safety
        };

        const arrayEntityInfos: ArrayEntityProcessingInfo[] = [];
        mapping.nestedEntities.forEach(ne => {
            if (ne.relationshipType === "array") {
                const currentArrayEntity = allEntities.get(ne.id)!;
                const parentEntity = allEntities.get(ne.parentId);

                if (!parentEntity) {
                    throw new Error(`Configuration error: Parent entity with ID '${ne.parentId}' not found for array entity '${ne.name}'. This should be caught by validation.`);
                }
                // Determine the linking column from the parent. For simplicity, using the first defined column.
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
        return { allEntities, sortedArrayInfos: arrayEntityInfos };
    }

    /**
     * Builds CTEs for each array entity, processing them in order of depth.
     * Each CTE aggregates array elements and joins them to the data from the previous CTE.
     * @param ctesSoFar Array of CTEs built so far (starts with the initial CTE).
     * @param aliasOfCteToBuildUpon Alias of the CTE from which the current array CTE will select.
     * @param sortedArrayInfos Sorted list of array entity information.
     * @param allEntities Map of all processable entities.
     * @param mapping JSON mapping configuration.
     * @returns An object containing the updated list of all CTEs and the alias of the last CTE created.
     */
    private _buildArrayEntityCtes(
        ctesSoFar: CommonTable[],
        aliasOfCteToBuildUpon: string,
        sortedArrayInfos: ArrayEntityProcessingInfo[],
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping
    ): { updatedCtes: CommonTable[], lastCteAlias: string } {
        let currentCtes = [...ctesSoFar]; // Operate on a mutable copy
        let previousCteAlias = aliasOfCteToBuildUpon;

        for (const { entity: arrayEntity, parentEntity, parentIdColumnSqlName } of sortedArrayInfos) {
            // this.cteCounter++; // Counter no longer used for alias generation here
            const cteAlias = `cte_${arrayEntity.propertyName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

            const aggregationDetails = this.buildAggregationDetailsForArrayEntity(
                arrayEntity,
                previousCteAlias, // Data for array elements comes from this CTE
                parentIdColumnSqlName, // Used to inform how elements relate to parent, though grouping is external
                mapping.nestedEntities,
                allEntities,
                mapping.useJsonb
            );

            const prevCteDefinition = currentCtes.find(c => c.aliasExpression.table.name === previousCteAlias)?.query;
            if (!prevCteDefinition) {
                // This should not happen if aliases are managed correctly.
                throw new Error(`Internal error: CTE definition for alias ${previousCteAlias} not found during array CTE construction.`);
            }

            // Collect select values from the previous CTE to carry them forward.
            // Pass all `currentCtes` for context to the collector.
            const prevCteSelectValues = new SelectValueCollector(null, currentCtes).collect(prevCteDefinition);

            const selectItems: SelectItem[] = [];
            const groupByItems: ValueComponent[] = [];

            // Determine if the source CTE for columns is 'origin_query'
            const sourceTableRefForColumn = previousCteAlias !== "origin_query" ? null : [new IdentifierString(previousCteAlias)];

            prevCteSelectValues.forEach(sv => {
                selectItems.push(new SelectItem(new ColumnReference(sourceTableRefForColumn, new IdentifierString(sv.name)), sv.name));
                // Group by all columns from the previous CTE, except if a column has the same name
                // as the array property we are adding. This preserves the parent's data structure.
                if (sv.name !== arrayEntity.propertyName) {
                    groupByItems.push(new ColumnReference(sourceTableRefForColumn, new IdentifierString(sv.name)));
                }
            });

            // Add the aggregated JSON array as a new column.
            selectItems.push(new SelectItem(aggregationDetails.jsonAgg, arrayEntity.propertyName));

            const cteSelect = new SimpleSelectQuery({
                selectClause: new SelectClause(selectItems),
                fromClause: new FromClause(new SourceExpression(new TableSource(null, new IdentifierString(previousCteAlias)), null), null),
                groupByClause: groupByItems.length > 0 ? new GroupByClause(groupByItems) : null,
            });

            currentCtes.push(new CommonTable(cteSelect, new SourceAliasExpression(cteAlias, null), null));
            previousCteAlias = cteAlias; // The newly created CTE becomes the one to build upon next
        }
        return { updatedCtes: currentCtes, lastCteAlias: previousCteAlias };
    }

    /**
     * Builds the final SELECT query that constructs the root JSON object (or array of objects).
     * This query uses all previously generated CTEs.
     * @param finalCtesList The complete list of all CTEs (initial and array CTEs).
     * @param lastCteAliasForFromClause Alias of the final CTE from which the root object will be built.
     * @param allEntities Map of all processable entities.
     * @param mapping JSON mapping configuration.
     * @returns The final SimpleSelectQuery.
     */
    private _buildFinalSelectQuery(
        finalCtesList: CommonTable[],
        lastCteAliasForFromClause: string,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping
    ): SimpleSelectQuery {
        const rootProcessableEntity = allEntities.get(mapping.rootEntity.id)!;

        // Build the JSON object for the root entity, sourcing data from the last CTE.
        const rootEntityObjectBuilder = this.buildEntityJsonObject(
            rootProcessableEntity,
            lastCteAliasForFromClause,
            mapping.nestedEntities,
            allEntities,
            mapping.useJsonb
        );

        const finalSelectItems: SelectItem[] = [new SelectItem(rootEntityObjectBuilder, mapping.rootName)];
        let currentCtes = [...finalCtesList]; // Use a mutable copy for CTE list

        // This query structure produces one JSON object per row from the lastCteAliasForFromClause.
        const rootObjectConstructionQuery = new SimpleSelectQuery({
            // WITH clause is NOT included here yet, it will be part of the outermost query.
            selectClause: new SelectClause(finalSelectItems),
            fromClause: new FromClause(new SourceExpression(new TableSource(null, new IdentifierString(lastCteAliasForFromClause)), null), null),
        });

        // Always create a CTE for the root object construction, regardless of resultFormat.
        // This simplifies the logic as the final aggregation (if any) will always select from this CTE.
        const rootObjectCteAlias = `cte_root_${mapping.rootName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        const rootObjectCte = new CommonTable(
            rootObjectConstructionQuery, // This query defines the structure of each object
            new SourceAliasExpression(rootObjectCteAlias, null),
            null
        );
        currentCtes.push(rootObjectCte); // Add this new CTE to the list for the final query

        // Now, decide how to use this root_object_cte based on the resultFormat.
        if (mapping.resultFormat === "array" || !mapping.resultFormat) { // Default to array
            const aggFunc = mapping.useJsonb ? "jsonb_agg" : "json_agg";
            const finalAggAlias = mapping.rootName + "_array"; // Alias for the final aggregated array

            const finalAggregatedQuery = new SimpleSelectQuery({
                withClause: new WithClause(false, currentCtes), // All CTEs are now here
                selectClause: new SelectClause([
                    new SelectItem(
                        new FunctionCall(null, new IdentifierString(aggFunc), new ValueList([new ColumnReference(null, new IdentifierString(mapping.rootName))]), null),
                        finalAggAlias
                    )
                ]),
                fromClause: new FromClause(
                    new SourceExpression(new TableSource(null, new IdentifierString(rootObjectCteAlias)), null), // Select from the new root_object_cte
                    null
                )
            });
            return finalAggregatedQuery;
        } else { // Result format is "single"
            // For a single object result, select directly from the root_object_cte.
            // The rootObjectConstructionQuery (which is inside rootObjectCte) already builds the object.
            // Add LIMIT 1 to ensure only a single object is returned.
            return new SimpleSelectQuery({
                withClause: new WithClause(false, currentCtes),
                selectClause: new SelectClause([
                    new SelectItem(new ColumnReference(null, new IdentifierString(mapping.rootName)), mapping.rootName)
                ]),
                fromClause: new FromClause(
                    new SourceExpression(new TableSource(null, new IdentifierString(rootObjectCteAlias)), null),
                    null
                ),
                limitClause: new LimitClause(new LiteralValue(1)) // Correctly use LimitClause
            });
        }
    }

    private buildAggregationDetailsForArrayEntity(
        arrayEntityConfig: ProcessableEntity, // This is the entity for the *elements* of the array
        sourceCteAliasForParentData: string, // CTE providing parent data and columns for array elements
        parentIdSqlColumnNameInParent: string, // Used for GROUP BY in the calling CTE, not directly here
        allNestedEntitiesGlobal: JsonMapping['nestedEntities'],
        allEntitiesMapGlobal: Map<string, ProcessableEntity>,
        useJsonb?: boolean
    ): { jsonAgg: FunctionCall } {
        const jsonAggFunc = useJsonb ? "jsonb_agg" : "json_agg";

        // The object to be aggregated is built using buildEntityJsonObject.
        // This object represents a single element of the JSON array.
        // Its columns are sourced from `sourceCteAliasForParentData` because that CTE contains the denormalized data.
        const elementObjectBuilder = this.buildEntityJsonObject(
            arrayEntityConfig,
            sourceCteAliasForParentData,
            allNestedEntitiesGlobal,
            allEntitiesMapGlobal,
            useJsonb
        );

        // Aggregate these built objects into a JSON array.
        // The filtering/correlation by parent ID is handled by the GROUP BY clause in the CTE that *uses* this jsonAgg.
        const aggCall = new FunctionCall(null, jsonAggFunc, new ValueList([elementObjectBuilder]), null);
        return { jsonAgg: aggCall };
    }

    private buildEntityJsonObject(
        entityConfig: ProcessableEntity,
        sourceCteAlias: string, // The CTE from which to source columns for this entity
        allNestedEntitiesGlobal: JsonMapping['nestedEntities'],
        allEntitiesMapGlobal: Map<string, ProcessableEntity>,
        useJsonb?: boolean
    ): ValueComponent { // Return ValueComponent to allow returning LiteralValue('null')
        const jsonBuildFunc = useJsonb ? "jsonb_build_object" : "json_build_object";
        const properties: ValueComponent[] = [];

        const sourceTableRefForColumn = null; // Always null to omit CTE alias

        // Add own columns for the current entity
        for (const jsonKey in entityConfig.columns) {
            const sqlColumnName = entityConfig.columns[jsonKey];
            properties.push(new LiteralValue(jsonKey));
            properties.push(new ColumnReference(sourceTableRefForColumn, new IdentifierString(sqlColumnName)));
        }

        // Find direct children of the current entityConfig
        const directChildren = allNestedEntitiesGlobal.filter(ne => ne.parentId === entityConfig.id);
        for (const childEntityDef of directChildren) {
            const childEntityConfig = allEntitiesMapGlobal.get(childEntityDef.id)!;
            properties.push(new LiteralValue(childEntityConfig.propertyName));

            if (childEntityConfig.relationshipType === "array") {
                properties.push(new ColumnReference(sourceTableRefForColumn, new IdentifierString(childEntityConfig.propertyName)));
            } else { // "object"
                // Recursively build the child object.
                // This recursive call will also handle the NULL check for the child.
                const childJsonObject = this.buildEntityJsonObject(
                    childEntityConfig,
                    sourceCteAlias, // Child object's columns are also sourced from the same CTE
                    allNestedEntitiesGlobal,
                    allEntitiesMapGlobal,
                    useJsonb
                );
                properties.push(childJsonObject);
            }
        }

        // If there are no properties at all (e.g. an entity with no columns and no children),
        // it should still produce an empty object if it's not meant to be null.
        // However, the primary concern is handling null for entities that *could* have data.

        // Create a list of all SQL column names that constitute this entity and its direct object children.
        // This is used to check if all of them are NULL.
        const allConstituentSqlColumns: string[] = Object.values(entityConfig.columns);
        directChildren.forEach(childDef => {
            if (childDef.relationshipType === "object") {
                const childConfig = allEntitiesMapGlobal.get(childDef.id)!;
                allConstituentSqlColumns.push(...Object.values(childConfig.columns));
                // Recursively add grand-child columns if they are also objects
                const grandChildren = allNestedEntitiesGlobal.filter(gc => gc.parentId === childDef.id && gc.relationshipType === "object");
                grandChildren.forEach(gcDef => {
                    const gcConfig = allEntitiesMapGlobal.get(gcDef.id)!;
                    allConstituentSqlColumns.push(...Object.values(gcConfig.columns));
                });
            }
            // For array children, their nullability is handled by the aggregation (COALESCE around jsonb_agg if needed),
            // or by the fact that their propertyName column in the sourceCteAlias might be null.
            // So, we don't include their columns in *this* entity's null check.
        });

        if (allConstituentSqlColumns.length > 0) {
            // If all SQL columns that make up this object (and its nested objects) are NULL,
            // then the entire object should be NULL.
            const conditions = allConstituentSqlColumns.map(colName =>
                new BinaryExpression( // Changed from BinaryOperation
                    new ColumnReference(sourceTableRefForColumn, new IdentifierString(colName)),
                    'is',
                    new LiteralValue(null)
                )
            );

            let combinedCondition: ValueComponent = conditions[0];
            for (let i = 1; i < conditions.length; i++) {
                combinedCondition = new BinaryExpression(combinedCondition, 'and', conditions[i]); // Changed from BinaryOperation
            }

            return new CaseExpression(
                null, // No main condition for simple WHEN ... THEN ... ELSE
                new SwitchCaseArgument(
                    [new CaseKeyValuePair(combinedCondition, new LiteralValue(null))], // WHEN combinedCondition THEN NULL
                    new FunctionCall(null, new IdentifierString(jsonBuildFunc), new ValueList(properties), null) // ELSE build_object(...)
                )
            );
        } else {
            // If there are no columns to check for null (e.g., an entity that only has array children, or no children/columns at all),
            // then just build the object. It might be an empty object {} if properties is also empty.
            return new FunctionCall(null, new IdentifierString(jsonBuildFunc), new ValueList(properties), null);
        }
    }
}