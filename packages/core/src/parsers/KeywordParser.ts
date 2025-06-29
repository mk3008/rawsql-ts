import { KeywordTrie } from "../models/KeywordTrie";
import { StringUtils } from "../utils/stringUtils";

export enum KeywordMatchResult {
    NotAKeyword,     // "Not recognized as a keyword"
    PartialOnly,     // "Partial match (this will not be the end)"
    PartialOrFinal,  // "Partial or complete match (it can stop here)"
    Final            // "Complete match (no longer keywords after this)"
}

export class KeywordParser {
    private trie: KeywordTrie;

    constructor(trie: KeywordTrie) {
        this.trie = trie;
    }

    private isEndOfInput(input: string, position: number, shift: number = 0): boolean {
        return position + shift >= input.length;
    }

    private canParse(input: string, position: number, shift: number = 0): boolean {
        return !this.isEndOfInput(input, position, shift);
    }

    public parse(input: string, position: number): { keyword: string, newPosition: number } | null {
        if (this.isEndOfInput(input, position)) {
            return null;
        }

        // reset trie node
        this.trie.reset();
        const result = StringUtils.tryReadRegularIdentifier(input, position);

        if (result === null) {
            return null;
        }

        let matchResult = this.trie.pushLexeme(result.identifier.toLowerCase());

        if (matchResult === KeywordMatchResult.NotAKeyword) {
            return null;
        }

        if (matchResult === KeywordMatchResult.Final) {
            return {
                keyword: result.identifier,
                newPosition: result.newPosition
            };
        }

        // multi-word keyword
        let lexeme = result.identifier;
        position = StringUtils.readWhiteSpaceAndComment(input, result.newPosition).position;

        // end of input
        if (this.isEndOfInput(input, position)) {
            if (matchResult === KeywordMatchResult.PartialOrFinal) {
                // if the last match was partial or final, it means that the keyword is finished
                return {
                    keyword: lexeme,
                    newPosition: position
                };
            } else {

                return null;
            }
        }

        while (this.canParse(input, position)) {
            const previousMatchResult = matchResult;

            const result = StringUtils.tryReadRegularIdentifier(input, position);

            if (result !== null) {
                matchResult = this.trie.pushLexeme(result.identifier.toLowerCase());

                if (matchResult === KeywordMatchResult.NotAKeyword) {
                    if (previousMatchResult === KeywordMatchResult.PartialOrFinal) {
                        break;
                    } else {
                        return null;
                    }
                }

                lexeme += ' ' + result.identifier;
                position = StringUtils.readWhiteSpaceAndComment(input, result.newPosition).position;

                if (matchResult === KeywordMatchResult.Final) {
                    break;
                }
            } else if (previousMatchResult === KeywordMatchResult.PartialOrFinal) {
                break;
            } else {
                return null;
            }
        }

        return {
            keyword: lexeme,
            newPosition: position
        };
    }
}

