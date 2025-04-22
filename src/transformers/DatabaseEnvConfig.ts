// DatabaseEnvConfig.ts
// This interface defines DB-environment-level config, such as identifier escape and parameter symbol.
// Use this for settings that depend on the target RDBMS, not on formatting style.

export interface DatabaseEnvConfig {
    /**
     * Escape characters for SQL identifiers.
     */
    identifierEscape: {
        start: string;
        end: string;
    };
    /**
     * Symbol used for SQL parameters (e.g., ":" for PostgreSQL).
     */
    parameterSymbol: string;
}
