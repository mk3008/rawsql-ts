import { OrderByClause, OrderByCollection, OrderExpression as OrderByExpression, SortDirection, NullsSortDirection } from "./OrderByClause";
import { SelectExpression, SelectClause, SelectCollection } from "./SelectClause";
import { SelectQuery } from "./SelectQuery";
import { SqlComponent, SqlComponentVisitor, SqlDialectConfiguration } from "./SqlComponent";
import { LiteralValue, RawString, IdentifierString, TrimArgument, ExtractArgument, SubstringFromForArgument, SubstringSimilarEscapeArgument, OverlayPlacingFromForArgument, ColumnReference, FunctionCall, UnaryExpression, BinaryExpression, ParameterExpression, ArrayExpression, CaseExpression, CastExpression, ParenExpression, BetweenExpression, PositionExpression, JsonKeyValuePair, SwitchCaseArgument, ValueCollection, JsonStructureArgument, CaseKeyValuePair } from "./ValueComponent";
import { WhereClause } from "./WhereClause";
import { PartitionByClause, OverClause, WindowFrameClause } from "./WindowClause";

export class SelectQueryFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (expr: SqlComponent) => string>();

    config: SqlDialectConfiguration;

    constructor(config: SqlDialectConfiguration) {
        this.config = config;
        //this.handlers.set(ColumnReference.kind, expr => this.decodeColumnReference(expr as ColumnReference));
        //this.handlers.set(FunctionCall.kind, expr => this.decodeFunctionCall(expr as FunctionCall));
        //this.handlers.set(UnaryExpression.kind, expr => this.decodeUnaryExpression(expr as UnaryExpression));
        //this.handlers.set(BinaryExpression.kind, expr => this.decodeBinaryExpression(expr as BinaryExpression));
        //this.handlers.set(LiteralValue.kind, expr => this.decodeLiteralExpression(expr as LiteralValue));
        //this.handlers.set(ParameterExpression.kind, expr => this.decodeParameterExpression(expr as ParameterExpression));
        //this.handlers.set(SelectExpression.kind, expr => this.decodeSelectExpression(expr as SelectExpression));
        //this.handlers.set(SelectClause.kind, expr => this.decodeSelectClause(expr as SelectClause));
        //this.handlers.set(SelectQuery.kind, expr => this.decodeSelectQuery(expr as SelectQuery));
    }

    visit(expr: SqlComponent): string {
        const handler = this.handlers.get(expr.getKind());
        return handler ? handler(expr) : `Unknown Expression`;
    }
}

