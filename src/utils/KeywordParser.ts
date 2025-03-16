import { KeywordTrie } from "./KeywordTrie";
import { StringUtils } from "./stringUtils";

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
        this.trie.reset();
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

        let matchResult = this.trie.pushLexeme(result.identifier);

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
        position = StringUtils.skipWhiteSpacesAndComments(input, result.newPosition);

        while (this.canParse(input, position)) {
            const previousMatchResult = matchResult;

            const result = StringUtils.tryReadRegularIdentifier(input, position);

            if (result !== null) {
                matchResult = this.trie.pushLexeme(result.identifier);

                if (matchResult === KeywordMatchResult.NotAKeyword) {
                    if (previousMatchResult === KeywordMatchResult.PartialOrFinal) {
                        break;
                    } else {
                        return null;
                    }
                }

                lexeme += ' ' + result.identifier;
                position = StringUtils.skipWhiteSpacesAndComments(input, result.newPosition);

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

