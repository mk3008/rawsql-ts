import { Distinct, DistinctComponent, DistinctOn, SelectClause, SelectItem } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, BinaryExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";
import { HintClause } from "../models/HintClause";

export class SelectClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SelectClause; newIndex: number } {
        let idx = index;
        let distinct: DistinctComponent | null = null;

        // Capture comments from the SELECT token
        const selectTokenComments = idx < lexemes.length ? lexemes[idx].comments : null;

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${lexemes[idx].value}". SELECT clauses must start with the SELECT keyword.`);
        }
        idx++;

        // Parse hint clauses (/*+ hint */) after SELECT
        const hints: HintClause[] = [];
        while (idx < lexemes.length && HintClause.isHintClause(lexemes[idx].value)) {
            const hintContent = HintClause.extractHintContent(lexemes[idx].value);
            hints.push(new HintClause(hintContent));
            idx++;
        }

        if (idx < lexemes.length && lexemes[idx].value === 'distinct') {
            idx++;
            distinct = new Distinct();
        } else if (idx < lexemes.length && lexemes[idx].value === 'distinct on') {
            idx++;
            const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            distinct = new DistinctOn(argument.value);
            idx = argument.newIndex;
        }

        const items: SelectItem[] = [];
        const item = SelectItemParser.parseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const item = SelectItemParser.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`Syntax error at position ${index}: No select items found. The SELECT clause requires at least one expression to select.`);
        } else {
            const clause = new SelectClause(items, distinct, hints);
            return { value: clause, newIndex: idx };
        }
    }

}

