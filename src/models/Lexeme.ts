import { TokenType } from '../enums/tokenType';

/**
 * Represents a lexical token in SQL parsing
 */
export interface Lexeme {
    type: TokenType;
    value: string;
    command?: string;
}
