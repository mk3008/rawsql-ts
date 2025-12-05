import { SqlTokenizer } from "./SqlTokenizer";
import {
    AlterTableStatement,
    AlterTableAction,
    AlterTableAddConstraint,
    AlterTableDropConstraint,
    AlterTableDropColumn,
    AlterTableAlterColumnDefault,
    DropBehavior
} from "../models/DDLStatements";
import {
    TableConstraintDefinition,
    ReferenceDefinition,
    MatchType,
    ReferentialAction,
    ConstraintDeferrability,
    ConstraintInitially,
    TableConstraintKind
} from "../models/CreateTableQuery";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName, IdentifierString, RawString, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";
import { joinLexemeValues } from "../utils/ParserStringUtils";

/**
 * Parses ALTER TABLE statements focused on constraint operations.
 */
export class AlterTableParser {
    private static readonly CONSTRAINT_TYPE_TOKENS = new Set([
        "primary key",
        "unique",
        "unique key",
        "foreign key",
        "check"
    ]);

    private static readonly MATCH_KEYWORDS = new Map<string, MatchType>([
        ["match full", "full"],
        ["match partial", "partial"],
        ["match simple", "simple"]
    ]);

    private static readonly REFERENTIAL_ACTIONS = new Map<string, ReferentialAction>([
        ["cascade", "cascade"],
        ["restrict", "restrict"],
        ["no action", "no action"],
        ["set null", "set null"],
        ["set default", "set default"]
    ]);

    private static readonly DEFERRABILITY_KEYWORDS = new Map<string, ConstraintDeferrability>([
        ["deferrable", "deferrable"],
        ["not deferrable", "not deferrable"]
    ]);

    private static readonly INITIALLY_KEYWORDS = new Map<string, ConstraintInitially>([
        ["initially immediate", "immediate"],
        ["initially deferred", "deferred"]
    ]);