// Extracted SelectItemParser for parsing individual select items
export class SelectItemParser {
    /**
     * Parses a single select item from a SQL string.
     * @param query The SQL string representing a select item (e.g. 'id as user_id').
     * @returns The parsed SelectItem instance.
     */
    public static parse(query: string): SelectItem {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseItem(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The select item is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parses a single select item from lexemes.
     * @param lexemes The array of lexemes.
     * @param index The starting index.
     * @returns An object containing the SelectItem and the new index.
     */
    public static parseItem(lexemes: Lexeme[], index: number): { value: SelectItem; newIndex: number } {
        let idx = index;
        
        // Extract positioned comments from the value token directly
        const valueTokenComments = this.extractValueTokenComments(lexemes, idx);
        
        const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        // Parse optional AS keyword and extract comments directly
        const { asComments, newIndex: asIndex } = this.parseAsKeyword(lexemes, idx);
        idx = asIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
            const alias = lexemes[idx].value;
            const aliasComments = lexemes[idx].comments; // Capture comments from alias token
            const aliasPositionedComments = lexemes[idx].positionedComments; // Capture positioned comments from alias token
            idx++;
            const selectItem = new SelectItem(value, alias);
            
            // Apply all comments directly to selectItem (no collection then assignment)
            this.applyValueTokenComments(selectItem, valueTokenComments);
            this.applyAsKeywordComments(selectItem, asComments);
            this.applyAliasComments(selectItem, aliasComments, aliasPositionedComments);
            
            return {
                value: selectItem,
                newIndex: idx,
            };
        } else if (value instanceof ColumnReference && value.column.name !== "*") {
            // nameless select item
            const selectItem = new SelectItem(value, value.column.name);
            
            // Apply value token and AS keyword comments directly
            this.applyValueTokenComments(selectItem, valueTokenComments);
            this.applyAsKeywordComments(selectItem, asComments);
            return {
                value: selectItem,
                newIndex: idx,
            };
        }
        // nameless select item
        const selectItem = new SelectItem(value);
        
        // Apply comments directly
        this.applyValueTokenComments(selectItem, valueTokenComments);
        this.applyAsKeywordComments(selectItem, asComments);
        return {
            value: selectItem,
            newIndex: idx,
        };
    }

    /**
     * Recursively clear positioned comments from all nested components to prevent duplication
     */
    private static clearPositionedCommentsRecursively(component: any): void {
        if (!component || typeof component !== 'object') {
            return;
        }

        // Clear positioned comments from this component
        if ('positionedComments' in component) {
            component.positionedComments = null;
        }

        // Recursively clear from common nested properties
        if (component.left) {
            this.clearPositionedCommentsRecursively(component.left);
        }
        if (component.right) {
            this.clearPositionedCommentsRecursively(component.right);
        }
        if (component.qualifiedName) {
            this.clearPositionedCommentsRecursively(component.qualifiedName);
        }
        if (component.table) {
            this.clearPositionedCommentsRecursively(component.table);
        }
        if (component.name) {
            this.clearPositionedCommentsRecursively(component.name);
        }
        if (component.args && Array.isArray(component.args)) {
            component.args.forEach((arg: any) => {
                this.clearPositionedCommentsRecursively(arg);
            });
        }
        if (component.value) {
            this.clearPositionedCommentsRecursively(component.value);
        }
    }

    // Extract positioned comments from value token (no collection arrays)
    private static extractValueTokenComments(lexemes: Lexeme[], index: number): { positioned: any; legacy: string[] | null } {
        if (index >= lexemes.length) {
            return { positioned: null, legacy: null };
        }

        const token = lexemes[index];
        return {
            positioned: token.positionedComments && token.positionedComments.length > 0 ? token.positionedComments : null,
            legacy: null // Value token legacy comments are not typically used
        };
    }

    // Parse AS keyword and extract its comments directly
    private static parseAsKeyword(lexemes: Lexeme[], index: number): { asComments: any; newIndex: number } {
        if (index >= lexemes.length || lexemes[index].value !== 'as') {
            return { asComments: { positioned: null, legacy: null }, newIndex: index };
        }

        const asToken = lexemes[index];
        const asComments = {
            positioned: asToken.positionedComments && asToken.positionedComments.length > 0 ? asToken.positionedComments : null,
            legacy: asToken.comments && asToken.comments.length > 0 ? asToken.comments : null
        };

        return { asComments, newIndex: index + 1 };
    }

    // Apply value token comments directly to selectItem
    private static applyValueTokenComments(selectItem: SelectItem, valueTokenComments: any): void {
        if (valueTokenComments.positioned) {
            for (const posComment of valueTokenComments.positioned) {
                selectItem.addPositionedComments(posComment.position, posComment.comments);
            }
            this.clearValueTokenComments(selectItem);
        }
    }

    // Apply AS keyword comments directly to selectItem
    private static applyAsKeywordComments(selectItem: SelectItem, asComments: any): void {
        if (asComments.positioned) {
            (selectItem as any).asKeywordPositionedComments = asComments.positioned;
        } else if (asComments.legacy) {
            (selectItem as any).asKeywordComments = asComments.legacy;
        }
    }

    // Apply alias comments directly to selectItem
    private static applyAliasComments(selectItem: SelectItem, aliasComments: string[] | null, aliasPositionedComments: any): void {
        if (aliasPositionedComments && aliasPositionedComments.length > 0) {
            (selectItem as any).aliasPositionedComments = aliasPositionedComments;
        } else if (aliasComments && aliasComments.length > 0) {
            (selectItem as any).aliasComments = aliasComments;
        }
    }

    // Clear positioned comments from value to avoid duplication
    private static clearValueTokenComments(selectItem: SelectItem): void {
        // Clear both positioned and legacy comments from the value to avoid duplication
        if ('positionedComments' in selectItem.value) {
            (selectItem.value as any).positionedComments = null;
        }

        // Also clear positioned comments from nested IdentifierString (in QualifiedName)
        if (selectItem.value instanceof ColumnReference) {
            const columnRef = selectItem.value as ColumnReference;
            if (columnRef.qualifiedName && columnRef.qualifiedName.name) {
                columnRef.qualifiedName.name.positionedComments = null;
            }
        }

        // Clear positioned comments from BinaryExpression children only to avoid duplication
        if (selectItem.value instanceof BinaryExpression) {
            this.clearPositionedCommentsRecursively(selectItem.value);
        }
    }
}
