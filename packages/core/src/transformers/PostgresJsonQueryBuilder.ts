import { CommonTable, SourceAliasExpression, SelectItem, SelectClause, FromClause, SourceExpression, TableSource, GroupByClause, WithClause, SubQuerySource, LimitClause } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { SelectQuery } from '../models/SelectQuery';
import { IdentifierString, ValueComponent, ColumnReference, FunctionCall, ValueList, LiteralValue, BinaryExpression, CaseExpression, SwitchCaseArgument, CaseKeyValuePair, RawString, UnaryExpression } from '../models/ValueComponent';
import { SelectValueCollector } from "./SelectValueCollector";
import { PostgresObjectEntityCteBuilder, ProcessableEntity, JsonColumnMapping, CteBuilderResult } from './PostgresObjectEntityCteBuilder';
import { PostgresArrayEntityCteBuilder } from './PostgresArrayEntityCteBuilder';
import { QueryBuilder } from './QueryBuilder';
import { QueryBuildOptions } from './DynamicQueryBuilder';

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
    resultFormat?: "array" | "single";
    emptyResult?: string;
}

/**
 * PostgreSQL JSON query builder that transforms SimpleSelectQuery into queries
 * that return JSON arrays or single JSON objects using PostgreSQL JSON functions.
 */
export class PostgresJsonQueryBuilder {
    private selectValueCollector: SelectValueCollector;
    private objectEntityCteBuilder: PostgresObjectEntityCteBuilder;
    private arrayEntityCteBuilder: PostgresArrayEntityCteBuilder;

    constructor() {
        this.selectValueCollector = new SelectValueCollector(null);
        this.objectEntityCteBuilder = new PostgresObjectEntityCteBuilder();
        this.arrayEntityCteBuilder = new PostgresArrayEntityCteBuilder();
    }

