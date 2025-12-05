import { Lexeme } from "../models/Lexeme";
import { CreateSequenceStatement, AlterSequenceStatement, SequenceOptionClause } from "../models/DDLStatements";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

const CREATE_SEQUENCE_COMMANDS = new Set([
    "create sequence",
    "create temporary sequence",
    "create temp sequence"
]);

export class CreateSequenceParser {
    public static parse(sql: string): CreateSequenceStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        // Ensure the statement was fully consumed and no extra tokens remain.
        if (result.newIndex < lexemes.length) {
            const unexpected = lexemes[result.newIndex];
            const position = unexpected.position?.startPosition ?? 0;
            throw new Error(
                `[CreateSequenceParser] Unexpected token "${unexpected.value}" at position ${position}.`
            );
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CreateSequenceStatement; newIndex: number } {
        let idx = index;
        // The cursor should start on a CREATE SEQUENCE command (possibly with TEMP/TEMPORARY).
        const command = lexemes[idx]?.value.toLowerCase();
        if (!command || !CREATE_SEQUENCE_COMMANDS.has(command)) {
            throw new Error(`[CreateSequenceParser] Expected CREATE SEQUENCE at index ${idx}.`);
        }
        idx++;

        let ifNotExists = false;
        // Accept an optional IF NOT EXISTS clause.
        if (lexemes[idx]?.value.toLowerCase() === "if not exists") {
            ifNotExists = true;
            idx++;
        }

        // Parse the qualified name of the target sequence.
        const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const sequenceName = new QualifiedName(nameResult.namespaces, nameResult.name);
        idx = nameResult.newIndex;

        // Gather sequence option clauses that follow the target identifier.
        const optionsResult = parseSequenceClauses(lexemes, idx);
        idx = optionsResult.newIndex;

        return {
            value: new CreateSequenceStatement({
                sequenceName,
                ifNotExists,
                clauses: optionsResult.clauses
            }),
            newIndex: idx
        };
    }
}

export class AlterSequenceParser {
    public static parse(sql: string): AlterSequenceStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        // Guard against unexpected trailing tokens after a valid ALTER SEQUENCE statement.
        if (result.newIndex < lexemes.length) {
            const unexpected = lexemes[result.newIndex];
            const position = unexpected.position?.startPosition ?? 0;
            throw new Error(
                `[AlterSequenceParser] Unexpected token "${unexpected.value}" at position ${position}.`
            );
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: AlterSequenceStatement; newIndex: number } {
        let idx = index;
        // Expect ALTER SEQUENCE as the leading keywords.
        if (lexemes[idx]?.value.toLowerCase() !== "alter sequence") {
            throw new Error(`[AlterSequenceParser] Expected ALTER SEQUENCE at index ${idx}.`);
        }
        idx++;

        let ifExists = false;
        // Consume the optional IF EXISTS qualifier.
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        // Parse the fully qualified sequence identifier.
        const nameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const sequenceName = new QualifiedName(nameResult.namespaces, nameResult.name);
        idx = nameResult.newIndex;

        // Capture any option clauses that follow.
        const optionsResult = parseSequenceClauses(lexemes, idx);
        idx = optionsResult.newIndex;

        return {
            value: new AlterSequenceStatement({
                sequenceName,
                ifExists,
                clauses: optionsResult.clauses
            }),
            newIndex: idx
        };
    }
}

function parseSequenceClauses(lexemes: Lexeme[], index: number): { clauses: SequenceOptionClause[]; newIndex: number } {
    let idx = index;
    // Continue parsing clause-by-clause until a non-clause token stops the loop.
    const clauses: SequenceOptionClause[] = [];

    while (idx < lexemes.length) {
        const token = lexemes[idx]?.value.toLowerCase();
        // Terminate when there are no more tokens left to consume.
        if (!token) {
            break;
        }

        // Recognize INCREMENT BY <value> while tolerating the optional BY keyword.
        if (token === "increment") {
            idx++;
            idx = consumeOptionalKeyword(lexemes, idx, "by");
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            clauses.push({ kind: "increment", value: valueResult.value });
            idx = valueResult.newIndex;
            continue;
        }

        // START WITH <value> clause prefers a WITH keyword but does not require it.
        if (token === "start") {
            idx++;
            idx = consumeOptionalKeyword(lexemes, idx, "with");
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            clauses.push({ kind: "start", value: valueResult.value });
            idx = valueResult.newIndex;
            continue;
        }

        // MINVALUE <value> clause captures the lower bound directly.
        if (token === "minvalue") {
            idx++;
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            clauses.push({ kind: "minValue", value: valueResult.value });
            idx = valueResult.newIndex;
            continue;
        }

        // MAXVALUE <value> clause captures the upper bound directly.
        if (token === "maxvalue") {
            idx++;
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            clauses.push({ kind: "maxValue", value: valueResult.value });
            idx = valueResult.newIndex;
            continue;
        }

        // CACHE <value> clause records the in-memory cache size.
        if (token === "cache") {
            idx++;
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            clauses.push({ kind: "cache", value: valueResult.value });
            idx = valueResult.newIndex;
            continue;
        }

        // CYCLE enables wrapping behavior.
        if (token === "cycle") {
            clauses.push({ kind: "cycle", enabled: true });
            idx++;
            continue;
        }

        // RESTART optionally accepts a WITH <value> clause.
        if (token === "restart") {
            idx++;
            let restartValue;
            if (lexemes[idx]?.value.toLowerCase() === "with") {
                idx++;
                const restartResult = ValueParser.parseFromLexeme(lexemes, idx);
                restartValue = restartResult.value;
                idx = restartResult.newIndex;
            }
            clauses.push({ kind: "restart", value: restartValue });
            continue;
        }

        // OWNED BY clause can point to a target column or NONE.
        if (token === "owned") {
            idx++;
            if (lexemes[idx]?.value.toLowerCase() !== "by") {
                throw new Error(`[SequenceParser] Expected BY after OWNED at index ${idx}.`);
            }
            idx++;
            const nextToken = lexemes[idx]?.value.toLowerCase();
            if (nextToken === "none") {
                clauses.push({ kind: "ownedBy", none: true });
                idx++;
                continue;
            }
            const ownerResult = FullNameParser.parseFromLexeme(lexemes, idx);
            const ownerName = new QualifiedName(ownerResult.namespaces, ownerResult.name);
            clauses.push({ kind: "ownedBy", target: ownerName });
            idx = ownerResult.newIndex;
            continue;
        }

        // NO {MINVALUE|MAXVALUE|CACHE|CYCLE} disables the respective default clauses.
        if (token === "no") {
            const nextToken = lexemes[idx + 1]?.value.toLowerCase();
            if (nextToken === "minvalue") {
                clauses.push({ kind: "minValue", noValue: true });
                idx += 2;
                continue;
            }
            if (nextToken === "maxvalue") {
                clauses.push({ kind: "maxValue", noValue: true });
                idx += 2;
                continue;
            }
            if (nextToken === "cache") {
                clauses.push({ kind: "cache", noValue: true });
                idx += 2;
                continue;
            }
            if (nextToken === "cycle") {
                clauses.push({ kind: "cycle", enabled: false });
                idx += 2;
                continue;
            }
        }

        break;
    }

    return { clauses, newIndex: idx };
}

function consumeOptionalKeyword(lexemes: Lexeme[], index: number, keyword: string): number {
    // Skip an optional keyword that may appear before a value (e.g., BY or WITH).
    if (lexemes[index]?.value.toLowerCase() === keyword) {
        return index + 1;
    }
    return index;
}