export class ValueExpressionFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (expr: SqlComponent) => string>();

    config: SqlDialectConfiguration;

    constructor(config: SqlDialectConfiguration | null = null) {
        this.config = config !== null ? config : new SqlDialectConfiguration();

        this.handlers.set(LiteralValue.kind, (expr) => this.decodeLiteralExpression(expr as LiteralValue));
        this.handlers.set(RawString.kind, (expr) => this.decodeRawString(expr as RawString));
        this.handlers.set(IdentifierString.kind, (expr) => this.decodeIdentifierString(expr as IdentifierString));
        this.handlers.set(JsonKeyValuePair.kind, (expr) => this.decodeJsonKeyValuePair(expr as JsonKeyValuePair));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.decodeSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(ValueCollection.kind, (expr) => this.decodeValueCollection(expr as ValueCollection));
        this.handlers.set(JsonStructureArgument.kind, (expr) => this.decodeJsonStructureArgument(expr as JsonStructureArgument));
        this.handlers.set(TrimArgument.kind, (expr) => this.decodeTrimArgument(expr as TrimArgument));
        this.handlers.set(ExtractArgument.kind, (expr) => this.decodeExtractArgument(expr as ExtractArgument));
        this.handlers.set(SubstringFromForArgument.kind, (expr) => this.decodeSubstringFromForArgument(expr as SubstringFromForArgument));
        this.handlers.set(ColumnReference.kind, (expr) => this.decodeColumnReference(expr as ColumnReference));

        this.handlers.set(FunctionCall.kind, (expr) => this.decodeFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.decodeUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.decodeBinaryExpression(expr as BinaryExpression));
        this.handlers.set(ParameterExpression.kind, (expr) => this.decodeParameterExpression(expr as ParameterExpression));
        this.handlers.set(SelectExpression.kind, (expr) => this.decodeSelectExpression(expr as SelectExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.decodeArrayExpression(expr as ArrayExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.decodeCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.decodeCastExpression(expr as CastExpression));
        this.handlers.set(ParenExpression.kind, (expr) => this.decodeBracketExpression(expr as ParenExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.decodeBetweenExpression(expr as BetweenExpression));
        this.handlers.set(PositionExpression.kind, (expr) => this.decodePositionExpression(expr as PositionExpression));
        this.handlers.set(SubstringSimilarEscapeArgument.kind, (expr) => this.decodeSubstringSimilarEscapeArgument(expr as SubstringSimilarEscapeArgument));
        this.handlers.set(OverlayPlacingFromForArgument.kind, (expr) => this.decodeOverlayPlacingFromForArgument(expr as OverlayPlacingFromForArgument));

        // order by
        this.handlers.set(OrderByClause.kind, (expr) => this.decodeOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByCollection.kind, (expr) => this.decodeOrderByCollection(expr as OrderByCollection));
        this.handlers.set(OrderByExpression.kind, (expr) => this.decodeOrderByExpression(expr as OrderByExpression));

        // window
        this.handlers.set(PartitionByClause.kind, (expr) => this.decodePartitionByClause(expr as PartitionByClause));
        this.handlers.set(OverClause.kind, (expr) => this.decodeOverClause(expr as OverClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.decodeWindowFrameClause(expr as WindowFrameClause));


        this.handlers.set(WhereClause.kind, (expr) => this.decodeWhereClause(expr as WhereClause));

        this.handlers.set(SelectExpression.kind, (expr) => this.decodeSelectExpression(expr as SelectExpression));
        this.handlers.set(SelectCollection.kind, (expr) => this.decodeSelectCollection(expr as SelectCollection));
        this.handlers.set(SelectClause.kind, (expr) => this.decodeSelectClause(expr as SelectClause));
        this.handlers.set(SelectQuery.kind, (expr) => this.decodeSelectQuery(expr as SelectQuery));
    }

    decodeSelectCollection(expr: SelectCollection): string {
        return `${expr.collection.map((e) => e.accept(this)).join(", ")}`;
    }

    decodeJsonStructureArgument(expr: JsonStructureArgument): string {
        return `jsonb_build_object(${expr.keyValuePairs.map((kv) => kv.accept(this)).join(", ")})`;
    }
    decodeJsonKeyValuePair(expr: JsonKeyValuePair): string {
        const key = expr.key.accept(this);
        const value = expr.value.accept(this);
        return `${key}, ${value}`;
    }

    decodeValueCollection(expr: ValueCollection): string {
        return `(${expr.values.map((v) => v.accept(this)).join(", ")})`;
    }

    decodeSwitchCaseArgument(expr: SwitchCaseArgument): string {
        const casePart = expr.casePairs.map((kv: CaseKeyValuePair) => `when ${kv.key.accept(this)} then ${kv.value.accept(this)} `).join(" ");
        const elsePart = expr.elseValue ? ` else ${expr.elseValue.accept(this)} ` : "";
        return `${casePart}${elsePart}`;
    }

    visit(expr: SqlComponent): string {
        const handler = this.handlers.get(expr.getKind());
        return handler ? handler(expr) : `Unknown Expression`;
    }

    decodeOverlayPlacingFromForArgument(expr: OverlayPlacingFromForArgument): string {
        const start = expr.start ? `start ${expr.start.accept(this)}` : "";
        const length = expr.length ? `length ${expr.length.accept(this)}` : "";
        if (start && length) {
            return `${expr.input.accept(this)} overlay (${expr.replacement.accept(this)}) ${start} ${length}`;
        } else if (start) {
            return `${expr.input.accept(this)} overlay (${expr.replacement.accept(this)}) ${start})`;
        } else if (length) {
            return `${expr.input.accept(this)} overlay (${expr.replacement.accept(this)}) ${length})`;
        }
        return `${expr.input.accept(this)} overlay (${expr.replacement.accept(this)})`;
    }

    decodeSubstringSimilarEscapeArgument(expr: SubstringSimilarEscapeArgument): string {
        return `${expr.input.accept(this)} similar escape ${expr.escape.accept(this)} ${expr.pattern.accept(this)}`;
    }

    // Add the missing method
    decodeSubstringFromForArgument(expr: SubstringFromForArgument): string {
        const start = expr.start ? `start ${expr.start.accept(this)}` : "";
        const length = expr.length ? `length ${expr.length.accept(this)}` : "";
        if (start && length) {
            return `${expr.input.accept(this)} ${start} ${length}`;
        } else if (start) {
            return `${expr.input.accept(this)} ${start})`;
        } else if (length) {
            return `${expr.input.accept(this)} ${length})`;
        }
        return `${expr.input.accept(this)}`;
    }

    decodeColumnReference(expr: ColumnReference): string {
        if (expr.namespaces.length > 0) {
            return `${expr.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${expr.column.accept(this)}`;
        }
        return `${expr.column.accept(this)}`;
    }

    decodeFunctionCall(expr: FunctionCall): string {
        if (expr.argument !== null) {
            return `${expr.name.accept(this)}(${expr.argument.accept(this)})`;
        }
        return `${expr.name.accept(this)}()`;
    }

    decodeUnaryExpression(expr: UnaryExpression): string {
        return `${expr.operator.accept(this)} ${expr.expression.accept(this)}`;
    }

    decodeBinaryExpression(expr: BinaryExpression): string {
        return `${expr.left.accept(this)} ${expr.operator.accept(this)} ${expr.right.accept(this)}`;
    }

    decodeLiteralExpression(expr: LiteralValue): string {
        if (typeof expr.value === "string") {
            const option = expr.escapeOption !== null ? ` uescape '${expr.escapeOption.replace(/'/g, "''")}'` : "";
            return `'${expr.value.replace(/'/g, "''")}'${option}`;
        } else if (expr.value === null) {
            return "null";
        }
        return expr.value.toString();
    }

    decodeParameterExpression(expr: ParameterExpression): string {
        return `${this.config.parameterSymbol}${expr.name}`;
    }

    decodeSelectExpression(expr: SelectExpression): string {
        if (expr.alias !== null) {
            return `${expr.expression.accept(this)} as ${expr.alias}`;
        }
        return expr.expression.accept(this);
    }

    decodeSelectClause(expr: SelectClause): string {
        return expr.expression.accept(this);
    }

    decodeSelectQuery(expr: SelectQuery): string {
        return `select ${expr.selectClause.accept(this)}`;
    }

    decodeArrayExpression(expr: ArrayExpression): string {
        return `array[${expr.expression.accept(this)}]`;
    }

    decodeCaseExpression(expr: CaseExpression): string {
        const casePart = expr.casePairs.accept(this);
        const elsePart = expr.elseValue ? ` else ${expr.elseValue.accept(this)} ` : "";
        if (expr.condition !== null) {
            if (expr.elseValue !== null) {
                return `case ${expr.condition.accept(this)} ${casePart}${elsePart} end`;
            }
            return `case ${expr.condition.accept(this)} ${casePart} end`;
        } else {
            if (expr.elseValue !== null) {
                return `case ${casePart}${elsePart} end`;
            }
            return `case ${casePart} end`;
        }
    }

    decodeCastExpression(expr: CastExpression): string {
        return `${expr.expression.accept(this)}::${expr.castType.accept(this)} `;
    }

    decodeBracketExpression(expr: ParenExpression): string {
        return `(${expr.expression.accept(this)})`;
    }

    decodeBetweenExpression(expr: BetweenExpression): string {
        return `${expr.expression.accept(this)} between ${expr.lower.accept(this)} and ${expr.upper.accept(this)} `;
    }

    decodePositionExpression(expr: PositionExpression): string {
        return `position(${expr.needle.accept(this)} in ${expr.haystack.accept(this)})`;
    }

    decodePartitionByClause(expr: PartitionByClause): string {
        return `partition by ${expr.expression.accept(this)} `;
    }


    decodeOrderByClause(expr: OrderByClause): string {
        return `order by ${expr.expression.accept(this)} `;
    }

    decodeOrderByCollection(expr: OrderByCollection): string {
        return `${expr.expressions.map((e) => e.accept(this)).join(", ")}`;
    }

    decodeOrderByExpression(expr: OrderByExpression): string {
        const direction = expr.sortDirection === SortDirection.Ascending ? null : "desc";
        const nullsOption = expr.nullsPosition !== null ? (expr.nullsPosition === NullsSortDirection.First ? "nulls first" : "nulls last") : null;

        if (direction !== null && nullsOption !== null) {
            return `${expr.expression.accept(this)} ${direction} ${nullsOption} `;
        } else if (direction !== null) {
            return `${expr.expression.accept(this)} ${direction} `;
        } else if (nullsOption !== null) {
            return `${expr.expression.accept(this)} ${nullsOption} `;
        }
        return expr.expression.accept(this);
    }

    decodeOverClause(expr: OverClause): string {
        if (expr.windowFrameAlias !== null) {
            return `over ${expr.windowFrameAlias} `;
        } else if (expr.partitionBy !== null && expr.orderBy) {
            return `over(${expr.partitionBy.accept(this)} ${expr.orderBy.accept(this)})`;
        } else if (expr.partitionBy !== null) {
            return `over(${expr.partitionBy.accept(this)})`;
        } else if (expr.orderBy !== null) {
            return `over(${expr.orderBy.accept(this)})`;
        }
        return "over ()";
    }

    decodeTrimArgument(expr: TrimArgument): string {
        const modifier = expr.modifier !== null ? expr.modifier.accept(this) : null;

        if (modifier !== null && expr.character != null) {
            // e.g. leading 'xyz' from 'yxTomxx'
            return `${modifier} ${expr.character.accept(this)} from ${expr.input.accept(this)} `;
        } else if (expr.character !== null) {
            // e.g. 'xyz' from 'yxTomxx'
            return `${expr.character.accept(this)} from ${expr.input.accept(this)} `;
        }
        throw new Error("Invalid TrimArgument");
    }

    decodeWindowFrameClause(expr: WindowFrameClause): string {
        if (expr.partitionBy !== null && expr.orderBy !== null) {
            return `window ${expr.alias.accept(this)} as(${expr.partitionBy.accept(this)} ${expr.orderBy.accept(this)})`;
        } else if (expr.partitionBy !== null) {
            return `window ${expr.alias.accept(this)} as(${expr.partitionBy.accept(this)})`;
        } else if (expr.orderBy !== null) {
            return `window ${expr.alias.accept(this)} as(${expr.orderBy.accept(this)})`;
        }
        throw new Error("Invalid WindowFrameClause");
    }

    decodeWhereClause(expr: WhereClause): string {
        return `where ${expr.condition.accept(this)} `;
    }

    decodeExtractArgument(expr: ExtractArgument): string {
        return `extract(${expr.field.accept(this)} from ${expr.source.accept(this)})`;
    }

    decodeRawString(expr: RawString): string {
        const invalidChars = new Set(["'", '"', ",", ";", ":", ".", "--", "/*"]);
        if (invalidChars.has(expr.keyword)) {
            throw new Error(`invalid keyword: ${expr.keyword} `);
        } else if (expr.keyword.trim() === "") {
            throw new Error("invalid keyword: empty string");
        }
        return expr.keyword.trim();
    }

    decodeIdentifierString(expr: IdentifierString): string {
        return `${this.config.identifierEscape.start}${expr.alias}${this.config.identifierEscape.end}`;
    }


}