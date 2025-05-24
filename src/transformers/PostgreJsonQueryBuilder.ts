import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { ValueComponent, LiteralValue, FunctionCall, ColumnReference, IdentifierString, RawString, ValueList, CastExpression, TypeValue, ParenExpression } from '../models/ValueComponent';
import { SelectClause, SelectItem, FromClause, WhereClause, LimitClause, SubQuerySource, SourceExpression, SourceAliasExpression } from '../models/Clause';
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
        /**
         * Entity identifier (used to reference this entity in hierarchical structures).
         * For flat structures, this can be any unique string.
         */
        id: string;

        /**
         * Entity name (e.g., "Product", "Category")
         */
        name: string;

        /**
         * Column mappings for this entity.
         * Key: JSON property name, Value: SQL column name
         */
        columns: { [jsonKey: string]: string };
    };

    /**
     * Nested entity configurations with explicit parent relationships.
     * Empty array for flat structures.
     */
    nestedEntities: {
        /**
         * Entity identifier (used to reference this entity).
         */
        id: string;

        /**
         * Entity name (e.g., "Category", "Brand")
         */
        name: string;

        /**
         * Column mappings for this entity.
         * Key: JSON property name, Value: SQL column name
         */
        columns: { [jsonKey: string]: string };

        /**
         * Parent entity ID that this entity should be nested under.
         */
        parentId: string;

        /**
         * Property name where this entity will be nested in its parent.
         */
        propertyName: string;
    }[];

    /**
     * Whether to use JSONB instead of JSON.
     * @default true
     */
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
 * SimpleSelectQuery を、PostgreSQLのJSON関数を使って
 * フラットなJSON配列または単一JSONオブジェクトを返すクエリに変換するクラスだよ。
 */
export class PostgreJsonQueryBuilder {
    private selectValueCollector: SelectValueCollector;

    constructor() {
        this.selectValueCollector = new SelectValueCollector(null);
    }

    /**
     * Build JSON structure query based on JsonMapping.
     * Supports flat arrays, nested objects, and unlimited hierarchical structures.
     * @param originalQuery Original SimpleSelectQuery
     * @param mapping Universal JSON mapping configuration
     * @returns New SimpleSelectQuery that returns JSON structure
     */
    public buildJson(originalQuery: SimpleSelectQuery, mapping: JsonMapping): SimpleSelectQuery {
        const useJsonb = mapping.useJsonb !== undefined ? mapping.useJsonb : true;
        const jsonPrefix = useJsonb ? "jsonb" : "json";
        const resultFormat = mapping.resultFormat || "array";

        if (mapping.nestedEntities.length === 0) {
            // Flat structure
            const selectedValues = this.selectValueCollector.collect(originalQuery);
            if (resultFormat === "single") {
                return this.buildSingleJsonObjectQuery(originalQuery, mapping, selectedValues, jsonPrefix);
            } else {
                return this.buildFlatJsonArrayQuery(originalQuery, mapping, selectedValues, jsonPrefix);
            }
        } else {
            // Hierarchical structure
            return this.buildHierarchicalJsonArrayQuery(originalQuery, mapping, jsonPrefix);
        }
    }

