import { ParameterExpression } from "../models/ValueComponent";

/**
 * Utility class to collect all ParameterExpression nodes from an AST.
 */
export class ParameterCollector {
    /**
     * Recursively collect all ParameterExpression nodes from AST.
     * @param node AST root
     * @returns ParameterExpression[]
     */
    static collect(node: any): ParameterExpression[] {
        const result: ParameterExpression[] = [];
        function walk(n: any) {
            if (!n || typeof n !== 'object') return;
            if (n.constructor && n.constructor.kind === ParameterExpression.kind) {
                result.push(n);
            }
            for (const key of Object.keys(n)) {
                const v = n[key];
                if (Array.isArray(v)) {
                    v.forEach(walk);
                } else if (v && typeof v === 'object' && v.constructor && v.constructor.kind) {
                    walk(v);
                }
            }
        }
        walk(node);
        return result;
    }
}
