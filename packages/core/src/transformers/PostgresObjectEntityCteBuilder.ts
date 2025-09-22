import { CommonTable, SourceAliasExpression, SelectItem, SelectClause, FromClause, SourceExpression, TableSource } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { IdentifierString, ValueComponent, ColumnReference, FunctionCall, ValueList, LiteralValue, BinaryExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair, RawString } from '../models/ValueComponent';
import { JsonMapping } from './PostgresJsonQueryBuilder';

/**
 * Entity with processing metadata
 */
export interface ProcessableEntity {
    id: string;
    name: string;
    columns: { [jsonKey: string]: string };
    isRoot: boolean;
    propertyName: string;
    // For nested entities
    parentId?: string;
    relationshipType?: "object" | "array";
}

/**
 * JSON column mapping information
 */
export interface JsonColumnMapping {
    entityId: string;
    entityName: string;
    generatedColumnName: string; // e.g., "customer_json_1", "address_json_2"
    depth: number;
}

/**
 * Result from CTE builder including column mappings
 */
export interface CteBuilderResult {
    ctes: CommonTable[];
    lastCteAlias: string;
    columnMappings: JsonColumnMapping[];
}

/**
 * Information for object entity processing
 */
interface ObjectEntityProcessingInfo {
    entity: ProcessableEntity;
    depth: number;
}

/**
 * PostgreSQL-specific builder for creating CTEs for object entities (object relationships).
 * This class handles the creation of CTEs that build JSON/JSONB objects for object entities,
 * processing them from the deepest level up to ensure proper dependency ordering.
 * 
 * Features:
 * - Depth-based CTE naming (cte_object_depth_N)
 * - NULL handling for entity columns
 * - JSONB/JSON object construction
 * - Hierarchical processing of nested objects
 * 
 * Why depth calculation is critical:
 * 1. Object entities can be nested at multiple levels. We must process the deepest
 *    (most distant) objects first to ensure their JSON representations are available
 *    when building their parent entities.
 * 2. Object entity processing is essentially a column compression operation. Entities
 *    at the same depth level can be processed simultaneously since they don't depend
 *    on each other.
 * 
 * Example hierarchy:
 * Order (root, depth 0)
 *   └─ Customer (depth 1)
 *       └─ Address (depth 2)
 *   └─ Shipping (depth 1)
 *       └─ Carrier (depth 2)
 * 
 * Processing order: depth 2 → depth 1 → depth 0
 */
export class PostgresObjectEntityCteBuilder {    // Constants for consistent naming conventions
    private static readonly CTE_OBJECT_PREFIX = 'cte_object_depth_';
    private static readonly WILDCARD_COLUMN = '*';
    
    // Simple counter for unique JSON column names
    private jsonColumnCounter = 0;
    // Map entity ID to generated JSON column name
    private entityToJsonColumnMap = new Map<string, string>();
    // Column mappings for external use
    private columnMappings: JsonColumnMapping[] = [];    
    
    /**
     * Build CTEs for all object entities in the correct dependency order
     * @param initialCte The starting CTE containing all raw data
     * @param allEntities Map of all entities in the mapping
     * @param mapping The JSON mapping configuration
     * @returns Array of CTEs and the alias of the last CTE created
     */
    public buildObjectEntityCtes(
        initialCte: CommonTable,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping
    ): CteBuilderResult {
        
        // Reset counter and mapping for each query
        this.jsonColumnCounter = 0;
        this.entityToJsonColumnMap.clear();
        this.columnMappings = [];
        
        const ctes: CommonTable[] = [initialCte];
        let previousCteAlias = initialCte.aliasExpression.table.name;        // Collect and sort object entities by depth
        const objectEntityInfos = this.collectAndSortObjectEntities(mapping, allEntities);

        // Group entities by depth
        const entitiesByDepth = this.groupEntitiesByDepth(objectEntityInfos);

        // Process each depth level, starting from the deepest
        const depths = Array.from(entitiesByDepth.keys()).sort((a, b) => b - a);

        for (const depth of depths) {
            const entitiesAtDepth = entitiesByDepth.get(depth)!;
            const cteAlias = `${PostgresObjectEntityCteBuilder.CTE_OBJECT_PREFIX}${depth}`;

            // Build CTE for all entities at this depth
            const cte = this.buildDepthCte(
                entitiesAtDepth,
                previousCteAlias,
                cteAlias,
                mapping,
                allEntities
            );

            ctes.push(cte);
            previousCteAlias = cteAlias;
        }

        return { 
            ctes, 
            lastCteAlias: previousCteAlias,
            columnMappings: this.columnMappings
        };
    }
    
