"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["Unknown"] = 0] = "Unknown";
    TokenType[TokenType["Literal"] = 1] = "Literal";
    TokenType[TokenType["Operator"] = 2] = "Operator";
    TokenType[TokenType["OpenParen"] = 3] = "OpenParen";
    TokenType[TokenType["CloseParen"] = 4] = "CloseParen";
    TokenType[TokenType["Comma"] = 5] = "Comma";
    TokenType[TokenType["Dot"] = 6] = "Dot";
    TokenType[TokenType["Identifier"] = 7] = "Identifier";
    TokenType[TokenType["Command"] = 8] = "Command";
    TokenType[TokenType["Parameter"] = 9] = "Parameter";
    TokenType[TokenType["OpenBracket"] = 10] = "OpenBracket";
    TokenType[TokenType["CloseBracket"] = 11] = "CloseBracket";
    TokenType[TokenType["Comment"] = 12] = "Comment";
    TokenType[TokenType["EscapedStringConstant"] = 13] = "EscapedStringConstant";
})(TokenType || (exports.TokenType = TokenType = {}));
//# sourceMappingURL=TokenType.js.map