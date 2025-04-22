// FormatterConfig.ts
// This interface defines configuration options for SQL formatting.
// It is designed to be reusable and published as an npm package.

export interface FormatterConfig {
    /**
     * Indentation type: "space" or "tab". Default is "space".
     */
    indentType?: "space" | "tab";
    /**
     * Indentation size (number of spaces or tabs). Default is 4.
     */
    indentSize?: number;
    /**
     * If true, output is a single line. If false, output is pretty-printed. Default is true.
     */
    oneLiner?: boolean;
    /**
     * Comma position: "before" (leading comma) or "after" (trailing comma). Default is "before".
     */
    commaPosition?: "before" | "after";
    /**
     * Indentation options for each SQL clause.
     */
    clauseIndent?: {
        select?: boolean;
        from?: boolean;
        where?: boolean;
        groupBy?: boolean;
        having?: boolean;
        orderBy?: boolean;
        window?: boolean;
        with?: boolean;
        values?: boolean;
    };
    /**
     * If true, every AND operator in a binary expression will be printed on a new line with indentation. Default is false.
     */
    andNewline?: boolean;
    /**
     * Keyword case for SQL reserved words: "lower" or "upper". Default is "lower".
     */
    keywordCase?: "lower" | "upper";
}
