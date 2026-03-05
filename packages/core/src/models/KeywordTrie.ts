import { KeywordMatchResult } from "../parsers/KeywordParser";

// Note: An object-based trie (string-keyed object) was tested, but benchmark results showed no improvement and sometimes worse performance for long queries.
// Therefore, the original Map-based implementation is retained for best stability and speed.

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
        this.currentNode = this.root;
    }

    public pushLexeme(lexeme: string): KeywordMatchResult {
        const nextNode = this.currentNode.get(lexeme);
        if (!nextNode) {
            return KeywordMatchResult.NotAKeyword;
        }

        // move to next node
        this.currentNode = nextNode;

        // Resolve terminal state with a single node reference.
        const hasEndProperty = nextNode.has("__end__");
        if (hasEndProperty) {
            return nextNode.size === 1
                ? KeywordMatchResult.Final
                : KeywordMatchResult.PartialOrFinal;
        }

        return KeywordMatchResult.PartialOnly;
    }
}
