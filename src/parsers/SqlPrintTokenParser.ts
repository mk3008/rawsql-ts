import { PartitionByClause, OrderByClause, OrderByItem, SelectClause, SelectItem, Distinct, DistinctOn, SortDirection, NullsSortDirection, TableSource, SourceExpression, FromClause, JoinClause, JoinOnClause, JoinUsingClause, FunctionSource, SourceAliasExpression, WhereClause, GroupByClause, HavingClause, SubQuerySource } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
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
    WindowFrameExpression,
    QualifiedName
} from "../models/ValueComponent";
import { IdentifierDecorator } from "./IdentifierDecorator";
import { ParameterDecorator } from "./ParameterDecorator";


export class SqlPrintTokenParser implements SqlComponentVisitor<SqlPrintToken> {
    // Static tokens for common symbols
    private static readonly SPACE_TOKEN = new SqlPrintToken(SqlPrintTokenType.space, ' ');
    private static readonly COMMA_TOKEN = new SqlPrintToken(SqlPrintTokenType.commna, ',');
    private static readonly PAREN_OPEN_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, '(');
    private static readonly PAREN_CLOSE_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, ')');
    private static readonly DOT_TOKEN = new SqlPrintToken(SqlPrintTokenType.dot, '.');

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
        this.handlers.set(QualifiedName.kind, (expr) => this.visitQualifiedName(expr as QualifiedName));
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

        // select
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.visitDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.visitDistinctOn(expr as DistinctOn));

        // from
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(FunctionSource.kind, (expr) => this.visitFunctionSource(expr as FunctionSource));
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(SourceAliasExpression.kind, (expr) => this.visitSourceAliasExpression(expr as SourceAliasExpression));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // where
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));

        // group
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));

        // Query
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleQuery(expr as SimpleSelectQuery));
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
    }

    /**
     * Returns an array of tokens representing a comma followed by a space.
     * This is a common pattern in SQL pretty-printing.
     */
    private static commaSpaceTokens(): SqlPrintToken[] {
        return [SqlPrintTokenParser.COMMA_TOKEN, SqlPrintTokenParser.SPACE_TOKEN];
    }

    private visitQualifiedName(arg: QualifiedName): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.QualifiedName);

        if (arg.namespaces) {
            for (let i = 0; i < arg.namespaces.length; i++) {
                token.innerTokens.push(arg.namespaces[i].accept(this));
                token.innerTokens.push(SqlPrintTokenParser.DOT_TOKEN);
            }
        }
        token.innerTokens.push(arg.name.accept(this));

        return token;
    }

    private visitPartitionByClause(arg: PartitionByClause): SqlPrintToken {
        // Print as: partition by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'partition by', SqlPrintTokenContainerType.PartitionByClause);
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.value));
        return token;
    }

    private visitOrderByClause(arg: OrderByClause): SqlPrintToken {
        // Print as: order by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'order by', SqlPrintTokenContainerType.OrderByClause);
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.order.length; i++) {
            if (i > 0) token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            token.innerTokens.push(this.visit(arg.order[i]));
        }
        return token;
    }

    /**
     * Print an OrderByItem (expression [asc|desc] [nulls first|last])
     */
    private visitOrderByItem(arg: OrderByItem): SqlPrintToken {
        // arg: OrderByItem
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.OrderByItem);
        token.innerTokens.push(this.visit(arg.value));

        if (arg.sortDirection && arg.sortDirection !== SortDirection.Ascending) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'desc'));
        }

        if (arg.nullsPosition) {
            if (arg.nullsPosition === NullsSortDirection.First) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'nulls first'));
            } else if (arg.nullsPosition === NullsSortDirection.Last) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, ' nulls last'));
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
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ValueList);
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.values[i]));
        }
        return token;
    }

    private visitColumnReference(arg: ColumnReference): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ColumnReference);
        token.innerTokens.push(arg.qualifiedName.accept(this));
        return token;
    }

    private visitFunctionCall(arg: FunctionCall): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.FunctionCall);

        token.innerTokens.push(arg.qualifiedName.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        if (arg.argument) {
            token.innerTokens.push(this.visit(arg.argument));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        if (arg.over) {
            token.innerTokens.push(this.visit(arg.over));
        }

        return token;
    }

    private visitUnaryExpression(arg: UnaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.UnaryExpression);

        token.innerTokens.push(this.visit(arg.operator));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));

        return token;
    }

    private visitBinaryExpression(arg: BinaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.BinaryExpression);

        token.innerTokens.push(this.visit(arg.left));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, arg.operator.value));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.right));

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
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            text,
            SqlPrintTokenContainerType.LiteralValue
        );
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
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SwitchCaseArgument);

        for (const kv of arg.cases) {
            token.innerTokens.push(kv.accept(this));
        }
        if (arg.elseValue) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.createElseToken(arg.elseValue));
        }

        return token;
    }

    private createElseToken(elseValue: SqlComponent): SqlPrintToken {
        // Creates a token for the ELSE clause in a CASE expression.
        const elseToken = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ElseClause);
        elseToken.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'else'));
        elseToken.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        elseToken.innerTokens.push(this.visit(elseValue));
        return elseToken;
    }

    private visitCaseKeyValuePair(arg: CaseKeyValuePair): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseKeyValuePair);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'when'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.key));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.value));

        return token;

    }

    private visitRawString(arg: RawString): SqlPrintToken {
        // Even for non-container tokens, set the container type for context
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            arg.value,
            SqlPrintTokenContainerType.RawString
        );
    }

    private visitIdentifierString(arg: IdentifierString): SqlPrintToken {
        // Create an identifier token and decorate it using the identifierDecorator
        const text = arg.name === "*" ? arg.name : this.identifierDecorator.decorate(arg.name)
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            text,
            SqlPrintTokenContainerType.IdentifierString
        );
    }

    private visitParenExpression(arg: ParenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ParenExpression);

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitCastExpression(arg: CastExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CastExpression);

        token.innerTokens.push(this.visit(arg.input));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, '::'));
        token.innerTokens.push(this.visit(arg.castType));

        return token;
    }

    private visitCaseExpression(arg: CaseExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseExpression);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'case'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.condition) {
            token.innerTokens.push(this.visit(arg.condition));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }
        token.innerTokens.push(this.visit(arg.switchCase));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'end'));

        return token;
    }

    private visitArrayExpression(arg: ArrayExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ArrayExpression);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'array'));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '['));
        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ']'));

        return token;
    }

    private visitBetweenExpression(arg: BetweenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.BetweenExpression);

        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.negated) {
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'not'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'between'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.lower));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'and'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.upper));

        return token;
    }

    private visitInlineQuery(arg: InlineQuery): SqlPrintToken {
        // サブクエリは一旦空で返す（SelectQuery対応時に実装）
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            '',
            SqlPrintTokenContainerType.InlineQuery
        );
    }

    private visitStringSpecifierExpression(arg: StringSpecifierExpression): SqlPrintToken {
        // Combine specifier and value into a single token
        const specifier = arg.specifier.accept(this).text;
        const value = arg.value.accept(this).text;
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            specifier + value,
            SqlPrintTokenContainerType.StringSpecifierExpression
        );
    }

    private visitTypeValue(arg: TypeValue): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.TypeValue);

        token.innerTokens.push(arg.qualifiedName.accept(this));
        if (arg.argument) {
            token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            token.innerTokens.push(this.visit(arg.argument));
            token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }

        return token;
    }

    private visitTupleExpression(arg: TupleExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.TupleExpression);

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.values[i]));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitWindowFrameExpression(arg: WindowFrameExpression): SqlPrintToken {
        // Compose window frame expression: over(partition by ... order by ... rows ...)
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.WindowFrameExpression);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'over'));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);

        const overArgument = this.createOverClauseArgument(arg);
        if (overArgument) {
            token.innerTokens.push(overArgument);
        }

        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private createOverClauseArgument(arg: WindowFrameExpression): SqlPrintToken | null {
        const overArgument = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.OverClauseArgument);
        let first = true;
        if (arg.partition) {
            overArgument.innerTokens.push(this.visit(arg.partition));
            first = false;
        }
        if (arg.order) {
            if (!first) {
                overArgument.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                first = false;
            }
            overArgument.innerTokens.push(this.visit(arg.order));
        }
        if (arg.frameSpec) {
            if (!first) {
                overArgument.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                first = false;
            }
            overArgument.innerTokens.push(this.visit(arg.frameSpec));
        }
        if (first) {
            return null; // No arguments to print
        }
        return overArgument;
    }


    private visitSelectItem(arg: SelectItem): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SelectItem);

        token.innerTokens.push(this.visit(arg.value));

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
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.identifier));
        return token;
    }

    private visitSelectClause(arg: SelectClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'select', SqlPrintTokenContainerType.SelectClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        if (arg.distinct) {
            token.keywordTokens = [];
            token.keywordTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.keywordTokens.push(arg.distinct.accept(this));
        }

        for (let i = 0; i < arg.items.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.items[i]));
        }

        return token;
    }

    private visitDistinct(arg: Distinct): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct');
        return token;
    }

    private visitDistinctOn(arg: DistinctOn): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.DistinctOn);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct on'));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(arg.value.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

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
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SourceExpression);
        token.innerTokens.push(arg.datasource.accept(this));

        if (!arg.aliasExpression) {
            return token;
        }

        if (arg.datasource instanceof TableSource) {
            // No alias needed if it matches the default name
            const defaultName = arg.datasource.table.name;
            if (arg.aliasExpression.table.name === defaultName) {
                return token;
            }
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // exclude column aliases
            token.innerTokens.push(arg.aliasExpression.table.accept(this));
            return token;
        } else {
            // For other source types, just print the alias
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // included column aliases
            token.innerTokens.push(arg.aliasExpression.accept(this));
            return token;
        }
    }

    public visitFromClause(arg: FromClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'from', SqlPrintTokenContainerType.FromClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.source));

        if (arg.joins) {
            for (let i = 0; i < arg.joins.length; i++) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(this.visit(arg.joins[i]));
            }
        }

        return token;
    }

    public visitJoinClause(arg: JoinClause): SqlPrintToken {
        // Print join clause: [joinType] [lateral] [source] [on/using ...]
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinClause);

        // join type (e.g. inner join, left join, etc)
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.joinType.value));
        if (arg.lateral) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'lateral'));
        }
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.source));

        if (arg.condition) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.visit(arg.condition));
        }

        return token;
    }

    public visitJoinOnClause(arg: JoinOnClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinOnClause);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'on'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    public visitJoinUsingClause(arg: JoinUsingClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinUsingClause);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'using'));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    public visitFunctionSource(arg: FunctionSource): SqlPrintToken {
        // Print function source: [functionName]([args])
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.FunctionSource);

        token.innerTokens.push(this.visit(arg.name));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        if (arg.argument) {
            token.innerTokens.push(this.visit(arg.argument));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        return token;
    }

    public visitSourceAliasExpression(arg: SourceAliasExpression): SqlPrintToken {
        // Print source alias expression: [source] as [alias]
        const token = new SqlPrintToken(
            SqlPrintTokenType.container,
            '',
            SqlPrintTokenContainerType.SourceAliasExpression
        );

        token.innerTokens.push(this.visit(arg.table));

        if (arg.columns) {
            token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            for (let i = 0; i < arg.columns.length; i++) {
                if (i > 0) {
                    token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
                }
                token.innerTokens.push(this.visit(arg.columns[i]));
            }
            token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }

        return token;
    }

    public visitWhereClause(arg: WhereClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'where', SqlPrintTokenContainerType.WhereClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    public visitGroupByClause(arg: GroupByClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'group by', SqlPrintTokenContainerType.GroupByClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.grouping.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.grouping[i]));
        }

        return token;
    }

    public visitHavingClause(arg: HavingClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'having', SqlPrintTokenContainerType.HavingClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    // query
    public visitSimpleQuery(arg: SimpleSelectQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SimpleSelectQuery);

        token.innerTokens.push(arg.selectClause.accept(this));

        if (!arg.fromClause) {
            return token;
        }

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.fromClause.accept(this));

        if (arg.whereClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.whereClause.accept(this));
        }

        if (arg.groupByClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.groupByClause.accept(this));
        }

        if (arg.havingClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.havingClause.accept(this));
        }

        if (arg.orderByClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.orderByClause.accept(this));
        }

        return token;
    }

    public visitSubQuerySource(arg: SubQuerySource): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SubQuerySource);

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(arg.query.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }
}
