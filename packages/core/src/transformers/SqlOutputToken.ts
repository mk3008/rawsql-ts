// Composite pattern for SQL lines
export class SqlOutputToken {
    type: string;
    text: string;
    innerTokens: SqlOutputToken[];
    constructor(type: string, text: string, innerTokens: SqlOutputToken[] = []) {
        this.type = type;
        this.text = text;
        this.innerTokens = innerTokens;
    }
}
