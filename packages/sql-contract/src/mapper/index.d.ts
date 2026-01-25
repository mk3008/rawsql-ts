import type { QueryParams } from '../query-params';
export type { QueryParams } from '../query-params';
/**
 * A single database row returned by a SQL driver.
 * Row keys are SQL column names, which must be strings; symbol keys are not supported.
 */
export type Row = Record<string, unknown>;
/**
 * Executes SQL and returns the resulting rows.
 *
 * The mapper keeps this layer DBMS/driver agnostic; callers inject the concrete
 * executor that speaks to the desired database.
 */
export type QueryExecutor = (sql: string, params: QueryParams) => Promise<Row[]>;
/**
 * Defines how a column prefix, key, and optional overrides describe a row mapping.
 */
export interface RowMappingOptions<T, K extends Extract<keyof T, string>> {
    name: string;
    key: K;
    prefix?: string;
    columnMap?: Partial<Record<Extract<keyof T, string>, string>>;
    coerce?: boolean;
    /**
     * Row mappings rely on a very narrow coercion helper; it only receives the
     * raw column value so callers can swap in their own rules.
     */
    coerceFn?: (value: unknown) => unknown;
}
export type { RowMappingOptions as EntityOptions };
/**
 * Describes how a child mapping references a parent mapping.
 */
export interface BelongsToOptions {
    optional?: boolean;
}
/**
 * Controls how raw column names are normalized for simple mapping.
 */
export type KeyTransform = 'snake_to_camel' | 'none' | ((column: string) => string);
/**
 * Supported type hints for `mapSimpleRows`, controlling how primitive values are coerced before identifier normalization.
 */
export type SimpleMapTypeHint = 'string' | 'number' | 'boolean' | 'date' | 'bigint';
/**
 * Options that influence simple (duck-typed) row mapping.
 */
export interface MapperOptions {
    keyTransform?: KeyTransform;
    idKeysAsString?: boolean;
    typeHints?: Record<string, SimpleMapTypeHint>;
    coerceDates?: boolean;
    /**
     * Receives both the normalized property name and the original column name so callers
     * can implement property-specific logic without re-running normalization.
     */
    coerceFn?: (args: {
        key: string;
        sourceKey: string;
        value: unknown;
    }) => unknown;
}
/**
 * Named presets for simple mapping that avoid implicit inference.
 */
export declare const mapperPresets: {
    safe(): MapperOptions;
    appLike(): MapperOptions;
};
type ParentLink<T> = {
    propertyName: string;
    parent: RowMapping<any>;
    localKey: string;
    optional: boolean;
};
type RowContext = {
    row: Row;
    normalizedColumns: Map<string, string>;
};
/**
 * Builds a row mapping that can be consumed by {@link Mapper#query} or {@link mapRows}.
 */
export declare class RowMapping<T, K extends Extract<keyof T, string> = Extract<keyof T, string>> {
    readonly name: string;
    readonly key: K;
    readonly prefix: string;
    readonly parents: ParentLink<T>[];
    private readonly columnMap;
    private readonly overrideLookup;
    private readonly prefixNormalized;
    private readonly prefixLength;
    private readonly shouldCoerce;
    private readonly coerceFn;
    constructor(options: RowMappingOptions<T, K>);
    /**
     * Registers a parent relationship that will be attached after the current row is mapped.
     */
    belongsTo<P, PK extends Extract<keyof P, string>>(propertyName: Extract<keyof T, string>, parent: RowMapping<P, PK>, localKey: Extract<keyof T, string>, options?: BelongsToOptions): this;
    /**
     * Registers a parent relationship with an explicit local key.
     */
    belongsToWithLocalKey<P, PK extends Extract<keyof P, string>>(propertyName: Extract<keyof T, string>, parent: RowMapping<P, PK>, localKey: Extract<keyof T, string>): this;
    /**
     * Registers an optional parent relationship with an explicit local key.
     */
    belongsToOptional<P, PK extends Extract<keyof P, string>>(propertyName: Extract<keyof T, string>, parent: RowMapping<P, PK>, localKey?: Extract<keyof T, string>): this;
    matchColumn(columnName: string): string | undefined;
    resolveColumnName(propertyName: string): string;
    readKeyValue(ctx: RowContext): unknown;
    assignFields(target: Record<string, unknown>, ctx: RowContext): void;
    private normalizeColumnValue;
}
export { RowMapping as EntityMapping };
/**
 * Creates a new row mapping from the provided options.
 */
export declare function rowMapping<T, K extends Extract<keyof T, string> = Extract<keyof T, string>>(options: RowMappingOptions<T, K>): RowMapping<T, K>;
/**
 * @deprecated Use {@link rowMapping} instead.
 */
export declare function entity<T, K extends Extract<keyof T, string> = Extract<keyof T, string>>(options: RowMappingOptions<T, K>): RowMapping<T, K>;
/**
 * Builds a column map by prefixing each property with the provided prefix and
 * converting property names to snake_case.
 */
export declare function columnMapFromPrefix<K extends string>(prefix: string, properties: readonly K[]): Record<K, string>;
/**
 * Executes SQL via the provided executor and maps the rows using the supplied mapping.
 */
export declare class Mapper {
    private readonly executor;
    private readonly defaults;
    constructor(executor: QueryExecutor, defaults?: MapperOptions | undefined);
    query<T>(sql: string, params: QueryParams, mapping: RowMapping<T>): Promise<T[]>;
    query<T>(sql: string, params?: QueryParams, options?: MapperOptions): Promise<T[]>;
    queryOne<T>(sql: string, params: QueryParams, mapping: RowMapping<T>): Promise<T | undefined>;
    queryOne<T>(sql: string, params?: QueryParams, options?: MapperOptions): Promise<T | undefined>;
}
/**
 * This package maps rows and does not manage DB drivers.
 * Inject a query executor rather than wiring connections inside the mapper.
 */
export declare function createMapper(executor: QueryExecutor, defaults?: MapperOptions): Mapper;
/**
 * Creates a mapper using the supplied executor and user defaults.
 * This helper is the recommended entry point when wiring an executor because
 * it clearly signals where defaults are configured.
 */
export declare function createMapperFromExecutor(executor: QueryExecutor, defaults?: MapperOptions): Mapper;
/**
 * Normalizes an executor returning `{ rows }` so it can be consumed by the mapper.
 */
export declare function toRowsExecutor(executorOrTarget: ((sql: string, params: QueryParams) => Promise<{
    rows: Row[];
} | {
    rows: Row[];
    rowCount?: number;
} | Row[]>) | {
    [key: string]: (...args: unknown[]) => Promise<unknown>;
}, methodName?: string): QueryExecutor;
/**
 * Maps a pre-fetched row array into typed objects defined by a row mapping.
 * Row values remain `unknown`, and the mapper only applies the general-purpose
 * coercion rules declared in `coerceColumnValue`.
 */
export declare function mapRows<T>(rows: Row[], mapping: RowMapping<T>): T[];
/**
 * Maps pre-fetched rows into typed DTOs using the simple map preset, honoring key transforms, type hints, and optional coercion settings.
 *
 * @template T Target DTO shape.
 * @param rows Rows produced by the SQL executor.
 * @param options Optional overrides that control key normalization, coercion, and type hints.
 * @returns An array of `T` instances synthesized from `rows`.
 */
export declare function mapSimpleRows<T>(rows: Row[], options?: MapperOptions): T[];
