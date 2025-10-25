import type { Lexeme } from "../models/Lexeme";

const NO_SPACE_BEFORE = new Set([",", ")", "]", "}", ";"]);
const NO_SPACE_AFTER = new Set(["(", "[", "{"]);

/**
 * Join lexeme values into a whitespace-normalized SQL fragment.
 * Keeps punctuation tight while preserving spacing elsewhere.
 */
export function joinLexemeValues(lexemes: Lexeme[], start: number, end: number): string {
    let result = "";
    for (let i = start; i < end; i++) {
        const current = lexemes[i];
        if (!current) {
            continue;
        }

        if (result.length === 0) {
            result = current.value;
            continue;
        }

        const previous = lexemes[i - 1]?.value ?? "";
        const omitSpace =
            NO_SPACE_BEFORE.has(current.value) ||
            NO_SPACE_AFTER.has(previous) ||
            current.value === "." ||
            previous === ".";

        result += omitSpace ? current.value : ` ${current.value}`;
    }
    return result;
}
