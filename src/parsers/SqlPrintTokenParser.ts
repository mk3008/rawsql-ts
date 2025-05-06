import { PartitionByClause, OrderByClause, OrderByItem, SelectClause, SelectItem, Distinct, DistinctOn, SortDirection, NullsSortDirection, TableSource, SourceExpression } from "../models/Clause";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { SqlPrintToken, SqlPrintTokenType } from "../models/SqlPrintToken";
import {
    ValueList,
    ColumnReference,
    FunctionCall,
    UnaryExpression,
    BinaryExpression,
    LiteralValue,
    ParameterExpression,
    SwitchCaseArgument,
    CaseKeyValuePair,
    RawString,
    IdentifierString,
    ParenExpression,
    CastExpression,
    CaseExpression,
    ArrayExpression,
    BetweenExpression,
    InlineQuery,
    StringSpecifierExpression,
    TypeValue,
    TupleExpression,
    WindowFrameExpression
} from "../models/ValueComponent";
import { IdentifierDecorator } from "./IdentifierDecorator";
import { ParameterDecorator } from "./ParameterDecorator";


export class SqlPrintTokenParser implements SqlComponentVisitor<SqlPrintToken> {
    // Static tokens for common symbols
    private static readonly SPACE_TOKEN = new SqlPrintToken(SqlPrintTokenType.space, ' ');
    private static readonly COMMA_TOKEN = new SqlPrintToken(SqlPrintTokenType.commna, ',');
    private static readonly PAREN_OPEN_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, '(');
    private static readonly PAREN_CLOSE_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, ')');

    private handlers: Map<symbol, (arg: any) => SqlPrintToken> = new Map();
    parameterDecorator: ParameterDecorator;
    identifierDecorator: IdentifierDecorator;
    index: number = 1;

    constructor(options?: {
        parameterDecorator?: ParameterDecorator,
        identifierDecorator?: IdentifierDecorator
    }) {
        this.parameterDecorator = options?.parameterDecorator ?? new ParameterDecorator();
        this.identifierDecorator = options?.identifierDecorator ?? new IdentifierDecorator();

        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralValue(expr as LiteralValue));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.visitStringSpecifierExpression(expr as StringSpecifierExpression));
        this.handlers.set(TypeValue.kind, (expr) => this.visitTypeValue(expr as TypeValue));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));

        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr));

        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.visitDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.visitDistinctOn(expr as DistinctOn));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
    }

    /**
     * Returns an array of tokens representing a comma followed by a space.
     * This is a common pattern in SQL pretty-printing.
     */
    private static commaSpaceTokens(): SqlPrintToken[] {
        return [SqlPrintTokenParser.COMMA_TOKEN, SqlPrintTokenParser.SPACE_TOKEN];
    }

    private visitPartitionByClause(arg: PartitionByClause): SqlPrintToken {
        // Print as: partition by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'partition by');
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.value));
        return token;
    }

    private visitOrderByClause(arg: OrderByClause): SqlPrintToken {
        // Print as: order by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'order by');
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.order.length; i++) {
            if (i > 0) token.tokens.push(SqlPrintTokenParser.COMMA_TOKEN);
            token.tokens.push(this.visit(arg.order[i]));
        }
        return token;
    }

    /**
     * Print an OrderByItem (expression [asc|desc] [nulls first|last])
     */
    private visitOrderByItem(arg: OrderByItem): SqlPrintToken {
        // arg: OrderByItem
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');
        token.tokens.push(this.visit(arg.value));

        if (arg.sortDirection && arg.sortDirection !== SortDirection.Ascending) {
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'desc'));
        }

        if (arg.nullsPosition) {
            if (arg.nullsPosition === NullsSortDirection.First) {
                token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'nulls first'));
            } else if (arg.nullsPosition === NullsSortDirection.Last) {
                token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, ' nulls last'));
            }
        }
        return token;
    }

    public visit(arg: SqlComponent): SqlPrintToken {
        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            return handler(arg);
        }
        throw new Error(`[SqlPrintTokenParser] No handler for kind: ${arg.getKind().toString()}`);
    }

    // ValueComponent系の各ノードのvisitメソッド
    private visitValueList(arg: ValueList): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.tokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.tokens.push(this.visit(arg.values[i]));
        }
        return token;
    }

    /**
     * Returns a fully qualified name (with namespaces) for a given object with namespaces and a name property.
     * The object must have: namespaces?: SqlComponent[], name: SqlComponent | column: SqlComponent
     */
    private getFullNameWithNamespaces(obj: { namespaces?: SqlComponent[] | null, name?: SqlComponent, column?: SqlComponent }): string {
        let fullName = '';
        if (Array.isArray(obj.namespaces) && obj.namespaces.length > 0) {
            fullName = obj.namespaces.map(ns => ns.accept(this).text).join('.') + '.';
        }
        if (obj.name) {
            fullName += obj.name.accept(this).text;
        } else if (obj.column) {
            fullName += obj.column.accept(this).text;
        }
        return fullName;
    }

    private visitColumnReference(arg: ColumnReference): SqlPrintToken {
        const fullName = this.getFullNameWithNamespaces({ namespaces: arg.namespaces, column: arg.column });
        return new SqlPrintToken(SqlPrintTokenType.value, fullName);
    }

    private visitFunctionCall(arg: FunctionCall): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');
        const fullName = this.getFullNameWithNamespaces({ namespaces: arg.namespaces, name: arg.name });
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.value, fullName));
        token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        if (arg.argument) {
            token.tokens.push(this.visit(arg.argument));
        }
        token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        if (arg.over) {
            token.tokens.push(this.visit(arg.over));
        }
        return token;
    }

    private visitUnaryExpression(arg: UnaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(this.visit(arg.operator));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.expression));

        return token;
    }

    private visitBinaryExpression(arg: BinaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(this.visit(arg.left));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.operator));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.right));

        return token;
    }

    private visitLiteralValue(arg: LiteralValue): SqlPrintToken {
        let text;
        if (typeof arg.value === "string") {
            text = `'${arg.value.replace(/'/g, "''")}'`;
        } else if (arg.value === null) {
            text = "null";
        } else {
            text = arg.value.toString();
        }
        return new SqlPrintToken(SqlPrintTokenType.value, text);
    }

    private visitParameterExpression(arg: ParameterExpression): SqlPrintToken {
        // Create a parameter token and decorate it using the parameterDecorator
        arg.index = this.index;
        const text = this.parameterDecorator.decorate(arg.name.value, arg.index)
        const token = new SqlPrintToken(SqlPrintTokenType.parameter, text);

        this.index++;
        return token;
    }

    private visitSwitchCaseArgument(arg: SwitchCaseArgument): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        for (const kv of arg.cases) {
            token.tokens.push(kv.accept(this));
        }
        if (arg.elseValue) {
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.tokens.push(this.createElseToken(arg.elseValue));
        }

        return token;
    }

    private createElseToken(elseValue: SqlComponent): SqlPrintToken {
        // Creates a token for the ELSE clause in a CASE expression.
        const elseToken = new SqlPrintToken(SqlPrintTokenType.container, '');
        elseToken.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'else'));
        elseToken.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        elseToken.tokens.push(this.visit(elseValue));
        return elseToken;
    }

    private visitCaseKeyValuePair(arg: CaseKeyValuePair): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'when'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.key));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.value));

        return token;

    }

    private visitRawString(arg: RawString): SqlPrintToken {
        return new SqlPrintToken(SqlPrintTokenType.value, arg.value);
    }

    private visitIdentifierString(arg: IdentifierString): SqlPrintToken {
        // Create an identifier token and decorate it using the identifierDecorator
        const text = this.identifierDecorator.decorate(arg.name)
        return new SqlPrintToken(SqlPrintTokenType.value, text);
    }

    private visitParenExpression(arg: ParenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.tokens.push(this.visit(arg.expression));
        token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitCastExpression(arg: CastExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(this.visit(arg.input));
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.operator, '::'));
        token.tokens.push(this.visit(arg.castType));

        return token;
    }

    private visitCaseExpression(arg: CaseExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'case'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.condition) {
            token.tokens.push(this.visit(arg.condition));
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }
        token.tokens.push(this.visit(arg.switchCase));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'end'));

        return token;
    }

    private visitArrayExpression(arg: ArrayExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'array'));
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '['));
        token.tokens.push(this.visit(arg.expression));
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ']'));

        return token;
    }

    private visitBetweenExpression(arg: BetweenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(this.visit(arg.expression));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.negated) {
            token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'not'));
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'between'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.lower));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'and'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.upper));

        return token;
    }

    private visitInlineQuery(arg: InlineQuery): SqlPrintToken {
        // サブクエリは一旦空で返す（SelectQuery対応時に実装）
        return new SqlPrintToken(SqlPrintTokenType.value, '');
    }

    private visitStringSpecifierExpression(arg: StringSpecifierExpression): SqlPrintToken {
        // Combine specifier and value into a single token
        const specifier = arg.specifier.accept(this).text;
        const value = arg.value.accept(this).text;
        return new SqlPrintToken(SqlPrintTokenType.value, specifier + value);
    }

    private visitTypeValue(arg: TypeValue): SqlPrintToken {
        // Compose full type name (with namespaces) as a single token
        const fullName = this.getFullNameWithNamespaces({ namespaces: arg.namespaces, name: arg.name });
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.type, fullName));
        // inner tokens (arguments)
        if (arg.argument) {
            token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            token.tokens.push(this.visit(arg.argument));
            token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }
        return token;
    }

    private visitTupleExpression(arg: TupleExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.tokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.tokens.push(this.visit(arg.values[i]));
        }
        token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitWindowFrameExpression(arg: WindowFrameExpression): SqlPrintToken {
        // Compose window frame expression: over(partition by ... order by ... rows ...)
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'over'));
        token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);

        let first = true;
        if (arg.partition) {
            token.tokens.push(this.visit(arg.partition));
            first = false;
        }
        if (arg.order) {
            if (!first) {
                token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                first = false;
            }
            token.tokens.push(this.visit(arg.order));
        }
        if (arg.frameSpec) {
            if (!first) {
                token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                first = false;
            }
            token.tokens.push(this.visit(arg.frameSpec));
        }
        token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitSelectItem(arg: SelectItem): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(this.visit(arg.value));

        if (!arg.identifier) {
            return token;
        }

        // No alias needed if it matches the default name
        if (arg.value instanceof ColumnReference) {
            const defaultName = arg.value.column.name;
            if (arg.identifier.name === defaultName) {
                return token;
            }
        }

        // Add alias if it is different from the default name
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.tokens.push(this.visit(arg.identifier));
        return token;
    }

    private visitSelectClause(arg: SelectClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'select'));
        token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        if (arg.distinct) {
            token.tokens.push(arg.distinct.accept(this));
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }

        for (let i = 0; i < arg.items.length; i++) {
            if (i > 0) {
                token.tokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.tokens.push(this.visit(arg.items[i]));
        }

        return token;
    }

    private visitDistinct(arg: Distinct): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct');
        return token;
    }

    private visitDistinctOn(arg: DistinctOn): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct on'));
        token.tokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.tokens.push(arg.value.accept(this));
        token.tokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitTableSource(arg: TableSource): SqlPrintToken {
        // Print table name with optional namespaces and alias
        let fullName = '';
        if (Array.isArray(arg.namespaces) && arg.namespaces.length > 0) {
            fullName = arg.namespaces.map(ns => ns.accept(this).text).join('.') + '.';
        }
        fullName += arg.table.accept(this).text;
        const token = new SqlPrintToken(SqlPrintTokenType.value, fullName);
        // alias (if present and different from table name)
        if (arg.identifier && arg.identifier.name !== arg.table.name) {

        }
        return token;
    }

    private visitSourceExpression(arg: SourceExpression): SqlPrintToken {
        // Print source expression (e.g. "table", "table as t", "schema.table t")
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');
        token.tokens.push(arg.datasource.accept(this));

        if (!arg.aliasExpression) {
            return token;
        }

        if (arg.datasource instanceof TableSource) {
            // No alias needed if it matches the default name
            const defaultName = arg.datasource.table.name;
            if (arg.aliasExpression.table.name === defaultName) {
                return token;
            }
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // exclude column aliases
            token.tokens.push(arg.aliasExpression.table.accept(this));
            return token;
        } else {
            // For other source types, just print the alias
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.tokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.tokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // included column aliases
            token.tokens.push(arg.aliasExpression.accept(this));
            return token;
        }
    }
}