import { KeywordMatchResult } from "../parsers/KeywordParser";

interface KeywordTrieNode {
    children: Map<string, KeywordTrieNode>;
    isFinal: boolean;
}

// Note: An object-based trie (string-keyed object) was tested, but benchmark results showed no improvement and sometimes worse performance for long queries.
// Therefore, a Map-backed trie is retained while keeping terminal metadata on the node itself.
export class KeywordTrie {
    private readonly root: KeywordTrieNode = this.createNode();
    private currentNode: KeywordTrieNode;

    constructor(keywords: string[][]) {
        // Build the keyword trie once so parse-time matching only walks existing nodes.
        for (let i = 0; i < keywords.length; i++) {
            this.addKeyword(keywords[i]);
        }
        this.currentNode = this.root;
    }

    private createNode(): KeywordTrieNode {
        return {
            children: new Map<string, KeywordTrieNode>(),
            isFinal: false,
        };
    }

    private addKeyword(keyword: string[]): void {
        let node = this.root;
        for (let i = 0; i < keyword.length; i++) {
            const word = keyword[i];
            let nextNode = node.children.get(word);
            if (!nextNode) {
                nextNode = this.createNode();
                node.children.set(word, nextNode);
            }
            node = nextNode;
        }
        node.isFinal = true;
    }

    public reset(): void {
        this.currentNode = this.root;
    }

    public pushLexeme(lexeme: string): KeywordMatchResult {
        const nextNode = this.currentNode.children.get(lexeme);
        if (!nextNode) {
            return KeywordMatchResult.NotAKeyword;
        }

        this.currentNode = nextNode;

        if (nextNode.isFinal) {
            return nextNode.children.size === 0
                ? KeywordMatchResult.Final
                : KeywordMatchResult.PartialOrFinal;
        }

        return KeywordMatchResult.PartialOnly;
    }
}
