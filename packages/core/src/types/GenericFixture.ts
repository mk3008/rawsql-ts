/** Column definition for generic, driver-agnostic fixtures. */
export interface GenericFixtureColumn {
    name: string;
    /** Optional database-specific type name (kept as a raw string). */
    typeName?: string;
    /** Whether the column should be treated as required when simulating writes. */
    required?: boolean;
    /** Default expression/value as string when available. */
    defaultValue?: string | null;
}

/** Generic fixture definition that can be adapted by driver layers. */
export interface GenericFixture {
    tableName: string;
    columns: GenericFixtureColumn[];
    /** Optional fixture rows; values are kept untyped to allow driver-specific coercion. */
    rows?: Record<string, unknown>[];
}
