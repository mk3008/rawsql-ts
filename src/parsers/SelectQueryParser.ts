import { Lexeme } from "../models/Lexeme";
import { SelectQuery } from "../models/SelectQuery";
import { SelectClauseParser } from "./SelectClauseParser";
import { FromClauseParser } from "./FromClauseParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { GroupByClauseParser } from "./GroupByParser";
import { HavingClauseParser } from "./HavingParser";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { WindowClauseParser } from "./WindowClauseParser";
import { LimitClauseParser } from "./LimitClauseParser";
import { ForClauseParser } from "./ForClauseParser";
import { SqlTokenizer } from "./SqlTokenizer";

export class SelectQueryParser {
    public static parseFromText(query: string): SelectQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT query is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: SelectQuery; newIndex: number } {
        let idx = index;

        // Parse SELECT clause (required)
        if (idx >= lexemes.length || lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${idx < lexemes.length ? lexemes[idx].value : 'end of input'}". SELECT queries must start with the SELECT keyword.`);
        }

        const selectClauseResult = SelectClauseParser.parse(lexemes, idx);
        idx = selectClauseResult.newIndex;

        // Parse FROM clause (optional)
        let fromClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'from') {
            fromClauseResult = FromClauseParser.parse(lexemes, idx);
            idx = fromClauseResult.newIndex;
        }

        // Parse WHERE clause (optional)
        let whereClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'where') {
            whereClauseResult = WhereClauseParser.parse(lexemes, idx);
            idx = whereClauseResult.newIndex;
        }

        // Parse GROUP BY clause (optional)
        let groupByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'group by') {
            groupByClauseResult = GroupByClauseParser.parse(lexemes, idx);
            idx = groupByClauseResult.newIndex;
        }

        // Parse HAVING clause (optional)
        let havingClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'having') {
            havingClauseResult = HavingClauseParser.parse(lexemes, idx);
            idx = havingClauseResult.newIndex;
        }

        // Parse WINDOW clause (optional)
        let windowFrameClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'window') {
            windowFrameClauseResult = WindowClauseParser.parse(lexemes, idx);
            idx = windowFrameClauseResult.newIndex;
        }

        // Parse ORDER BY clause (optional)
        let orderByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'order by') {
            orderByClauseResult = OrderByClauseParser.parse(lexemes, idx);
            idx = orderByClauseResult.newIndex;
        }

        // Parse LIMIT clause (optional)
        let limitClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'limit') {
            limitClauseResult = LimitClauseParser.parse(lexemes, idx);
            idx = limitClauseResult.newIndex;
        }

        // Parse FOR clause (optional)
        let forClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value === 'for') {
            forClauseResult = ForClauseParser.parse(lexemes, idx);
            idx = forClauseResult.newIndex;
        }

        // Create and return the SelectQuery object
        // WithClauseは無視するようにnullを設定
        const selectQuery = new SelectQuery(
            null, // WithClause
            selectClauseResult.value,
            fromClauseResult ? fromClauseResult.value : null,
            whereClauseResult ? whereClauseResult.value : null,
            groupByClauseResult ? groupByClauseResult.value : null,
            havingClauseResult ? havingClauseResult.value : null,
            orderByClauseResult ? orderByClauseResult.value : null,
            windowFrameClauseResult ? windowFrameClauseResult.value : null, // WindowFrameClauseを追加
            limitClauseResult ? limitClauseResult.value : null,
            forClauseResult ? forClauseResult.value : null
        );

        return { value: selectQuery, newIndex: idx };
    }
}