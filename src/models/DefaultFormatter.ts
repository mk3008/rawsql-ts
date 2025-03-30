import { SelectQuery } from "./SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "./SqlComponent";
import {
    LiteralValue,
    RawString,
    IdentifierString,
    ColumnReference,
    FunctionCall,
    UnaryExpression,
    BinaryExpression,
    ParameterExpression,
    ArrayExpression,
    CaseExpression,
    CastExpression,
    ParenExpression,
    BetweenExpression,
    SwitchCaseArgument,
    ValueList,
    CaseKeyValuePair,
    StringSpecifierExpression,
    TypeValue,
    WindowFrameExpression,
    WindowFrameSpec,
    WindowFrameBound,
    WindowFrameBoundaryValue,
    WindowFrameType,
    WindowFrameBoundStatic
} from "./ValueComponent";
import { CommonTable, CommonTableSource, Distinct, DistinctOn, FetchSpecification, FetchType, ForClause, FromClause, FunctionSource, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, NullsSortDirection, OrderByClause, OrderByItem, PartitionByClause, SelectClause, SelectItem, SortDirection, SourceAliasExpression, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WithClause } from "./Clause";

interface FormatterConfig {
    identifierEscape: {
        start: string;
        end: string;
    };
    parameterSymbol: string;
}

export class DefaultFormatter implements SqlComponentVisitor<string> {
    private handlers: Map<symbol, (arg: any) => string>;
    private config: FormatterConfig;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => string>();

        // デフォルト設定
        this.config = {
            identifierEscape: {
                start: '"',
                end: '"'
            },
            parameterSymbol: ':' // PostgreSQLスタイルをデフォルトに
        };

