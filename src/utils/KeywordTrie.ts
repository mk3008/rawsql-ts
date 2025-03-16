import { StringUtils } from "./stringUtils";

export enum KeywordMatchResult {
    NotAKeyword,     // "キーワードではない"
    PartialOnly,     // "途中（ここで終わることはない）"
    PartialOrFinal,  // "途中または終端（ここで止まることはある）"
    Final            // "終端（これ以上長いキーワードはない）"
}

export class KeywordTrieReader {
    private input: string;
    private position: number;
    private trie: KeywordTrie;

    constructor(input: string, position: number, trie: KeywordTrie) {
        this.input = input;
        this.position = position;
        this.trie = trie;
        this.trie.reset();
    }

    private isEndOfInput(shift: number = 0): boolean {
        return this.position + shift >= this.input.length;
    }

    private canRead(shift: number = 0): boolean {
        return !this.isEndOfInput(shift);
    }

    public readKeyword(): { keyword: string, newPosition: number } | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const result = StringUtils.readRegularIdentifier(this.input, this.position);

        let matchResult = this.trie.pushLexeme(result.identifier);

        if (matchResult === KeywordMatchResult.NotAKeyword) {
            return null;
        }

        if (matchResult === KeywordMatchResult.Final) {
            this.position = result.newPosition;
            return {
                keyword: result.identifier,
                newPosition: this.position
            };
        }

        // multi-word keyword
        let lexeme = result.identifier;

        this.position = StringUtils.skipWhiteSpacesAndComments(this.input, result.newPosition);

        while (this.canRead()) {
            const result = StringUtils.readRegularIdentifier(this.input, this.position);

            const previousMatchResult = matchResult;
            matchResult = this.trie.pushLexeme(result.identifier);

            if (matchResult === KeywordMatchResult.NotAKeyword) {
                if (previousMatchResult === KeywordMatchResult.PartialOrFinal) {
                    break;
                } else {
                    return null;
                }
            }

            lexeme += ' ' + result.identifier;
            this.position = StringUtils.skipWhiteSpacesAndComments(this.input, result.newPosition);

            if (matchResult === KeywordMatchResult.Final) {
                break;
            }
        }
        return {
            keyword: lexeme,
            newPosition: this.position
        };
    }
}

export class KeywordTrie {
    private root: Map<string, any> = new Map();
    private currentNode: Map<string, any>;

    constructor(keywords: string[][]) {
        // initialize root node
        for (const keyword of keywords) {
            this.addKeyword(keyword);
        }
        // set current node to root
        this.currentNode = this.root;
    }

    private addKeyword(keyword: string[]) {
        let node = this.root;
        for (const word of keyword) {
            if (!node.has(word)) {
                node.set(word, new Map());
            }
            node = node.get(word);
        }
        node.set("__end__", true);
    }

    public reset(): void {
        this.currentNode = this.root
    }

    public pushLexeme(lexeme: string): KeywordMatchResult {
        if (!this.currentNode.has(lexeme)) {
            return KeywordMatchResult.NotAKeyword;
        }

        // move to next node
        this.currentNode = this.currentNode.get(lexeme);

        const hasEnd = this.currentNode.has("__end__");
        const hasMore = this.currentNode.size > (hasEnd ? 1 : 0);

        if (hasEnd && !hasMore) {
            return KeywordMatchResult.Final;
        }
        if (hasEnd && hasMore) {
            return KeywordMatchResult.PartialOrFinal;
        }

        return KeywordMatchResult.PartialOnly;
    }
}