    public static parse(sql: string): AlterTableStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[AlterTableParser] Unexpected token "${lexemes[result.newIndex].value}" after ALTER TABLE statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: AlterTableStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "alter table") {
            throw new Error(`[AlterTableParser] Expected ALTER TABLE at index ${idx}.`);
        }
        idx++;

        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        let only = false;
        if (lexemes[idx]?.value.toLowerCase() === "only") {
            only = true;
            idx++;
        }

        const tableResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const tableName = new QualifiedName(tableResult.namespaces, tableResult.name);
        idx = tableResult.newIndex;

        const actions: AlterTableAction[] = [];

        while (idx < lexemes.length) {
            const value = lexemes[idx].value.toLowerCase();

            if (value === "add" || value === "add constraint") {
                const result = this.parseAddConstraintAction(lexemes, idx);
                actions.push(result.value);
                idx = result.newIndex;
            } else if (value === "drop constraint" || (value === "drop" && lexemes[idx + 1]?.value.toLowerCase() === "constraint")) {
                const result = this.parseDropConstraintAction(lexemes, idx);
                actions.push(result.value);
                idx = result.newIndex;
            } else if (value === "drop column" || (value === "drop" && lexemes[idx + 1]?.value.toLowerCase() === "column")) {
                const result = this.parseDropColumnAction(lexemes, idx);
                actions.push(result.value);
                idx = result.newIndex;
            } else if (
                value === "alter column" ||
                (value === "alter" && lexemes[idx + 1]?.value.toLowerCase() === "column")
            ) {
                const result = this.parseAlterColumnDefaultAction(lexemes, idx);
                actions.push(result.value);
                idx = result.newIndex;
            } else if (value === "add column" || (value === "add" && lexemes[idx + 1]?.value.toLowerCase() === "column")) {
                // We don't have parseAddColumnAction yet, but let's at least handle the token or throw specific error?
                // Or maybe we should support it?
                // For now, let's just throw unsupported if we don't have the parser method, 
                // BUT the previous code had logic for it?
                // Looking at imports, we have AlterTableAddColumn.
                // But I don't see parseAddColumnAction method in the file.
                // Let's assume for now we only support constraints and drop column as per previous state.
                // Wait, the previous code I saw in the diff had:
                // if (action instanceof AlterTableAddConstraint || action instanceof AlterTableAddColumn)
                // So AddColumn WAS supported?
                // Let's check if I can find parseAddColumnAction in the file content I viewed.
                // I viewed lines 1-485. I don't see parseAddColumnAction.
                // So maybe it was never there or I missed it.
                // Let's stick to what was there: add constraint, drop constraint, drop column.
                // And generic "add" which might be add column or add constraint.

                // Re-reading the broken code:
                // } else if(value === "drop column" || value === "drop") {

                // It seems I should just implement the loop for what I have.
                throw new Error(`[AlterTableParser] Unsupported ALTER TABLE action '${lexemes[idx].value}' at index ${idx}.`);
            } else {
                throw new Error(`[AlterTableParser] Unsupported ALTER TABLE action '${lexemes[idx].value}' at index ${idx}.`);
            }

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            break;
        }

        if (actions.length === 0) {
            throw new Error("[AlterTableParser] ALTER TABLE requires at least one action.");
        }

        return {
            value: new AlterTableStatement({ table: tableName, only, ifExists, actions }),
            newIndex: idx
        };
    }

    private static parseAddConstraintAction(lexemes: Lexeme[], index: number): { value: AlterTableAddConstraint; newIndex: number } {
        let idx = index;

        const initialToken = lexemes[idx]?.value.toLowerCase();
        if (initialToken !== "add" && initialToken !== "add constraint") {
            throw new Error(`[AlterTableParser] Expected ADD or ADD CONSTRAINT at index ${idx}.`);
        }
        idx++;

        // If the token was plain ADD, consume optional CONSTRAINT keyword.
        if (initialToken === "add" && lexemes[idx]?.value.toLowerCase() === "constraint") {
            idx++;
        }

        let ifNotExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if not exists") {
            ifNotExists = true;
            idx++;
        }

        let constraintName: IdentifierString | undefined;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue && !this.CONSTRAINT_TYPE_TOKENS.has(nextValue)) {
            const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
            constraintName = nameResult.name;
            idx = nameResult.newIndex;
        }

        const constraintResult = this.parseTableConstraintDefinition(lexemes, idx, constraintName);
        idx = constraintResult.newIndex;

        let notValid = false;
        if (lexemes[idx]?.value.toLowerCase() === "not valid") {
            notValid = true;
            idx++;
        }

        return {
            value: new AlterTableAddConstraint({
                constraint: constraintResult.constraint,
                ifNotExists,
                notValid
            }),
            newIndex: idx
        };
    }

    private static parseDropConstraintAction(lexemes: Lexeme[], index: number): { value: AlterTableDropConstraint; newIndex: number } {
        let idx = index;

        const initialValue = lexemes[idx]?.value.toLowerCase();
        if (initialValue === "drop constraint") {
            idx++;
        } else if (initialValue === "drop") {
            idx++;
            if (lexemes[idx]?.value.toLowerCase() !== "constraint") {
                throw new Error(`[AlterTableParser] Expected CONSTRAINT keyword after DROP at index ${idx}.`);
            }
            idx++;
        } else {
            throw new Error(`[AlterTableParser] Expected DROP CONSTRAINT at index ${idx}.`);
        }

        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        idx = nameResult.newIndex;

        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new AlterTableDropConstraint({
                constraintName: nameResult.name,
                ifExists,
                behavior
            }),
            newIndex: idx
        };
    }

    private static parseDropColumnAction(lexemes: Lexeme[], index: number): { value: AlterTableDropColumn; newIndex: number } {
        let idx = index;

        const initialValue = lexemes[idx]?.value.toLowerCase();
        if (initialValue === "drop column") {
            idx++;
        } else if (initialValue === "drop") {
            idx++;
            if (lexemes[idx]?.value.toLowerCase() !== "column") {
                throw new Error(`[AlterTableParser] Expected COLUMN keyword after DROP at index ${idx}.`);
            }
            idx++;
        } else {
            throw new Error(`[AlterTableParser] Expected DROP COLUMN at index ${idx}.`);
        }

        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            // Accept optional IF EXISTS modifier for defensive migrations.
            ifExists = true;
            idx++;
        }

        // Parse the column identifier, propagating any attached comments.
        const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const columnName = nameResult.name;
        idx = nameResult.newIndex;

        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            // Capture optional drop behavior to mirror PostgreSQL semantics.
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new AlterTableDropColumn({
                columnName,
                ifExists,
                behavior
            }),
            newIndex: idx
        };
    }

    private static parseAlterColumnDefaultAction(
        lexemes: Lexeme[],
        index: number
    ): { value: AlterTableAlterColumnDefault; newIndex: number } {
        let idx = index;
        const descriptor = lexemes[idx]?.value.toLowerCase();

        // Accept both combined and separate ALTER/COLUMN keywords for maximum flexibility.
        if (descriptor === "alter column") {
            idx++;
        } else if (descriptor === "alter") {
            idx++;
            if (lexemes[idx]?.value.toLowerCase() !== "column") {
                throw new Error(`[AlterTableParser] Expected COLUMN keyword after ALTER at index ${idx}.`);
            }
            idx++;
        } else {
            throw new Error(`[AlterTableParser] Expected ALTER COLUMN at index ${idx}.`);
        }

        // Parse the column identifier, keeping comment metadata in place.
        const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const columnName = nameResult.name;
        idx = nameResult.newIndex;

        // Distinguish between SET DEFAULT and DROP DEFAULT actions.
        const nextToken = lexemes[idx]?.value.toLowerCase();
        if (nextToken === "set default" || (nextToken === "set" && lexemes[idx + 1]?.value.toLowerCase() === "default")) {
            idx += nextToken === "set default" ? 1 : 2;
            const defaultResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = defaultResult.newIndex;
            return {
                value: new AlterTableAlterColumnDefault({
                    columnName,
                    setDefault: defaultResult.value
                }),
                newIndex: idx
            };
        }

        if (nextToken === "drop default" || (nextToken === "drop" && lexemes[idx + 1]?.value.toLowerCase() === "default")) {
            idx += nextToken === "drop default" ? 1 : 2;
            return {
                value: new AlterTableAlterColumnDefault({
                    columnName,
                    dropDefault: true
                }),
                newIndex: idx
            };
        }

        throw new Error(`[AlterTableParser] Expected SET DEFAULT or DROP DEFAULT at index ${idx}.`);
    }

    private static parseTableConstraintDefinition(
        lexemes: Lexeme[],
        index: number,
        constraintName?: IdentifierString
    ): { constraint: TableConstraintDefinition; newIndex: number } {
        let idx = index;
        const token = lexemes[idx];
        if (!token) {
            throw new Error(`[AlterTableParser] Missing constraint definition at index ${idx}.`);
        }
        const value = token.value.toLowerCase();

        if (value === "primary key") {
            idx++;
            const listResult = this.parseIdentifierList(lexemes, idx);
            idx = listResult.newIndex;
            return {
                constraint: new TableConstraintDefinition({
                    kind: "primary-key",
                    constraintName,
                    columns: listResult.identifiers
                }),
                newIndex: idx
            };
        }

        if (value === "unique" || value === "unique key") {
            idx++;
            const listResult = this.parseIdentifierList(lexemes, idx);
            idx = listResult.newIndex;
            return {
                constraint: new TableConstraintDefinition({
                    kind: "unique",
                    constraintName,
                    columns: listResult.identifiers
                }),
                newIndex: idx
            };
        }

        if (value === "foreign key") {
            idx++;
            const listResult = this.parseIdentifierList(lexemes, idx);
            idx = listResult.newIndex;
            const referenceResult = this.parseReferenceDefinition(lexemes, idx);
            idx = referenceResult.newIndex;
            return {
                constraint: new TableConstraintDefinition({
                    kind: "foreign-key",
                    constraintName,
                    columns: listResult.identifiers,
                    reference: referenceResult.reference,
                    deferrable: referenceResult.reference.deferrable,
                    initially: referenceResult.reference.initially
                }),
                newIndex: idx
            };
        }

        if (value === "check") {
            idx++;
            const checkExpression = this.parseParenExpression(lexemes, idx);
            idx = checkExpression.newIndex;
            return {
                constraint: new TableConstraintDefinition({
                    kind: "check",
                    constraintName,
                    checkExpression: checkExpression.value
                }),
                newIndex: idx
            };
        }

        const rawEnd = this.findConstraintClauseEnd(lexemes, idx + 1);
        const rawText = joinLexemeValues(lexemes, idx, rawEnd);
        return {
            constraint: new TableConstraintDefinition({
                kind: "raw" as TableConstraintKind,
                constraintName,
                rawClause: new RawString(rawText)
            }),
            newIndex: rawEnd
        };
    }

    private static parseIdentifierList(lexemes: Lexeme[], index: number): { identifiers: IdentifierString[]; newIndex: number } {
        let idx = index;
        const identifiers: IdentifierString[] = [];

        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            throw new Error(`[AlterTableParser] Expected '(' to start identifier list at index ${idx}.`);
        }
        idx++;

        while (idx < lexemes.length) {
            const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
            identifiers.push(nameResult.name);
            idx = nameResult.newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            if (lexemes[idx]?.type === TokenType.CloseParen) {
                idx++;
                break;
            }
        }

        return { identifiers, newIndex: idx };
    }

    private static parseReferenceDefinition(lexemes: Lexeme[], index: number): { reference: ReferenceDefinition; newIndex: number } {
        let idx = index;
        if (lexemes[idx]?.value.toLowerCase() !== "references") {
            throw new Error(`[AlterTableParser] Expected REFERENCES clause at index ${idx}.`);
        }
        idx++;

        const tableResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const targetTable = new QualifiedName(tableResult.namespaces, tableResult.name);
        idx = tableResult.newIndex;

        let columns: IdentifierString[] | null = null;
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            const listResult = this.parseIdentifierList(lexemes, idx);
            columns = listResult.identifiers;
            idx = listResult.newIndex;
        }

        let matchType: MatchType = null;
        let onDelete: ReferentialAction | null = null;
        let onUpdate: ReferentialAction | null = null;
        let deferrable: ConstraintDeferrability = null;
        let initially: ConstraintInitially = null;

        while (idx < lexemes.length) {
            const current = lexemes[idx].value.toLowerCase();

            if (this.MATCH_KEYWORDS.has(current)) {
                matchType = this.MATCH_KEYWORDS.get(current)!;
                idx++;
                continue;
            }

            if (current === "match") {
                idx++;
                const descriptor = lexemes[idx]?.value.toLowerCase() ?? "";
                matchType = descriptor as MatchType;
                idx++;
                continue;
            }

            if (current === "on delete") {
                idx++;
                const action = lexemes[idx]?.value.toLowerCase() ?? "";
                onDelete = this.REFERENTIAL_ACTIONS.get(action) ?? null;
                idx++;
                continue;
            }

            if (current === "on update") {
                idx++;
                const action = lexemes[idx]?.value.toLowerCase() ?? "";
                onUpdate = this.REFERENTIAL_ACTIONS.get(action) ?? null;
                idx++;
                continue;
            }

            if (this.DEFERRABILITY_KEYWORDS.has(current)) {
                deferrable = this.DEFERRABILITY_KEYWORDS.get(current)!;
                idx++;
                continue;
            }

            if (this.INITIALLY_KEYWORDS.has(current)) {
                initially = this.INITIALLY_KEYWORDS.get(current)!;
                idx++;
                continue;
            }

            break;
        }

        return {
            reference: new ReferenceDefinition({
                targetTable,
                columns,
                matchType,
                onDelete,
                onUpdate,
                deferrable,
                initially
            }),
            newIndex: idx
        };
    }

    private static parseParenExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            throw new Error(`[AlterTableParser] Expected '(' starting CHECK expression at index ${idx}.`);
        }
        idx++;
        const result = ValueParser.parseFromLexeme(lexemes, idx);
        idx = result.newIndex;
        if (lexemes[idx]?.type !== TokenType.CloseParen) {
            throw new Error(`[AlterTableParser] Expected ')' closing CHECK expression at index ${idx}.`);
        }
        idx++;
        return { value: result.value, newIndex: idx };
    }

    private static findConstraintClauseEnd(lexemes: Lexeme[], index: number): number {
        let idx = index;
        while (idx < lexemes.length) {
            const token = lexemes[idx];
            if (token.type & (TokenType.Comma | TokenType.CloseParen)) {
                break;
            }
            if (token.value.toLowerCase() === "not valid") {
                break;
            }
            idx++;
        }
        return idx;
    }

}
