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
 * CommentStyle determines how comments are formatted in the output.
 * - 'block': Keep original comment style (default)
 * - 'smart': Convert single-line to --, multi-line to block comments, optimize for comma break styles
 */
export type CommentStyle = 'block' | 'smart';

/**
 * Base formatting options shared between SqlFormatter and SqlPrinter
 * @public
 */
export interface BaseFormattingOptions {
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
    /** Comment formatting style */
    commentStyle?: CommentStyle;
    /** Formatting style for WITH clauses */
    withClauseStyle?: WithClauseStyle;
    /** Keep parentheses content on one line regardless of AND/OR break settings */
    parenthesesOneLine?: boolean;
    /** Keep BETWEEN expressions on one line regardless of AND break settings */
    betweenOneLine?: boolean;
    /** Keep VALUES clause on one line regardless of comma break settings */
    valuesOneLine?: boolean;
    /** Keep JOIN conditions on one line regardless of AND/OR break settings */
    joinOneLine?: boolean;
    /** Keep CASE expressions on one line regardless of formatting settings */
    caseOneLine?: boolean;
    /** Keep subqueries (inline queries) on one line regardless of formatting settings */
    subqueryOneLine?: boolean;
}

/**
 * Options for SqlFormatter configuration
 * @public
 */
export interface SqlFormatterOptions extends BaseFormattingOptions {
    /** Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite') */
    preset?: PresetName;
    /** Custom identifier escape characters (e.g., {start: '"', end: '"'} for PostgreSQL) */
    identifierEscape?: { start: string; end: string };
    /** Parameter symbol configuration for SQL parameters */
    parameterSymbol?: string | { start: string; end: string };
    /** Style for parameter formatting */
    parameterStyle?: 'anonymous' | 'indexed' | 'named';
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

        this.parser = new SqlPrintTokenParser({
            ...parserOptions,
            commentStyle: options.commentStyle
        });
        this.printer = new SqlPrinter({
            ...options,
            parenthesesOneLine: options.parenthesesOneLine,
            betweenOneLine: options.betweenOneLine,
            valuesOneLine: options.valuesOneLine,
            joinOneLine: options.joinOneLine,
            caseOneLine: options.caseOneLine,
            subqueryOneLine: options.subqueryOneLine
        });
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
