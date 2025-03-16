import { KeywordMatchResult } from "./KeywordParser";


export class KeywordTrie {
    private root: Map<string, any> = new Map();
    private currentNode: Map<string, any>;

    // Add a caching property to avoid regex pattern creation for each check
    private hasEndProperty: boolean = false;
    private hasMoreProperties: boolean = false;

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
        this.hasEndProperty = false;
        this.hasMoreProperties = false;
    }

    public pushLexeme(lexeme: string): KeywordMatchResult {
        if (!this.currentNode.has(lexeme)) {
            return KeywordMatchResult.NotAKeyword;
        }

        // move to next node
        this.currentNode = this.currentNode.get(lexeme);

        // Cache property checks to avoid repeated operations
        this.hasEndProperty = this.currentNode.has("__end__");
        this.hasMoreProperties = this.currentNode.size > (this.hasEndProperty ? 1 : 0);

        if (this.hasEndProperty && !this.hasMoreProperties) {
            return KeywordMatchResult.Final;
        }
        if (this.hasEndProperty && this.hasMoreProperties) {
            return KeywordMatchResult.PartialOrFinal;
        }

        return KeywordMatchResult.PartialOnly;
    }
}