    /**
     * Validates the JSON mapping and the original query.
     * @param query Original query to transform
     * @param mapping JSON mapping configuration
     */
    private validateMapping(query: SimpleSelectQuery, mapping: JsonMapping): void {
        const collector = new SelectValueCollector();
        const selectedValues = collector.collect(query);

        // sv.name is the alias or derived name
        const availableColumns = new Set(selectedValues.map(sv => sv.name));        // Check root entity columns
        for (const jsonKey in mapping.rootEntity.columns) {
            const columnDef = mapping.rootEntity.columns[jsonKey];
            // Handle both string and object formats
            const sourceColumn = typeof columnDef === 'string' ? columnDef : (columnDef as any).column;
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
                const columnDef = entity.columns[jsonKey];
                // Handle both string and object formats
                const sourceColumn = typeof columnDef === 'string' ? columnDef : (columnDef as any).column;
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
    }

    /**
     * Build JSON query from original query and mapping configuration.
     * @param originalQuery Original query to transform (can be any SelectQuery type)
     * @param mapping JSON mapping configuration
     * @returns Transformed query with JSON aggregation
     */
    public buildJsonQuery(originalQuery: SelectQuery, mapping: JsonMapping, options?: QueryBuildOptions): SimpleSelectQuery;
    public buildJsonQuery(originalQuery: SimpleSelectQuery, mapping: JsonMapping, options?: QueryBuildOptions): SimpleSelectQuery;
    public buildJsonQuery(originalQuery: SelectQuery | SimpleSelectQuery, mapping: JsonMapping, options?: QueryBuildOptions): SimpleSelectQuery {
        // Check jsonb option - must be true (or undefined/default) for GROUP BY compatibility
        if (options?.jsonb === false) {
            throw new Error(
                'JSONB must be enabled for PostgreSQL GROUP BY compatibility. ' +
                'JSON type cannot be used in GROUP BY clauses. ' +
                'Please set jsonb: true or omit the jsonb option (defaults to true).'
            );
        }

        // Convert any SelectQuery to SimpleSelectQuery using QueryBuilder
        const simpleQuery = originalQuery instanceof SimpleSelectQuery
            ? originalQuery
            : QueryBuilder.buildSimpleQuery(originalQuery);

        return this.buildJsonWithCteStrategy(simpleQuery, mapping);
    }

    /**
     * Build JSON query from original query and mapping configuration.
     * @deprecated Use buildJsonQuery instead. This method will be removed in a future version.
     * @param originalQuery Original query to transform
     * @param mapping JSON mapping configuration
     * @returns Transformed query with JSON aggregation
     */
    public buildJson(originalQuery: SimpleSelectQuery, mapping: JsonMapping): SimpleSelectQuery {
        console.warn('buildJson is deprecated. Use buildJsonQuery instead.');
        return this.buildJsonQuery(originalQuery, mapping);
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

        // Step 1: Create the initial CTE from the original query
        const { initialCte, initialCteAlias } = this.createInitialCte(originalQuery);

        let ctesForProcessing: CommonTable[] = [initialCte];
        let currentAliasToBuildUpon = initialCteAlias;

        // Step 2: Prepare entity information
        const allEntities = new Map<string, ProcessableEntity>();
        allEntities.set(mapping.rootEntity.id, { ...mapping.rootEntity, isRoot: true, propertyName: mapping.rootName });
        mapping.nestedEntities.forEach(ne => allEntities.set(ne.id, { ...ne, isRoot: false, propertyName: ne.propertyName }));        // Step 2.5: Build CTEs for object entities using dedicated builder
        const objectEntityResult = this.objectEntityCteBuilder.buildObjectEntityCtes(
            initialCte,
            allEntities,
            mapping
        );
        // Important: Replace the entire CTE list with the result from object entity builder
        // The object entity builder returns all CTEs including the initial one
        ctesForProcessing = objectEntityResult.ctes;
        currentAliasToBuildUpon = objectEntityResult.lastCteAlias;
        // Store column mappings for later use
        const columnMappings = objectEntityResult.columnMappings;

        // Step 3: Build CTEs for array entities using dedicated builder
        const arrayCteBuildResult = this.arrayEntityCteBuilder.buildArrayEntityCtes(
            ctesForProcessing,
            currentAliasToBuildUpon,
            allEntities,
            mapping,
            columnMappings
        );
        ctesForProcessing = arrayCteBuildResult.updatedCtes;
        currentAliasToBuildUpon = arrayCteBuildResult.lastCteAlias;

        // Step 4: Build the final SELECT query using all generated CTEs
        return this.buildFinalSelectQuery(
            ctesForProcessing,
            currentAliasToBuildUpon,
            allEntities,
            mapping,
            columnMappings
        );
    }

    /**
     * Creates the initial Common Table Expression (CTE) from the original query.
     * @param originalQuery The base SimpleSelectQuery.
     * @returns An object containing the initial CTE and its alias.
     */
    private createInitialCte(originalQuery: SimpleSelectQuery): { initialCte: CommonTable, initialCteAlias: string } {
        const originCteAlias = "origin_query";
        const originCte = new CommonTable(
            originalQuery,
            new SourceAliasExpression(originCteAlias, null),
            null
        );
        return { initialCte: originCte, initialCteAlias: originCteAlias };
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
    private buildFinalSelectQuery(
        finalCtesList: CommonTable[],
        lastCteAliasForFromClause: string,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping,
        columnMappings: JsonColumnMapping[]
    ): SimpleSelectQuery {
        const currentCtes = [...finalCtesList];

        // Define rootObjectCteAlias outside of if block
        const rootObjectCteAlias = `cte_root_${mapping.rootName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        const rootEntity = allEntities.get(mapping.rootEntity.id);
        if (!rootEntity) {
            throw new Error(`Root entity ${mapping.rootEntity.id} not found`);
        }
        if (mapping.resultFormat === "array" || !mapping.resultFormat) {
            // Step 4.1a: Create a CTE that wraps the final result as the root object            // No alias needed for single table SELECT
            const rootObjectBuilderExpression = this.buildEntityJsonObject(
                rootEntity,
                null,  // No source alias for single table
                mapping.nestedEntities,
                allEntities,
                columnMappings
            );

            const rootObjectSelectItem = new SelectItem(rootObjectBuilderExpression, mapping.rootName);
            const rootObjectCte = new CommonTable(
                new SimpleSelectQuery({
                    selectClause: new SelectClause([rootObjectSelectItem]),
                    fromClause: new FromClause(
                        new SourceExpression(
                            new TableSource(null, new IdentifierString(lastCteAliasForFromClause)),
                            null  // No alias
                        ),
                        null
                    ),
                }),
                new SourceAliasExpression(rootObjectCteAlias, null),
                null
            );
            currentCtes.push(rootObjectCte);

            // Step 4.1b: Aggregate all the root objects
            const aggregationFunc = "jsonb_agg";  // Always use JSONB
            const aggregateExpression = new FunctionCall(
                null,
                new RawString(aggregationFunc),
                new ValueList([new ColumnReference(null, new IdentifierString(mapping.rootName))]),
                null
            );

            return new SimpleSelectQuery({
                withClause: new WithClause(false, currentCtes),
                selectClause: new SelectClause([
                    new SelectItem(aggregateExpression, `${mapping.rootName}_array`)
                ]),
                fromClause: new FromClause(
                    new SourceExpression(new TableSource(null, new IdentifierString(rootObjectCteAlias)), null),
                    null
                ),
            });
        } else {
            // For a single object result, create root object CTE without alias
            const rootObjectBuilderExpression = this.buildEntityJsonObject(
                rootEntity,
                null,  // No source alias for single table
                mapping.nestedEntities,
                allEntities,
                columnMappings
            );

            const rootObjectSelectItem = new SelectItem(rootObjectBuilderExpression, mapping.rootName);
            const rootObjectCte = new CommonTable(
                new SimpleSelectQuery({
                    selectClause: new SelectClause([rootObjectSelectItem]),
                    fromClause: new FromClause(
                        new SourceExpression(
                            new TableSource(null, new IdentifierString(lastCteAliasForFromClause)),
                            null  // No alias
                        ),
                        null
                    ),
                }),
                new SourceAliasExpression(rootObjectCteAlias, null),
                null
            );
            currentCtes.push(rootObjectCte);

            // Select directly from the root_object_cte with LIMIT 1
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

    /**
     * Build JSON object for entity, using parent JSON columns when available
     */
    private buildEntityJsonObject(
        entity: ProcessableEntity,
        sourceAlias: string | null,
        nestedEntities: JsonMapping['nestedEntities'],
        allEntities: Map<string, ProcessableEntity>,
        columnMappings: JsonColumnMapping[]
    ): ValueComponent {
        const jsonBuildFunction = "jsonb_build_object";
        const args: ValueComponent[] = [];

        // Add the entity's own columns
        Object.entries(entity.columns).forEach(([jsonKey, columnDef]) => {
            // Handle both string and object formats
            const sqlColumn = typeof columnDef === 'string' ? columnDef : (columnDef as any).column;
            args.push(new LiteralValue(jsonKey, undefined, true));
            args.push(new ColumnReference(null, new IdentifierString(sqlColumn)));
        });

        // Find and process child entities (both object and array types)
        const childEntities = nestedEntities.filter((ne) => ne.parentId === entity.id);

        childEntities.forEach((childEntity) => {
            const child = allEntities.get(childEntity.id);
            if (!child) return;

            args.push(new LiteralValue(childEntity.propertyName, undefined, true)); if (childEntity.relationshipType === "object") {
                // For object relationships, use pre-computed JSON column from column mappings
                const mapping = columnMappings.find(m => m.entityId === child.id);
                if (!mapping) {
                    throw new Error(`Column mapping not found for entity: ${child.id}`);
                }
                args.push(new ColumnReference(null, new IdentifierString(mapping.generatedColumnName)));
            } else if (childEntity.relationshipType === "array") {
                // For array relationships, use the column directly
                args.push(new ColumnReference(null, new IdentifierString(childEntity.propertyName)));
            }
        });

        return new FunctionCall(null, new RawString(jsonBuildFunction), new ValueList(args), null);
    }
}