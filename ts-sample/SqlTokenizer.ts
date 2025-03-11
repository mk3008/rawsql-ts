import { TokenType } from './enums/TokenType';

interface Lexeme {
    type: TokenType;
    value: string;
    command?: string; // Add the command property
}

export class SqlTokenizer {
    private input: string;
    private position: number;

    constructor(input: string) {
        this.input = input;
        this.position = 0;
    }

    public getNextToken(): Lexeme | null {
        if (this.position >= this.input.length) {
            return null;
        }

        const char = this.input[this.position];

        if (char === '.') {
            this.position++;
            return { type: TokenType.Dot, value: char, command: char.toLowerCase() };
        }

        if (/[a-zA-Z_]/.test(char)) {
            let start = this.position;
            while (this.position < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.position])) {
                this.position++;
            }
            const value = this.input.slice(start, this.position);
            return { type: TokenType.Identifier, value };
        }

        this.position++;
        return { type: TokenType.Unknown, value: char };
    }
}
