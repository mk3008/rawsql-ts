import { SqlComponent } from "./SqlComponent";

/**
 * Represents a SQL hint clause
 */
export class HintClause extends SqlComponent {
    static kind = Symbol('HintClause');

    /**
     * The hint content without the delimiters
     */
    public hintContent: string;

    constructor(hintContent: string) {
        super();
        this.hintContent = hintContent;
    }

    /**
     * Returns the full hint clause with delimiters
     */
    public getFullHint(): string {
        return '/*+ ' + this.hintContent + ' */';
    }

    /**
     * Checks if a string is a hint clause
     */
    public static isHintClause(value: string): boolean {
        const trimmed = value.trim();
        return trimmed.length >= 5 && 
               trimmed.substring(0, 3) === '/*+' && 
               trimmed.substring(trimmed.length - 2) === '*/';
    }

    /**
     * Extracts hint content from a hint clause string
     */
    public static extractHintContent(hintClause: string): string {
        const trimmed = hintClause.trim();
        if (!this.isHintClause(trimmed)) {
            throw new Error('Not a valid hint clause: ' + hintClause);
        }
        return trimmed.slice(3, -2).trim();
    }
}