    /**
     * Generate unique JSON column name with entity name and counter
     */
    private generateUniqueJsonColumnName(entityName: string, entityId: string, depth: number): string {
        this.jsonColumnCounter++;
        const columnName = `${entityName.toLowerCase()}_json_${this.jsonColumnCounter}`;
        
        
        // Record mapping information for external use
        this.columnMappings.push({
            entityId,
            entityName,
            generatedColumnName: columnName,
            depth
        });
        
        return columnName;
    }    /**
     * Collect all object entities and calculate their depth from root.
     * 
     * Depth calculation is crucial because:
     * - It determines the processing order (deepest first)
     * - It ensures dependencies are resolved before an entity is processed
     * - It allows parallel processing of entities at the same depth level
     * 
     * @param mapping The JSON mapping configuration
     * @param allEntities Map of all entities in the mapping
     * @returns Array of object entity information with calculated depths
     */
    private collectAndSortObjectEntities(
        mapping: JsonMapping,
        allEntities: Map<string, ProcessableEntity>): ObjectEntityProcessingInfo[] {
        const objectInfos: ObjectEntityProcessingInfo[] = [];

        // Helper function to calculate actual object nesting depth for a given OBJECT entity
        const calculateActualObjectNestingDepth = (entityIdOfObject: string): number => {
            const initialEntity = allEntities.get(entityIdOfObject);
            if (!initialEntity) {
                throw new Error(`Entity ${entityIdOfObject} not found for depth calculation.`);
            }
            // If the object itself is root, its depth is 0. (This function should ideally be called for nested entities, not the root itself as a "parent CTE" subject)
            if (initialEntity.isRoot) return 0;

            // If the object is not root and has no parentId, it's considered a top-level object, depth 1.
            if (!initialEntity.parentId) {
                return 1;
            }

            let currentParentIdInHierarchy: string | undefined = initialEntity.parentId;
            let calculatedObjectDepth = 0;
            const visitedInPath = new Set<string>();
            visitedInPath.add(entityIdOfObject); // Add the starting object itself to detect cycles

            while (currentParentIdInHierarchy) {
                if (visitedInPath.has(currentParentIdInHierarchy)) {
                    throw new Error(`Circular dependency detected: ${currentParentIdInHierarchy} already visited in path for ${entityIdOfObject}`);
                }
                visitedInPath.add(currentParentIdInHierarchy);

                const parentEntityData = allEntities.get(currentParentIdInHierarchy);
                if (!parentEntityData) {
                    throw new Error(`Parent entity ${currentParentIdInHierarchy} not found during depth calculation for ${entityIdOfObject}`);
                }

                let parentIsConsideredAnObjectForNesting = false;
                if (parentEntityData.isRoot) {
                    parentIsConsideredAnObjectForNesting = true; // Root counts as an object ancestor
                } else {
                    // For non-root parents, find their definition in nestedEntities to check their type
                    const parentDefinition = mapping.nestedEntities.find(ne => ne.id === currentParentIdInHierarchy);
                    if (parentDefinition) {
                        if (parentDefinition.relationshipType === "object") {
                            parentIsConsideredAnObjectForNesting = true;
                        }
                        // If parentDefinition.relationshipType === "array", it's not an object ancestor for depth counting
                    } else {
                        // This implies currentParentIdInHierarchy refers to an entity not defined as root or in nestedEntities
                        // This should ideally not happen with a consistent mapping.
                        throw new Error(`Parent entity ${currentParentIdInHierarchy} (ancestor of ${entityIdOfObject}) has no definition in mapping.nestedEntities and is not root.`);
                    }
                }

                if (parentIsConsideredAnObjectForNesting) {
                    calculatedObjectDepth++;
                }

                if (parentEntityData.isRoot) {
                    break; // Stop when the root is processed as the highest object ancestor
                }
                currentParentIdInHierarchy = parentEntityData.parentId; // Move to the next ancestor
            }
            return calculatedObjectDepth;
        };

        mapping.nestedEntities.forEach(nestedEntity => {
            if (nestedEntity.relationshipType === "object") {
                const entity = allEntities.get(nestedEntity.id);
                // Ensure we don't process the root entity itself as a "parent" CTE,
                // and that the entity actually exists.
                if (entity && !entity.isRoot) {
                    objectInfos.push({
                        entity,
                        depth: calculateActualObjectNestingDepth(nestedEntity.id)
                    });
                }
            }
        });

        // The existing grouping and sorting by depth (b - a for descending) should still work correctly
        // as it processes deepest levels first, regardless of the absolute depth numbers.
        return objectInfos;
    }

