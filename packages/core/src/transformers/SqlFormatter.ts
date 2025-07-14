import { SqlPrintTokenParser, FormatterConfig, PRESETS } from '../parsers/SqlPrintTokenParser';
import { SqlPrinter, CommaBreakStyle, AndBreakStyle } from './SqlPrinter';
import { IndentCharOption, NewlineOption } from './LinePrinter'; // Import types for compatibility
import { SelectQuery } from '../models/SelectQuery';
import { SqlComponent } from '../models/SqlComponent';

// Define valid preset names as a union type
export const VALID_PRESETS = ['mysql', 'postgres', 'sqlserver', 'sqlite'] as const;
export type PresetName = (typeof VALID_PRESETS)[number];

/**
 * WithClauseStyle determines how WITH clauses are formatted.
 * - 'standard': Normal formatting with proper indentation
 * - 'cte-oneline': Individual CTEs are formatted as one-liners
 * - 'full-oneline': Entire WITH clause is formatted as one line
 */
export type WithClauseStyle = 'standard' | 'cte-oneline' | 'full-oneline';

/**
 * Options for SqlFormatter configuration
 * @public
 */
export interface SqlFormatterOptions {
    /** Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite') */
    preset?: PresetName;
    /** Custom identifier escape characters (e.g., {start: '"', end: '"'} for PostgreSQL) */
    identifierEscape?: { start: string; end: string };
    /** Parameter symbol configuration for SQL parameters */
    parameterSymbol?: string | { start: string; end: string };
    /** Style for parameter formatting */
    parameterStyle?: 'anonymous' | 'indexed' | 'named';
    /** Number of spaces for indentation */
    indentSize?: number;
    /** Character to use for indentation ('space' or 'tab') */
    indentChar?: IndentCharOption;
    /** Newline character style */
    newline?: NewlineOption;
    /** Case transformation for SQL keywords */
    keywordCase?: 'none' | 'upper' | 'lower';
    /** Style for comma line breaks */
    commaBreak?: CommaBreakStyle;
    /** Style for AND/OR line breaks */
    andBreak?: AndBreakStyle;
    /** Whether to export comments in formatted output */
    exportComment?: boolean;
    /** Whether to only export comments from clause-level keywords */
    strictCommentPlacement?: boolean;
    /** Formatting style for WITH clauses */
    withClauseStyle?: WithClauseStyle;
}

/**
 * SqlFormatter class combines parsing and printing of SQL queries into a single interface.
 */
export class SqlFormatter {
    private parser: SqlPrintTokenParser;
    private printer: SqlPrinter;

    constructor(options: SqlFormatterOptions = {}) { // Default to 'sqlserver' if options is empty

        const presetConfig = options.preset ? PRESETS[options.preset] : undefined;

        if (options.preset && !presetConfig) {
            throw new Error(`Invalid preset: ${options.preset}`); // Throw error for invalid preset
        }

        const parserOptions = {
            ...presetConfig, // Apply preset configuration
            identifierEscape: options.identifierEscape ?? presetConfig?.identifierEscape,
            parameterSymbol: options.parameterSymbol ?? presetConfig?.parameterSymbol,
            parameterStyle: options.parameterStyle ?? presetConfig?.parameterStyle,
        };

        this.parser = new SqlPrintTokenParser(parserOptions);
        this.printer = new SqlPrinter(options);
    }    /**
     * Formats a SQL query string with the given parameters.
     * @param sqlText The SQL query string to format.
     * @param parameters A dictionary of parameters to replace in the query.
     * @returns An object containing the formatted SQL string and the parameters.
     */
    format(sql: SqlComponent): { formattedSql: string; params: any[] | Record<string, any> } {
        const { token, params } = this.parser.parse(sql);
        const formattedSql = this.printer.print(token);

        return { formattedSql, params };
    }
}
