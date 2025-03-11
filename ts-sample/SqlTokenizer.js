"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlTokenizer = void 0;
const TokenType_1 = require("./enums/TokenType");
class SqlTokenizer {
    constructor(input) {
        this.input = input;
        this.position = 0;
    }
    getNextToken() {
        if (this.position >= this.input.length) {
            return null;
        }
        const char = this.input[this.position];
        if (char === '.') {
            this.position++;
            return { type: TokenType_1.TokenType.Dot, value: char, command: char.toLowerCase() };
        }
        if (/[a-zA-Z_]/.test(char)) {
            let start = this.position;
            while (this.position < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.position])) {
                this.position++;
            }
            const value = this.input.slice(start, this.position);
            return { type: TokenType_1.TokenType.Identifier, value };
        }
        this.position++;
        return { type: TokenType_1.TokenType.Unknown, value: char };
    }
}
exports.SqlTokenizer = SqlTokenizer;
//# sourceMappingURL=SqlTokenizer.js.map