    /**
     * Group entities by their depth level.
     * 
     * Grouping by depth allows us to:
     * - Process all entities at the same level in a single CTE
     * - Optimize query performance by reducing the number of CTEs
     * - Maintain clear dependency ordering
     * 
     * @param parentInfos Array of parent entity information with depths
     * @returns Map of depth level to entities at that depth
     */    private groupEntitiesByDepth(
        objectInfos: ObjectEntityProcessingInfo[]
    ): Map<number, ObjectEntityProcessingInfo[]> {
        const entitiesByDepth = new Map<number, ObjectEntityProcessingInfo[]>();

        objectInfos.forEach(info => {
            const depth = info.depth;
            if (!entitiesByDepth.has(depth)) {
                entitiesByDepth.set(depth, []);
            }
            entitiesByDepth.get(depth)!.push(info);
        });

        return entitiesByDepth;
    }

    /**
     * Build a CTE that processes all entities at a specific depth level
     */
    private buildDepthCte(
        entitiesAtDepth: ObjectEntityProcessingInfo[],
        previousCteAlias: string,
        cteAlias: string,
        mapping: JsonMapping,
        allEntities: Map<string, ProcessableEntity>
    ): CommonTable {
        // Build SELECT items: * and JSON objects for all entities at this depth
        const selectItems: SelectItem[] = [
            // Select all columns from previous CTE
            new SelectItem(new ColumnReference(null, new IdentifierString(PostgresObjectEntityCteBuilder.WILDCARD_COLUMN)))
        ];

        // Process each entity at this depth
        for (const { entity } of entitiesAtDepth) {
            const jsonColumn = this.buildEntityJsonColumn(entity, mapping, allEntities);
            selectItems.push(jsonColumn);
        }

        // Create CTE that selects from previous CTE
        const cteSelect = new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, new IdentifierString(previousCteAlias)),
                    null
                ),
                null
            )
        });

        return new CommonTable(cteSelect, new SourceAliasExpression(cteAlias, null), null);
    }

    /**
     * Build JSON column for a single entity with NULL handling
     */
    private buildEntityJsonColumn(
        entity: ProcessableEntity,
        mapping: JsonMapping,
        allEntities: Map<string, ProcessableEntity>
    ): SelectItem {
        
        // Build JSON object arguments and NULL checks
        const { jsonObjectArgs, nullChecks } = this.prepareEntityColumns(entity);

        // Add child object relationships
        this.addChildObjectRelationships(entity, jsonObjectArgs, mapping, allEntities);
        // Create JSON object
        const jsonObject = this.createJsonObject(jsonObjectArgs);

        // Build NULL condition and CASE expression
        const nullCondition = this.buildNullCondition(nullChecks);
        const caseExpr = this.createCaseExpression(nullCondition, jsonObject);

        // Add JSON object as named column with unique name to avoid conflicts
        // Calculate depth for this entity (approximate - for mapping purposes)
        const depth = this.calculateApproximateDepth(entity, mapping);
        const jsonColumnName = this.generateUniqueJsonColumnName(entity.name, entity.id, depth);
        // Store mapping for child entity references
        this.entityToJsonColumnMap.set(entity.id, jsonColumnName);
        return new SelectItem(caseExpr, jsonColumnName);
    }

    /**
     * Calculate approximate depth for an entity (for mapping purposes)
     */
    private calculateApproximateDepth(entity: ProcessableEntity, mapping: JsonMapping): number {
        if (entity.isRoot) return 0;
        if (!entity.parentId) return 1;
        
        // Simple depth calculation
        let depth = 1;
        let currentParentId = entity.parentId;
        
        while (currentParentId && currentParentId !== mapping.rootEntity.id) {
            const parentEntity = mapping.nestedEntities.find(e => e.id === currentParentId);
            if (!parentEntity) break;
            depth++;
            currentParentId = parentEntity.parentId;
        }
        
        return depth;
    }

    /**
     * Prepare entity columns and NULL checks.
     * 
     * This method extracts column data and creates NULL checks for each column.
     * The NULL checking is essential for handling outer joins correctly.
     * 
     * In outer join scenarios, when there's no matching row in the joined table,
     * all columns from that table will be NULL. Instead of creating an empty object
     * with all NULL properties (e.g., {id: null, name: null, email: null}),
     * we want to represent the absence of the entity as NULL itself.
     * 
     * This ensures cleaner JSON output where missing relationships are represented
     * as NULL rather than objects with all NULL fields.
     * 
     * @param entity The entity whose columns are being processed
     * @returns Object containing arrays of JSON object arguments and NULL check conditions
     */
    private prepareEntityColumns(entity: ProcessableEntity): {
        jsonObjectArgs: ValueComponent[],
        nullChecks: ValueComponent[]
    } {
        const jsonObjectArgs: ValueComponent[] = [];
        const nullChecks: ValueComponent[] = [];

        Object.entries(entity.columns).forEach(([jsonKey, sqlColumn]) => {
            jsonObjectArgs.push(new LiteralValue(jsonKey, undefined, true));
            jsonObjectArgs.push(new ColumnReference(null, new IdentifierString(sqlColumn)));

            // Collect NULL checks for each column
            nullChecks.push(
                new BinaryExpression(
                    new ColumnReference(null, new IdentifierString(sqlColumn)),
                    "is",
                    new LiteralValue(null)
                )
            );
        });

        return { jsonObjectArgs, nullChecks };
    }

    /**
     * Add child object relationships to JSON object arguments.
     * 
     * This method processes nested object-type entities that are direct children of the current entity.
     * For each child entity, it adds the property name and corresponding JSON column reference
     * to the arguments array that will be used to build the parent's JSON object.
     * 
     * The child JSON columns are expected to already exist in the data source (created by deeper
     * level CTEs), as we process from the deepest level up to the root.
     * 
     * Note: In this context, "child" refers to entities that have an object relationship (0..1)
     * with their parent. From a data perspective, these are typically entities referenced via
     * foreign keys, representing "parent" entities in traditional database terminology.
     * 
     * @param entity The current entity being processed
     * @param jsonObjectArgs Array to which JSON object arguments will be added
     * @param mapping The JSON mapping configuration
     * @param allEntities Map of all entities in the mapping
     */
    private addChildObjectRelationships(
        entity: ProcessableEntity,
        jsonObjectArgs: ValueComponent[],
        mapping: JsonMapping,
        allEntities: Map<string, ProcessableEntity>
    ): void {
        const childEntities = mapping.nestedEntities.filter(ne =>
            ne.parentId === entity.id && ne.relationshipType === "object"
        );

        childEntities.forEach(childEntity => {
            const child = allEntities.get(childEntity.id);
            if (child) {
                jsonObjectArgs.push(new LiteralValue(childEntity.propertyName, undefined, true));
                // Use mapped JSON column name to avoid conflicts
                const jsonColumnName = this.entityToJsonColumnMap.get(child.id);
                if (!jsonColumnName) {
                    throw new Error(`JSON column name not found for child entity: ${child.id}`);
                }
                jsonObjectArgs.push(new ColumnReference(null, new IdentifierString(jsonColumnName)));
            }
        });
    }

    /**
     * Create JSON object function call
     */
    private createJsonObject(args: ValueComponent[]): FunctionCall {
        const jsonBuildFunction = "jsonb_build_object";
        // Always use JSONB
        return new FunctionCall(
            null,
            new RawString(jsonBuildFunction),
            new ValueList(args),
            null
        );
    }

    /**
     * Build NULL condition from NULL checks
     */
    private buildNullCondition(nullChecks: ValueComponent[]): ValueComponent {
        return nullChecks.reduce((acc, check) =>
            acc ? new BinaryExpression(acc, "and", check) : check
        );
    }

    /**
     * Create CASE expression with NULL handling
     */
    private createCaseExpression(nullCondition: ValueComponent, jsonObject: ValueComponent): CaseExpression {
        return new CaseExpression(
            null,
            new SwitchCaseArgument(
                [new CaseKeyValuePair(nullCondition, new LiteralValue(null))],
                jsonObject  // ELSE return the JSON object
            )
        );
    }
}
