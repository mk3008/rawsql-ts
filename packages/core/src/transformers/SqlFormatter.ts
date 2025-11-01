import { SqlPrintTokenParser, FormatterConfig, PRESETS, CastStyle, ConstraintStyle } from '../parsers/SqlPrintTokenParser';
import { SqlPrinter, CommaBreakStyle, AndBreakStyle, OrBreakStyle } from './SqlPrinter';
import { IndentCharOption, NewlineOption } from './LinePrinter'; // Import types for compatibility
import { IdentifierEscapeOption, resolveIdentifierEscapeOption } from './FormatOptionResolver';
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
 * Common formatting knobs shared by SqlFormatter and SqlPrinter.
 *
 * @example
 * ```typescript
 * const formatter = new SqlFormatter({ keywordCase: 'upper', indentSize: 4 });
 * const { formattedSql } = formatter.format(SelectQueryParser.parse('select * from users'));
 * ```
 * Related tests: packages/core/tests/transformers/SqlFormatter.case.test.ts
 * @public
 */
export interface BaseFormattingOptions {
    /** Number of spaces for indentation */
    indentSize?: number;
    /** Character to use for indentation (logical 'space'/'tab' or literal control character) */
    indentChar?: IndentCharOption;
    /** Newline character style (logical 'lf'/'crlf'/'cr' or literal newline string) */
    newline?: NewlineOption;
    /** Case transformation for SQL keywords */
    keywordCase?: 'none' | 'upper' | 'lower';
    /** Style for comma line breaks */
    commaBreak?: CommaBreakStyle;
    /** Style for comma line breaks inside WITH clause definitions */
    cteCommaBreak?: CommaBreakStyle;
    /** Style for comma line breaks inside VALUES clauses */
    valuesCommaBreak?: CommaBreakStyle;
    /** Style for AND line breaks */
    andBreak?: AndBreakStyle;
    /** Style for OR line breaks */
    orBreak?: OrBreakStyle;
    /** Whether to export comments in formatted output */
    exportComment?: boolean;
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
    /** Indent nested parentheses when boolean groups contain additional parentheses */
    indentNestedParentheses?: boolean;
    /** Keep INSERT column lists on one line regardless of comma break settings */
    insertColumnsOneLine?: boolean;
    /** Keep MERGE WHEN clause predicates on one line regardless of AND break settings */
    whenOneLine?: boolean;
}

/**
 * High level configuration accepted by SqlFormatter.
 *
 * @example
 * ```typescript
 * const formatter = new SqlFormatter({ preset: 'postgres', commentStyle: 'smart' });
 * const { formattedSql } = formatter.format(SelectQueryParser.parse('select * from users where active = true'));
 * ```
 * Related tests: packages/core/tests/transformers/CommentStyle.comprehensive.test.ts
 * @public
 */
export interface SqlFormatterOptions extends BaseFormattingOptions {
    /** Database preset for formatting style ('mysql', 'postgres', 'sqlserver', 'sqlite') */
    preset?: PresetName;
    /** Identifier escape style (logical name like 'quote' or explicit delimiters) */
    identifierEscape?: IdentifierEscapeOption;
    /** Parameter symbol configuration for SQL parameters */
    parameterSymbol?: string | { start: string; end: string };
    /** Style for parameter formatting */
    parameterStyle?: 'anonymous' | 'indexed' | 'named';
    /** Preferred CAST rendering style */
    castStyle?: CastStyle;
    /** Constraint rendering style (affects CREATE TABLE constraint layout) */
    constraintStyle?: ConstraintStyle;
}

/**
 * High level facade that parses a SqlComponent, applies formatting rules, and prints the final SQL text.
 *
 * @example
 * ```typescript
 * const formatter = new SqlFormatter({ keywordCase: 'lower', withClauseStyle: 'cte-oneline' });
 * const query = SelectQueryParser.parse('WITH cte AS (SELECT id FROM users) SELECT * FROM cte');
 * const { formattedSql } = formatter.format(query);
 * ```
 * Related tests: packages/core/tests/transformers/SqlFormatter.case.test.ts
 */
export class SqlFormatter {
    private parser: SqlPrintTokenParser;
    private printer: SqlPrinter;

    constructor(options: SqlFormatterOptions = {}) { // Default to 'sqlserver' if options is empty

        const presetConfig = options.preset ? PRESETS[options.preset] : undefined;

        if (options.preset && !presetConfig) {
            throw new Error(`Invalid preset: ${options.preset}`); // Throw error for invalid preset
        }

        // Normalize identifier escape names into actual delimiter pairs before configuring the parser.
        const resolvedIdentifierEscape = resolveIdentifierEscapeOption(options.identifierEscape ?? presetConfig?.identifierEscape);

        const parserOptions = {
            ...presetConfig, // Apply preset configuration
            identifierEscape: resolvedIdentifierEscape ?? presetConfig?.identifierEscape,
            parameterSymbol: options.parameterSymbol ?? presetConfig?.parameterSymbol,
            parameterStyle: options.parameterStyle ?? presetConfig?.parameterStyle,
            castStyle: options.castStyle ?? presetConfig?.castStyle,
        };

        const constraintStyle: ConstraintStyle =
            options.constraintStyle ??
            presetConfig?.constraintStyle ??
            'postgres';

        const parserConfig = {
            ...parserOptions,
            constraintStyle,
        };

        this.parser = new SqlPrintTokenParser({
            ...parserConfig,
        });
        this.printer = new SqlPrinter({
            ...options,
            parenthesesOneLine: options.parenthesesOneLine,
            betweenOneLine: options.betweenOneLine,
            valuesOneLine: options.valuesOneLine,
            joinOneLine: options.joinOneLine,
            caseOneLine: options.caseOneLine,
            subqueryOneLine: options.subqueryOneLine,
            indentNestedParentheses: options.indentNestedParentheses
        });
    }    
    
    /**
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


