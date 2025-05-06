export enum SqlPrintTokenType {
    container = 0,
    keyword,
    value, // Represents non-keyword elements such as table names
    commna, // Represents comma ','
    parenthesis, // Represents parentheses: ( ) { } [ ]
    operator, // Represents operators such as +, -, *, /
    comment,
    parameter,
    dot,
    type,
    space,
}

export class SqlPrintToken {
    type: SqlPrintTokenType;
    text: string;

    tokens: SqlPrintToken[] = [];

    constructor(type: SqlPrintTokenType, text: string = '') {
        this.type = type;
        this.text = text;
    }
}