    private buildSingleJsonObjectQuery(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        selectedValues: { name: string; value: ValueComponent }[],
        jsonPrefix: string
    ): SimpleSelectQuery {
        const sourceAliasName = "_sub";
        const buildObjectArgsArray: ValueComponent[] = [];

        // Use root entity columns if specified, otherwise use selected values
        if (Object.keys(mapping.rootEntity.columns).length > 0) {
            for (const [jsonKey, sqlColumn] of Object.entries(mapping.rootEntity.columns)) {
                buildObjectArgsArray.push(new LiteralValue(jsonKey));
                buildObjectArgsArray.push(new ColumnReference([sourceAliasName], sqlColumn));
            }
        } else {
            for (const sv of selectedValues) {
                buildObjectArgsArray.push(new LiteralValue(sv.name));
                buildObjectArgsArray.push(new ColumnReference([sourceAliasName], sv.name));
            }
        }

        const buildObjectFunc = new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_build_object`),
            new ValueList(buildObjectArgsArray),
            null
        );

        const emptyResult = mapping.emptyResult || 'null';
        const coalesceFunc = new FunctionCall(
            null,
            new RawString("coalesce"),
            new ValueList([
                buildObjectFunc,
                new CastExpression(
                    new LiteralValue(emptyResult),
                    new TypeValue(null, jsonPrefix)
                )
            ]),
            null
        );

        const subQuerySource = new SubQuerySource(originalQuery);
        const fromClause = new FromClause(new SourceExpression(subQuerySource, new SourceAliasExpression(sourceAliasName, null)), null);

        const selectItem = new SelectItem(coalesceFunc, mapping.rootName);
        const selectClause = new SelectClause([selectItem]);

        const limitClause = new LimitClause(new LiteralValue(1));

        return new SimpleSelectQuery({
            selectClause: selectClause,
            fromClause: fromClause,
            limitClause: limitClause
        });
    }

    private buildFlatJsonArrayQuery(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        selectedValues: { name: string; value: ValueComponent }[],
        jsonPrefix: string
    ): SimpleSelectQuery {
        const buildObjectArgsArray: ValueComponent[] = [];

        // Use root entity columns if specified, otherwise use selected values
        if (Object.keys(mapping.rootEntity.columns).length > 0) {
            for (const [jsonKey, sqlColumn] of Object.entries(mapping.rootEntity.columns)) {
                buildObjectArgsArray.push(new LiteralValue(jsonKey));
                const columnValue = selectedValues.find(sv => sv.name === sqlColumn)?.value;
                if (columnValue) {
                    buildObjectArgsArray.push(columnValue);
                } else {
                    // Fallback to column reference if not found in selected values
                    buildObjectArgsArray.push(new ColumnReference([], sqlColumn));
                }
            }
        } else {
            for (const sv of selectedValues) {
                buildObjectArgsArray.push(new LiteralValue(sv.name));
                buildObjectArgsArray.push(sv.value);
            }
        }

        const buildObjectFunc = new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_build_object`),
            new ValueList(buildObjectArgsArray),
            null
        );

        const aggregateFunc = new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_agg`),
            new ValueList([buildObjectFunc]),
            null
        );

        const coalesceFunc = new FunctionCall(
            null,
            new RawString("coalesce"),
            new ValueList([
                aggregateFunc,
                new CastExpression(
                    new LiteralValue("[]"),
                    new TypeValue(null, jsonPrefix)
                )
            ]),
            null
        );

        const newSelectItem = new SelectItem(coalesceFunc, mapping.rootName);
        const newSelectClause = new SelectClause([newSelectItem]);

        return new SimpleSelectQuery({
            selectClause: newSelectClause,
            fromClause: originalQuery.fromClause,
            whereClause: originalQuery.whereClause,
            groupByClause: originalQuery.groupByClause,
            havingClause: originalQuery.havingClause,
            orderByClause: originalQuery.orderByClause,
            limitClause: originalQuery.limitClause,
            offsetClause: originalQuery.offsetClause,
            fetchClause: originalQuery.fetchClause,
            forClause: originalQuery.forClause,
            withClause: originalQuery.withClause,
            windowClause: originalQuery.windowClause,
        });
    }

    private buildHierarchicalJsonArrayQuery(
        originalQuery: SimpleSelectQuery,
        mapping: JsonMapping,
        jsonPrefix: string
    ): SimpleSelectQuery {
        const sourceAliasName = "_sub";

        // Build entity lookup map with proper typing
        type EntityType = {
            id: string;
            name: string;
            columns: { [jsonKey: string]: string };
            parentId?: string;
            propertyName?: string;
        };

        const entityMap = new Map<string, EntityType>();
        entityMap.set(mapping.rootEntity.id, mapping.rootEntity);

        for (const entity of mapping.nestedEntities) {
            entityMap.set(entity.id, entity);
        }

        // Validate parent relationships
        for (const entity of mapping.nestedEntities) {
            if (!entityMap.has(entity.parentId)) {
                throw new Error(`Parent entity '${entity.parentId}' not found for entity '${entity.id}'`);
            }
        }

        // Build hierarchical structure recursively
        const buildEntityObject = (entityId: string): ValueComponent => {
            const entity = entityMap.get(entityId);
            if (!entity) {
                throw new Error(`Entity '${entityId}' not found`);
            }

            const objectArgs: ValueComponent[] = [];

            // Add columns for current entity
            for (const [jsonKey, sqlColumn] of Object.entries(entity.columns)) {
                objectArgs.push(new LiteralValue(jsonKey));
                objectArgs.push(new ColumnReference([sourceAliasName], sqlColumn));
            }

            // Find and add children
            const children = mapping.nestedEntities.filter((ne: any) => ne.parentId === entityId);
            for (const child of children) {
                objectArgs.push(new LiteralValue(child.propertyName));
                objectArgs.push(buildEntityObject(child.id));
            }

            return new FunctionCall(
                null,
                new RawString(`${jsonPrefix}_build_object`),
                new ValueList(objectArgs),
                null
            );
        };

        // Build root object
        const rootObject = buildEntityObject(mapping.rootEntity.id);

        // Aggregate root objects into array
        const aggregateFunc = new FunctionCall(
            null,
            new RawString(`${jsonPrefix}_agg`),
            new ValueList([rootObject]),
            null
        );

        // Create outer query
        const subQuerySource = new SubQuerySource(originalQuery);
        const fromClause = new FromClause(new SourceExpression(subQuerySource, new SourceAliasExpression(sourceAliasName, null)), null);

        const selectItem = new SelectItem(aggregateFunc, mapping.rootName);
        const selectClause = new SelectClause([selectItem]);

        return new SimpleSelectQuery({
            selectClause: selectClause,
            fromClause: fromClause
        });
    }
}