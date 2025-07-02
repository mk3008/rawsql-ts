/**
 * SQL operator precedence definitions
 * Higher numbers indicate higher precedence (tighter binding)
 */
export class OperatorPrecedence {
    private static readonly precedenceMap: Record<string, number> = {
        // Logical operators (lowest precedence)
        'or': 1,
        'and': 2,

        // Comparison operators
        '=': 10,
        '!=': 10,
        '<>': 10,
        '<': 10,
        '<=': 10,
        '>': 10,
        '>=': 10,
        'like': 10,
        'ilike': 10,
        'not like': 10,
        'not ilike': 10,
        'similar to': 10,
        'not similar to': 10,
        'in': 10,
        'not in': 10,
        'is': 10,
        'is not': 10,
        // JSON operators (PostgreSQL/MySQL)
        '->': 10,
        '->>': 10,
        '#>': 10,
        '#>>': 10,
        '@>': 10,
        '<@': 10,
        '?': 10,
        '?|': 10,
        '?&': 10,
        // Regular expression operators (PostgreSQL/MySQL)
        '~': 10,
        '~*': 10,
        '!~': 10,
        '!~*': 10,
        'rlike': 10,
        'regexp': 10,
        'between': 15,  // BETWEEN has higher precedence than logical operators
        'not between': 15,

        // Arithmetic operators
        '+': 20,
        '-': 20,
        '*': 30,
        '/': 30,
        '%': 30,
        '^': 40,

        // Type casting
        '::': 50,

        // Highest precedence operators
        'unary+': 100,
        'unary-': 100,
        'not': 100
    };

    /**
     * Get the precedence of an operator
     * @param operator The operator string
     * @returns The precedence number (higher = tighter binding)
     */
    public static getPrecedence(operator: string): number {
        const precedence = this.precedenceMap[operator.toLowerCase()];
        return precedence !== undefined ? precedence : 0;
    }

    /**
     * Check if operator1 has higher or equal precedence than operator2
     */
    public static hasHigherOrEqualPrecedence(operator1: string, operator2: string): boolean {
        return this.getPrecedence(operator1) >= this.getPrecedence(operator2);
    }

    /**
     * Check if an operator is a logical operator (AND/OR)
     */
    public static isLogicalOperator(operator: string): boolean {
        const op = operator.toLowerCase();
        return op === 'and' || op === 'or';
    }

    /**
     * Check if an operator is a BETWEEN operator
     */
    public static isBetweenOperator(operator: string): boolean {
        const op = operator.toLowerCase();
        return op === 'between' || op === 'not between';
    }

    /**
     * Check if a string is a comparison operator
     */
    public static isComparisonOperator(operator: string): boolean {
        const lowerOp = operator.toLowerCase();
        return ['=', '!=', '<>', '<', '>', '<=', '>=', 'like', 'ilike', 'similar to', 'in', 'not in',
               '->', '->>', '#>', '#>>', '@>', '<@', '?', '?|', '?&',
               '~', '~*', '!~', '!~*', 'rlike', 'regexp'].includes(lowerOp);
    }
}