        // value
        this.handlers.set(LiteralValue.kind, (expr) => this.decodeLiteralExpression(expr as LiteralValue));
        this.handlers.set(RawString.kind, (expr) => this.decodeRawString(expr as RawString));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.decodeStringSpecifierExpression(expr as StringSpecifierExpression));
        this.handlers.set(IdentifierString.kind, (expr) => this.decodeIdentifierString(expr as IdentifierString));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.decodeSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(ValueList.kind, (expr) => this.decodeValueList(expr as ValueList));
        this.handlers.set(ColumnReference.kind, (expr) => this.decodeColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, (expr) => this.decodeFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.decodeUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.decodeBinaryExpression(expr as BinaryExpression));
        this.handlers.set(ParameterExpression.kind, (expr) => this.decodeParameterExpression(expr as ParameterExpression));
        this.handlers.set(SelectItem.kind, (expr) => this.decodeSelectExpression(expr as SelectItem));
        this.handlers.set(ArrayExpression.kind, (expr) => this.decodeArrayExpression(expr as ArrayExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.decodeCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.decodeCastExpression(expr as CastExpression));
        this.handlers.set(ParenExpression.kind, (expr) => this.decodeBracketExpression(expr as ParenExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.decodeBetweenExpression(expr as BetweenExpression));
        this.handlers.set(TypeValue.kind, (expr) => this.decodeTypeValue(expr as TypeValue));

        // source alias
        this.handlers.set(SourceAliasExpression.kind, (expr) => this.decodeSourceAliasExpression(expr as SourceAliasExpression));

        // from
        this.handlers.set(FromClause.kind, (expr) => this.decodeFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.decodeJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.decodeJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.decodeJoinUsingClause(expr as JoinUsingClause));

        this.handlers.set(SourceExpression.kind, (expr) => this.decodeSourceExpression(expr as SourceExpression));
        this.handlers.set(SubQuerySource.kind, (expr) => this.decodeSubQuerySource(expr as SubQuerySource));
        this.handlers.set(FunctionSource.kind, (expr) => this.decodeFunctionSource(expr as FunctionSource));
        this.handlers.set(TableSource.kind, (expr) => this.decodeTableSource(expr as TableSource));
        this.handlers.set(CommonTableSource.kind, (expr) => this.decodeCommonTableSource(expr as CommonTableSource));

        // order by
        this.handlers.set(OrderByClause.kind, (expr) => this.decodeOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.decodeOrderByItem(expr as OrderByItem));

        // partition by
        this.handlers.set(PartitionByClause.kind, (expr) => this.decodePartitionByClause(expr as PartitionByClause));

        // window frame
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.decodeWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(WindowFrameSpec.kind, (arg) => this.decodeWindowFrameSpec(arg));
        this.handlers.set(WindowFrameBoundStatic.kind, (arg) => this.decodeWindowFrameBoundStatic(arg as WindowFrameBoundStatic));
        this.handlers.set(WindowFrameBoundaryValue.kind, (arg) => this.decodeWindowFrameBoundaryValue(arg as WindowFrameBoundaryValue));

        // where
        this.handlers.set(WhereClause.kind, (expr) => this.decodeWhereClause(expr as WhereClause));

        // group by
        this.handlers.set(GroupByClause.kind, (expr) => this.decodeGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.decodeHavingClause(expr as HavingClause));

        // with
        this.handlers.set(CommonTable.kind, (expr) => this.decodeCommonTable(expr as CommonTable));
        this.handlers.set(WithClause.kind, (expr) => this.decodeWithClause(expr as WithClause));

        // select
        this.handlers.set(SelectItem.kind, (expr) => this.decodeSelectExpression(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.decodeSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.decodeDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.decodeDistinctOn(expr as DistinctOn));

        // row limit
        this.handlers.set(LimitClause.kind, (expr) => this.decodeLimitClause(expr as LimitClause));
        this.handlers.set(FetchSpecification.kind, (expr) => this.decodeFetchSpecification(expr as FetchSpecification));

        // for clause
        this.handlers.set(ForClause.kind, (expr) => this.decodeForClause(expr as ForClause));

        // select query
        this.handlers.set(SelectQuery.kind, (expr) => this.decodeSelectQuery(expr as SelectQuery));
    }

    visit(arg: SqlComponent): string {
        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            return handler(arg);
        }
        throw new Error(`No handler ${arg}`);
    }

    decodeWindowFrameBoundaryValue(arg: WindowFrameBoundaryValue): string {
        const value = arg.value.accept(this);
        const following = arg.isFollowing ? "following" : "preceding";
        return `${value} ${following}`;
    }

    decodeWindowFrameBoundStatic(arg: WindowFrameBoundStatic): string {
        switch (arg.bound) {
            case WindowFrameBound.UnboundedPreceding:
                return "unbounded preceding";
            case WindowFrameBound.CurrentRow:
                return "current row";
            case WindowFrameBound.UnboundedFollowing:
                return "unbounded following";
            default:
                throw new Error(`Unknown WindowFrameBound: ${arg.bound}`);
        }
    }

    decodeWindowFrameExpression(arg: WindowFrameExpression): string {
        const partitionBy = arg.partition !== null ? arg.partition.accept(this) : null;
        const orderBy = arg.order !== null ? arg.order.accept(this) : null;
        const frameSpec = arg.frameSpec !== null ? arg.frameSpec.accept(this) : null;

        const parts: string[] = [];
        if (partitionBy) parts.push(partitionBy);
        if (orderBy) parts.push(orderBy);
        if (frameSpec) parts.push(frameSpec);

        if (parts.length > 0) {
            return `(${parts.join(" ")})`;
        }
        return `()`;
    }

    decodeWindowFrameSpec(arg: WindowFrameSpec): string {
        const frameType = arg.frameType;
        const startBound = arg.startBound.accept(this);

        if (arg.endBound === null) {
            return `${frameType} ${startBound}`;
        } else {
            const endBound = arg.endBound.accept(this);
            return `${frameType} between ${startBound} and ${endBound}`;
        }
    }

    decodeJoinUsingClause(arg: JoinUsingClause): string {
        return `using (${arg.condition.accept(this)})`;
    }

    decodeJoinOnClause(arg: JoinOnClause): string {
        if (arg.condition !== null) {
            return `on ${arg.condition.accept(this)}`;
        }
        return `on`;
    }

    decodeTypeValue(arg: TypeValue): string {
        if (arg.argument !== null) {
            return `${arg.type.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.type.accept(this)}`;
    }

    decodeStringSpecifierExpression(arg: StringSpecifierExpression): string {
        return `${arg.specifier.accept(this)}${arg.value.accept(this)}`;
    }

    decodeWithClause(arg: WithClause): string {
        const part = arg.tables.map((e) => e.accept(this)).join(", ");
        return `with ${arg.recursive ? 'recursive' : ''} ${part}`;
    }

    decodeCommonTable(arg: CommonTable): string {
        const alias = arg.name.accept(this);
        const materil = arg.materialized === null
            ? ''
            : arg.materialized ? 'materialized' : 'not materialized';

        if (alias && materil) {
            return `${alias} ${materil} as(${arg.query.accept(this)})`;
        }
        return `${alias} as(${arg.query.accept(this)})`;
    }

    decodeDistinctOn(arg: DistinctOn): string {
        return `distinct on(${arg.value.accept(this)})`;
    }
    decodeDistinct(arg: Distinct): string {
        return `distinct`;
    }

    decodeHavingClause(arg: HavingClause): string {
        return `having ${arg.condition.accept(this)}`;
    }
    decodeGroupByClause(arg: GroupByClause): string {
        const part = arg.grouping.map((e) => e.accept(this)).join(", ");
        return `group by ${part}`;
    }

    decodeCommonTableSource(arg: CommonTableSource): string {
        return `${arg.name.accept(this)}`;
    }

    decodeFromClause(arg: FromClause): string {
        if (arg.joins !== null && arg.joins.length > 0) {
            const part = arg.joins.map((e) => e.accept(this)).join(" ");
            return `from ${arg.source.accept(this)} ${part}`;
        }
        return `from ${arg.source.accept(this)}`;
    }

    decodeJoinClause(arg: JoinClause): string {
        const joinType = `${arg.joinType.accept(this)}`;
        const lateral = arg.lateral === true ? ` lateral` : "";
        const joinSource = arg.source.accept(this);
        const condition = arg.condition !== null ? ` ${arg.condition.accept(this)}` : "";
        return `${joinType}${lateral} ${joinSource}${condition}`;
    }

    decodeSourceAliasExpression(arg: SourceAliasExpression): string {
        const columnAlias = arg.columns !== null ? `(${arg.columns.map((e) => e.accept(this)).join(", ")})` : null;
        const tableAlias = arg.table !== null ? `${arg.table.accept(this)}` : "";

        if (columnAlias && tableAlias) {
            return `${tableAlias}${columnAlias}`;
        }
        if (tableAlias) {
            return tableAlias;
        }
        throw new Error("Invalid SourceAliasExpression: tableAlias is null");
    }

    decodeSourceExpression(arg: SourceExpression): string {
        let alias = arg.name !== null ? `${arg.name.accept(this)}` : "";

        // Avoid duplicate alias if the name is the same as the alias
        if (arg.datasource instanceof TableSource) {
            if (arg.name !== null && arg.datasource.name !== null && arg.datasource.name.accept(this) === arg.name.accept(this)) {
                alias = "";
            }
        }

        if (alias) {
            return `${arg.datasource.accept(this)} as ${alias}`;
        }
        return `${arg.datasource.accept(this)}`;
    }

    decodeSubQuerySource(arg: SubQuerySource): string {
        return `(${arg.query.accept(this)})`;
    }

    decodeFunctionSource(arg: FunctionSource): string {
        if (arg.argument !== null) {
            return `${arg.name.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.name.accept(this)}()`;
    }
    decodeTableSource(arg: TableSource): string {
        if (arg.namespaces !== null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.table.accept(this)}`;
        }
        return `${arg.table.accept(this)}`;
    }

    decodeValueList(arg: ValueList): string {
        return `${arg.values.map((v) => v.accept(this)).join(", ")}`;
    }

    decodeSwitchCaseArgument(arg: SwitchCaseArgument): string {
        const casePart = arg.casePairs.map((kv: CaseKeyValuePair) => `when ${kv.key.accept(this)} then ${kv.value.accept(this)}`).join(" ");
        const elsePart = arg.elseValue ? ` else ${arg.elseValue.accept(this)}` : "";
        return `${casePart}${elsePart}`;
    }

    decodeColumnReference(arg: ColumnReference): string {
        if (arg.namespaces != null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.column.accept(this)}`;
        }
        return `${arg.column.accept(this)}`;
    }

    decodeFunctionCall(arg: FunctionCall): string {
        const partArg = arg.argument !== null ? arg.argument.accept(this) : "";

        if (arg.over === null) {
            return `${arg.name.accept(this)}(${partArg})`;
        } else {
            let partOver = arg.over !== null ? `${arg.over.accept(this)}` : "";
            if (partOver) {
                if (partOver.startsWith("(")) {
                    partOver = ` over${partOver}`;
                } else {
                    partOver = ` over ${partOver}`;
                }
            }
            return `${arg.name.accept(this)}(${partArg})${partOver}`;
        }
    }

    decodeUnaryExpression(arg: UnaryExpression): string {
        return `${arg.operator.accept(this)} ${arg.expression.accept(this)}`;
    }

    decodeBinaryExpression(arg: BinaryExpression): string {
        return `${arg.left.accept(this)} ${arg.operator.accept(this)} ${arg.right.accept(this)}`;
    }

    decodeLiteralExpression(arg: LiteralValue): string {
        if (typeof arg.value === "string") {
            return `'${arg.value.replace(/'/g, "''")}'`;
        } else if (arg.value === null) {
            return "null";
        }
        return arg.value.toString();
    }

    decodeParameterExpression(arg: ParameterExpression): string {
        return `${this.config.parameterSymbol}${arg.name.accept(this)}`;
    }

    decodeSelectExpression(arg: SelectItem): string {
        if (arg.name !== null) {
            if (arg.value instanceof ColumnReference) {
                const c = arg.value as ColumnReference;
                if (c.column.name === arg.name.name) {
                    return `${arg.value.accept(this)}`;
                } else {
                    return `${arg.value.accept(this)} as ${arg.name.accept(this)}`;
                }
            }
            return `${arg.value.accept(this)} as ${arg.name.accept(this)}`;
        }
        return arg.value.accept(this);
    }

    decodeSelectClause(arg: SelectClause): string {
        const distinct = arg.distinct !== null ? " " + arg.distinct.accept(this) : "";
        const colum = arg.items.map((e) => e.accept(this)).join(", ");
        return `select${distinct} ${colum}`;
    }

    decodeSelectQuery(arg: SelectQuery): string {
        return arg.selectClause.accept(this);
    }

    decodeArrayExpression(arg: ArrayExpression): string {
        return `array[${arg.expression.accept(this)}]`;
    }

    decodeCaseExpression(arg: CaseExpression): string {
        if (arg.condition !== null) {
            return `case ${arg.condition.accept(this)} ${arg.switchCase.accept(this)} end`;
        }
        return `case ${arg.switchCase.accept(this)} end`;
    }

    decodeCastExpression(arg: CastExpression): string {
        return `${arg.input.accept(this)}::${arg.castType.accept(this)}`;
    }

    decodeBracketExpression(arg: ParenExpression): string {
        return `(${arg.expression.accept(this)})`;
    }

    decodeBetweenExpression(arg: BetweenExpression): string {
        if (arg.negated) {
            return `${arg.expression.accept(this)} not between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
        }
        return `${arg.expression.accept(this)} between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
    }

    decodePartitionByClause(arg: PartitionByClause): string {
        return `partition by ${arg.value.accept(this)}`;
    }

    decodeOrderByClause(arg: OrderByClause): string {
        const part = arg.order.map((e) => e.accept(this)).join(", ");
        return `order by ${part}`;
    }

    decodeOrderByItem(arg: OrderByItem): string {
        const direction = arg.sortDirection === SortDirection.Ascending ? null : "desc";
        const nullsOption = arg.nullsPosition !== null ? (arg.nullsPosition === NullsSortDirection.First ? "nulls first" : "nulls last") : null;

        if (direction !== null && nullsOption !== null) {
            return `${arg.value.accept(this)} ${direction} ${nullsOption}`;
        } else if (direction !== null) {
            return `${arg.value.accept(this)} ${direction}`;
        } else if (nullsOption !== null) {
            return `${arg.value.accept(this)} ${nullsOption}`;
        }
        return arg.value.accept(this);
    }

    decodeWindowFrameClause(arg: WindowFrameClause): string {
        const partExpr = arg.expression.accept(this);
        return `${arg.name.accept(this)} as ${partExpr}`;
    }

    decodeLimitClause(arg: LimitClause): string {
        if (arg.offset !== null) {
            return `limit ${arg.limit.accept(this)} offset ${arg.offset.accept(this)}`;
        }
        return `limit ${arg.limit.accept(this)}`;
    }

    decodeFetchSpecification(arg: FetchSpecification): string {
        const type = arg.type === FetchType.First ? 'first' : 'next';
        const count = arg.count.accept(this);

        if (arg.unit !== null) {
            return `fetch ${type} ${count} ${arg.unit}`;
        }
        return `fetch ${type} ${count}`;
    }

    decodeForClause(arg: ForClause): string {
        return `for ${arg.lockMode}`;
    }

    decodeWhereClause(arg: WhereClause): string {
        return `where ${arg.condition.accept(this)}`;
    }

    decodeRawString(arg: RawString): string {
        const invalidChars = new Set(["'", '"', ",", ";", ":", ".", "--", "/*"]);
        if (invalidChars.has(arg.keyword)) {
            throw new Error(`invalid keyword: ${arg.keyword} `);
        } else if (arg.keyword.trim() === "") {
            throw new Error("invalid keyword: empty string");
        }
        return arg.keyword.trim();
    }

    decodeIdentifierString(arg: IdentifierString): string {
        // No need to escape wildcards
        if (arg.name === '*') {
            return arg.name;
        }
        return `${this.config.identifierEscape.start}${arg.name}${this.config.identifierEscape.end}`;
    }
}