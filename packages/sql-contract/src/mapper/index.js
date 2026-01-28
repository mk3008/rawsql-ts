"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mapper = exports.EntityMapping = exports.RowMapping = exports.mapperPresets = void 0;
exports.rowMapping = rowMapping;
exports.entity = entity;
exports.columnMapFromPrefix = columnMapFromPrefix;
exports.createMapper = createMapper;
exports.createMapperFromExecutor = createMapperFromExecutor;
exports.toRowsExecutor = toRowsExecutor;
exports.mapRows = mapRows;
exports.mapSimpleRows = mapSimpleRows;
/**
 * Named presets for simple mapping that avoid implicit inference.
 */
exports.mapperPresets = {
    safe() {
        return {
            keyTransform: 'none',
            coerceDates: false,
        };
    },
    appLike() {
        return {
            keyTransform: 'snake_to_camel',
            coerceDates: true,
        };
    },
};
/**
 * Builds a row mapping that can be consumed by {@link Mapper#query} or {@link mapRows}.
 */
class RowMapping {
    constructor(options) {
        var _a, _b, _c;
        this.parents = [];
        this.name = options.name;
        this.key = options.key;
        this.prefix = (_a = options.prefix) !== null && _a !== void 0 ? _a : '';
        this.columnMap = {};
        this.overrideLookup = new Map();
        if (options.columnMap) {
            for (const [property, column] of Object.entries(options.columnMap)) {
                if (typeof column !== 'string') {
                    throw new Error(`RowMapping "${this.name}" columnMap["${property}"] must be a string.`);
                }
                this.columnMap[property] = column;
                this.overrideLookup.set(column.toLowerCase(), property);
            }
        }
        if (!this.prefix && this.overrideLookup.size === 0) {
            throw new Error(`RowMapping "${this.name}" must define either "prefix" or "columnMap".`);
        }
        this.prefixNormalized = this.prefix.toLowerCase();
        this.prefixLength = this.prefixNormalized.length;
        this.shouldCoerce = (_b = options.coerce) !== null && _b !== void 0 ? _b : true;
        this.coerceFn = (_c = options.coerceFn) !== null && _c !== void 0 ? _c : coerceColumnValue;
    }
    /**
     * Registers a parent relationship that will be attached after the current row is mapped.
     */
    belongsTo(propertyName, parent, localKey, options) {
        var _a;
        const optional = (_a = options === null || options === void 0 ? void 0 : options.optional) !== null && _a !== void 0 ? _a : false;
        this.parents.push({
            propertyName: String(propertyName),
            parent,
            localKey,
            optional,
        });
        return this;
    }
    /**
     * Registers a parent relationship with an explicit local key.
     */
    belongsToWithLocalKey(propertyName, parent, localKey) {
        return this.belongsTo(propertyName, parent, localKey);
    }
    /**
     * Registers an optional parent relationship with an explicit local key.
     */
    belongsToOptional(propertyName, parent, localKey) {
        if (localKey == null) {
            throw new Error(`localKey is required when declaring optional relation "${String(propertyName)}" on "${this.name}"`);
        }
        return this.belongsTo(propertyName, parent, localKey, { optional: true });
    }
    matchColumn(columnName) {
        const normalized = columnName.toLowerCase();
        const override = this.overrideLookup.get(normalized);
        if (override) {
            return override;
        }
        if (!this.prefixNormalized) {
            // When no prefix is provided we rely on explicit column overrides.
            return undefined;
        }
        if (!normalized.startsWith(this.prefixNormalized)) {
            return undefined;
        }
        // prefix is expected to include trailing '_' (e.g. 'item_') so remainder begins with the column part.
        // Prefix matching is case-insensitive and purely string-based.
        // If the prefix lacks '_', remainder may begin mid-token; prefer "item_" style prefixes.
        const remainder = normalized.slice(this.prefixLength);
        return remainder ? toCamelCase(remainder) : undefined;
    }
    resolveColumnName(propertyName) {
        if (this.columnMap[propertyName]) {
            return this.columnMap[propertyName];
        }
        if (!this.prefix) {
            return propertyName;
        }
        if (propertyName.toLowerCase().startsWith(this.prefixNormalized)) {
            return propertyName;
        }
        return `${this.prefix}${toSnakeCase(propertyName)}`;
    }
    readKeyValue(ctx) {
        const column = this.resolveColumnName(this.key);
        return getRowValue(ctx, column);
    }
    assignFields(target, ctx) {
        for (const column of Object.keys(ctx.row)) {
            const propertyName = this.matchColumn(column);
            if (!propertyName) {
                continue;
            }
            target[propertyName] = this.normalizeColumnValue(ctx.row[column]);
        }
    }
    normalizeColumnValue(value) {
        if (!this.shouldCoerce) {
            return value;
        }
        return this.coerceFn(value);
    }
}
exports.RowMapping = RowMapping;
exports.EntityMapping = RowMapping;
/**
 * Creates a new row mapping from the provided options.
 */
function rowMapping(options) {
    return new RowMapping(options);
}
/**
 * @deprecated Use {@link rowMapping} instead.
 */
function entity(options) {
    return rowMapping(options);
}
/**
 * Builds a column map by prefixing each property with the provided prefix and
 * converting property names to snake_case.
 */
function columnMapFromPrefix(prefix, properties) {
    const columnMap = {};
    for (const property of properties) {
        columnMap[property] = `${prefix}${toSnakeCase(String(property))}`;
    }
    return columnMap;
}
/**
 * Executes SQL via the provided executor and maps the rows using the supplied mapping.
 */
class Mapper {
    constructor(executor, defaults = undefined) {
        this.executor = executor;
        this.defaults = defaults;
    }
    async query(sql, params = [], mappingOrOptions) {
        const rows = await this.executor(sql, params);
        if (mappingOrOptions instanceof RowMapping) {
            return mapRows(rows, mappingOrOptions);
        }
        return mapSimpleRows(rows, mergeMapperOptions(this.defaults, mappingOrOptions));
    }
    async queryOne(sql, params = [], mappingOrOptions) {
        // Narrow mappingOrOptions before invoking the overload so the compiler can
        // select the expected signature.
        if (mappingOrOptions instanceof RowMapping) {
            const rows = await this.query(sql, params, mappingOrOptions);
            return rows[0];
        }
        const rows = await this.query(sql, params, mappingOrOptions);
        return rows[0];
    }
    /**
     * Binds a structured row mapping to a reader that exposes `list` and `one`.
     */
    bind(mapping) {
        return {
            list: async (sql, params = []) => this.query(sql, params, mapping),
            one: async (sql, params = []) => {
                const rows = await this.query(sql, params, mapping);
                return expectExactlyOneRow(rows);
            },
        };
    }
}
exports.Mapper = Mapper;
/**
 * This package maps rows and does not manage DB drivers.
 * Inject a query executor rather than wiring connections inside the mapper.
 */
function createMapper(executor, defaults) {
    return new Mapper(executor, defaults);
}
/**
 * Creates a mapper using the supplied executor and user defaults.
 * This helper is the recommended entry point when wiring an executor because
 * it clearly signals where defaults are configured.
 */
function createMapperFromExecutor(executor, defaults) {
    return createMapper(executor, defaults);
}
/**
 * Normalizes an executor returning `{ rows }` so it can be consumed by the mapper.
 */
function toRowsExecutor(executorOrTarget, methodName) {
    if (typeof executorOrTarget === 'function') {
        return async (sql, params) => {
            const result = await executorOrTarget(sql, params);
            if (Array.isArray(result)) {
                return result;
            }
            if ('rows' in result) {
                return result.rows;
            }
            return [];
        };
    }
    const executor = async (sql, params) => {
        if (!methodName) {
            throw new Error('Method name is required when passing an object/key pair');
        }
        const method = executorOrTarget[methodName];
        if (typeof method !== 'function') {
            throw new Error(`Method "${methodName}" not found on target`);
        }
        const result = await method.call(executorOrTarget, sql, params);
        if (Array.isArray(result)) {
            return result;
        }
        if (result && typeof result === 'object' && 'rows' in result) {
            return result.rows;
        }
        return [];
    };
    return executor;
}
/**
 * Maps a pre-fetched row array into typed objects defined by a row mapping.
 * Row values remain `unknown`, and the mapper only applies the general-purpose
 * coercion rules declared in `coerceColumnValue`.
 */
function mapRows(rows, mapping) {
    const cache = new Map();
    const roots = new Map();
    // Deduplicate root entities by key so joined rows map back to the same object.
    for (const row of rows) {
        const ctx = createRowContext(row);
        const keyValue = mapping.readKeyValue(ctx);
        if (keyValue === undefined || keyValue === null) {
            throw new Error(`Missing key column for root mapping "${mapping.name}" in row ${JSON.stringify(row)}`);
        }
        const keyString = stringifyKey(keyValue);
        const entity = buildEntity(ctx, mapping, cache, new Set(), [], undefined);
        // Always hydrate parents per row; cache reuses existing entity references.
        if (!roots.has(keyString)) {
            roots.set(keyString, entity);
        }
    }
    return Array.from(roots.values());
}
function expectExactlyOneRow(rows) {
    if (rows.length === 0) {
        throw new Error('expected exactly one row but received none.');
    }
    if (rows.length > 1) {
        throw new Error(`expected exactly one row but received ${rows.length}.`);
    }
    return rows[0];
}
const builtinMapperOptions = {
    keyTransform: 'snake_to_camel',
    idKeysAsString: true,
};
function mergeTypeHints(defaults, overrides) {
    if (!defaults && !overrides) {
        return undefined;
    }
    return {
        ...(defaults !== null && defaults !== void 0 ? defaults : {}),
        ...(overrides !== null && overrides !== void 0 ? overrides : {}),
    };
}
function mergeMapperOptions(defaults, overrides) {
    var _a, _b, _c, _d, _e, _f;
    const keyTransform = (_b = (_a = overrides === null || overrides === void 0 ? void 0 : overrides.keyTransform) !== null && _a !== void 0 ? _a : defaults === null || defaults === void 0 ? void 0 : defaults.keyTransform) !== null && _b !== void 0 ? _b : builtinMapperOptions.keyTransform;
    const coerceDates = (_c = overrides === null || overrides === void 0 ? void 0 : overrides.coerceDates) !== null && _c !== void 0 ? _c : defaults === null || defaults === void 0 ? void 0 : defaults.coerceDates;
    const coerceFn = (_d = overrides === null || overrides === void 0 ? void 0 : overrides.coerceFn) !== null && _d !== void 0 ? _d : defaults === null || defaults === void 0 ? void 0 : defaults.coerceFn;
    const typeHints = mergeTypeHints(defaults === null || defaults === void 0 ? void 0 : defaults.typeHints, overrides === null || overrides === void 0 ? void 0 : overrides.typeHints);
    const idKeysAsString = (_f = (_e = overrides === null || overrides === void 0 ? void 0 : overrides.idKeysAsString) !== null && _e !== void 0 ? _e : defaults === null || defaults === void 0 ? void 0 : defaults.idKeysAsString) !== null && _f !== void 0 ? _f : builtinMapperOptions.idKeysAsString;
    return {
        keyTransform,
        coerceDates,
        coerceFn,
        typeHints,
        idKeysAsString,
    };
}
function createKeyTransformFn(transform) {
    if (!transform || transform === 'snake_to_camel') {
        return snakeToCamel;
    }
    if (transform === 'none') {
        return (column) => column;
    }
    if (typeof transform === 'function') {
        return transform;
    }
    return snakeToCamel;
}
/**
 * Maps pre-fetched rows into typed DTOs using the simple map preset, honoring key transforms, type hints, and optional coercion settings.
 *
 * @template T Target DTO shape.
 * @param rows Rows produced by the SQL executor.
 * @param options Optional overrides that control key normalization, coercion, and type hints.
 * @returns An array of `T` instances synthesized from `rows`.
 */
function mapSimpleRows(rows, options) {
    var _a, _b, _c;
    const coerceFn = options === null || options === void 0 ? void 0 : options.coerceFn;
    const keyTransform = (_a = options === null || options === void 0 ? void 0 : options.keyTransform) !== null && _a !== void 0 ? _a : builtinMapperOptions.keyTransform;
    const keyTransformFn = createKeyTransformFn(keyTransform);
    const shouldCoerceDates = (_b = options === null || options === void 0 ? void 0 : options.coerceDates) !== null && _b !== void 0 ? _b : false;
    const typeHints = options === null || options === void 0 ? void 0 : options.typeHints;
    const idKeysAsString = (_c = options === null || options === void 0 ? void 0 : options.idKeysAsString) !== null && _c !== void 0 ? _c : builtinMapperOptions.idKeysAsString;
    return rows.map((row) => {
        var _a;
        const dto = {};
        const seen = new Map();
        // Map each column to a camelCase key while detecting naming collisions.
        for (const [column, rawValue] of Object.entries(row)) {
            const propertyName = keyTransformFn(column);
            if (!propertyName) {
                continue;
            }
            const existing = seen.get(propertyName);
            if (existing && existing !== column) {
                throw new Error(`Column "${column}" conflicts with "${existing}" after camelCase normalization ("${propertyName}").`);
            }
            seen.set(propertyName, column);
            const columnHint = typeHints === null || typeHints === void 0 ? void 0 : typeHints[propertyName];
            let normalizedValue = rawValue;
            if (columnHint) {
                normalizedValue = applyTypeHint(normalizedValue, columnHint, propertyName);
            }
            else if (shouldCoerceDates && typeof normalizedValue === 'string') {
                normalizedValue = coerceDateValue(normalizedValue);
            }
            if (!columnHint && idKeysAsString && isIdentifierProperty(propertyName)) {
                normalizedValue = stringifyIdentifierValue(normalizedValue);
            }
            dto[propertyName] =
                (_a = coerceFn === null || coerceFn === void 0 ? void 0 : coerceFn({
                    key: propertyName,
                    sourceKey: column,
                    value: normalizedValue,
                })) !== null && _a !== void 0 ? _a : normalizedValue;
        }
        return dto;
    });
}
/**
 * Date coercion helper that mirrors the ISO-with-timezone restriction used by the
 * structured mapper. Only strings already matching the ISO 8601 timestamp-with-offset
 * pattern are converted to Date.
 */
function coerceDateValue(value) {
    const trimmed = value.trim();
    let normalized = trimmed.includes(' ')
        ? trimmed.replace(' ', 'T')
        : trimmed;
    if (/[+-]\d{2}$/.test(normalized)) {
        normalized = `${normalized}:00`;
    }
    if (isoDateTimeRegex.test(normalized)) {
        const parsed = Date.parse(normalized);
        if (!Number.isNaN(parsed)) {
            return new Date(parsed);
        }
    }
    return value;
}
function applyTypeHint(value, hint, propertyName) {
    if (value === undefined || value === null) {
        return value;
    }
    switch (hint) {
        case 'string':
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'number' || typeof value === 'bigint') {
                return String(value);
            }
            return value;
        case 'number':
            if (typeof value === 'number') {
                return value;
            }
            if (typeof value === 'string') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
            return value;
        case 'boolean':
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (normalized === 'true') {
                    return true;
                }
                if (normalized === 'false') {
                    return false;
                }
            }
            return value;
        case 'date':
            if (value instanceof Date) {
                return value;
            }
            if (typeof value === 'string') {
                const coerced = coerceDateValue(value);
                if (coerced instanceof Date) {
                    return coerced;
                }
            }
            return value;
        case 'bigint':
            if (typeof value === 'bigint') {
                return value;
            }
            if (typeof value === 'number') {
                return BigInt(value);
            }
            if (typeof value === 'string') {
                try {
                    return BigInt(value);
                }
                catch {
                    throw new Error(`Type hint 'bigint' failed for "${propertyName !== null && propertyName !== void 0 ? propertyName : 'value'}": "${value}" is not a valid bigint.`);
                }
            }
            return value;
    }
}
function isIdentifierProperty(propertyName) {
    if (propertyName === 'id') {
        return true;
    }
    if (!propertyName.endsWith('Id')) {
        return false;
    }
    const firstChar = propertyName.charAt(0);
    if (firstChar !== firstChar.toLowerCase()) {
        return false;
    }
    // Only treat camelCase names ending in 'Id' (uppercase I, lowercase d) as identifiers.
    return true;
}
function stringifyIdentifierValue(value) {
    if (value === undefined || value === null) {
        return value;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }
    return value;
}
function buildEntity(ctx, mapping, cache, visited, stack, relation) {
    const { entity, isNew, keyString } = getOrCreateEntity(ctx, mapping, cache);
    const visitKey = `${mapping.name}:${keyString}`;
    const currentFrame = {
        entity: mapping.name,
        relation,
        key: keyString,
    };
    if (visited.has(visitKey)) {
        const cyclePath = [...stack, currentFrame]
            .map((frame) => formatFrame(frame))
            .join(' -> ');
        throw new Error(`Circular row mapping detected: ${cyclePath}`);
    }
    visited.add(visitKey);
    stack.push(currentFrame);
    try {
        if (isNew) {
            mapping.assignFields(entity, ctx);
        }
        hydrateParents(entity, ctx, mapping, cache, visited, stack);
        return entity;
    }
    finally {
        visited.delete(visitKey);
        stack.pop();
    }
}
function getOrCreateEntity(ctx, mapping, cache) {
    const keyValue = mapping.readKeyValue(ctx);
    if (keyValue === undefined || keyValue === null) {
        throw new Error(`Missing key column for mapping "${mapping.name}" during recursion.`);
    }
    let keyString;
    try {
        keyString = stringifyKey(keyValue);
    }
    catch (error) {
        const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
        throw new Error(`Row mapping "${mapping.name}" key must be JSON-serializable${detail}.`);
    }
    let entitySet = cache.get(mapping);
    if (!entitySet) {
        entitySet = new Map();
        cache.set(mapping, entitySet);
    }
    const existing = entitySet.get(keyString);
    if (existing) {
        return { entity: existing, isNew: false, keyString };
    }
    const newEntity = {};
    entitySet.set(keyString, newEntity);
    return { entity: newEntity, isNew: true, keyString };
}
function hydrateParents(entity, ctx, mapping, cache, visited, stack) {
    for (const parent of mapping.parents) {
        const localColumn = mapping.resolveColumnName(parent.localKey);
        const normalizedLocalColumn = localColumn.toLowerCase();
        if (!ctx.normalizedColumns.has(normalizedLocalColumn)) {
            missingLocalKey(mapping.name, parent.propertyName, localColumn, parent.parent.name);
        }
        const localKeyValue = getRowValue(ctx, localColumn);
        if (localKeyValue === undefined || localKeyValue === null) {
            if (parent.optional) {
                continue;
            }
            localKeyIsNull(mapping.name, parent.propertyName, localColumn, parent.parent.name);
        }
        const parentKeyColumn = parent.parent.resolveColumnName(parent.parent.key);
        const normalizedParentKeyColumn = parentKeyColumn.toLowerCase();
        if (!ctx.normalizedColumns.has(normalizedParentKeyColumn)) {
            missingParentKeyColumn(mapping.name, parent.propertyName, parent.parent.name, parentKeyColumn);
        }
        const parentKeyValue = getRowValue(ctx, parentKeyColumn);
        if (parentKeyValue === undefined || parentKeyValue === null) {
            if (parent.optional) {
                continue;
            }
            throw new Error(`Missing key column "${parentKeyColumn}" for parent mapping "${parent.parent.name}"`);
        }
        const parentEntity = buildEntity(ctx, parent.parent, cache, visited, stack, parent.propertyName);
        entity[parent.propertyName] = parentEntity;
    }
}
function createRowContext(row) {
    const normalized = new Map();
    for (const column of Object.keys(row)) {
        normalized.set(column.toLowerCase(), column);
    }
    return { row, normalizedColumns: normalized };
}
function getRowValue(ctx, columnName) {
    const actual = ctx.normalizedColumns.get(columnName.toLowerCase());
    if (!actual) {
        return undefined;
    }
    return ctx.row[actual];
}
function coerceColumnValue(value) {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return value;
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === 'false') {
        return lower === 'true';
    }
    // Mapper should stay DBMS-agnostic; Date coercion is intentionally limited to ISO 8601 datetime strings that include a timezone designator.
    const isIsoDateTime = isoDateTimeRegex.test(trimmed);
    if (isIsoDateTime) {
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) {
            return new Date(parsed);
        }
    }
    return value;
}
const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
function stringifyKey(value) {
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value);
        }
        catch {
            throw new Error('Row mapping key must be JSON-serializable.');
        }
    }
    return String(value);
}
function missingLocalKey(mappingName, propertyName, localColumn, parentName) {
    throw new Error(`Missing local key column "${localColumn}" for relation "${propertyName}" on ${mappingName} (parent ${parentName})`);
}
function missingParentKeyColumn(mappingName, propertyName, parentName, parentKeyColumn) {
    throw new Error(`Missing key column "${parentKeyColumn}" for parent "${parentName}" relation "${propertyName}" on ${mappingName}`);
}
function localKeyIsNull(mappingName, propertyName, localColumn, parentName) {
    throw new Error(`Local key column "${localColumn}" is null for relation "${propertyName}" on ${mappingName} (parent ${parentName})`);
}
function formatFrame(frame) {
    const relationSuffix = frame.relation ? `.${frame.relation}` : '';
    return `${frame.entity}${relationSuffix}(${frame.key})`;
}
function snakeToCamel(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.includes('_')) {
        return toCamelCase(trimmed);
    }
    if (trimmed === trimmed.toUpperCase()) {
        return trimmed.toLowerCase();
    }
    return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}
function toCamelCase(value) {
    return value
        .split('_')
        .filter(Boolean)
        .map((segment, index) => index === 0
        ? segment.toLowerCase()
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`)
        .join('');
}
function toSnakeCase(value) {
    return value
        .replace(/([A-Z])/g, '_$1')
        .replace(/__+/g, '_')
        .toLowerCase()
        .replace(/^_+/, '');
}
//# sourceMappingURL=index.js.map