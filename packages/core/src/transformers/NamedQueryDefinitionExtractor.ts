import {
    CommonTable,
    CTEQuery,
    DeleteClause,
    FromClause,
    FunctionSource,
    GroupByClause,
    HavingClause,
    InsertClause,
    JoinClause,
    JoinOnClause,
    JoinUsingClause,
    LimitClause,
    OnConflictClause,
    OrderByClause,
    OrderByItem,
    ParenSource,
    ReturningClause,
    SelectClause,
    SelectItem,
    SetClause,
    SourceExpression,
    SubQuerySource,
    UpdateClause,
    UsingClause,
    WhereClause,
    WindowFrameClause,
    WindowsClause,
    WithClause
} from "../models/Clause";
import { DeleteQuery } from "../models/DeleteQuery";
import { InsertQuery } from "../models/InsertQuery";
import { MergeDeleteAction, MergeInsertAction, MergeQuery, MergeUpdateAction, MergeWhenClause } from "../models/MergeQuery";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { UpdateQuery } from "../models/UpdateQuery";
import {
    ArrayExpression,
    ArrayIndexExpression,
    ArrayQueryExpression,
    ArraySliceExpression,
    BetweenExpression,
    BinaryExpression,
    CaseExpression,
    CaseKeyValuePair,
    CastExpression,
    FunctionCall,
    InlineQuery,
    JsonPredicateExpression,
    ParenExpression,
    SwitchCaseArgument,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueList,
    WindowFrameBoundaryValue,
    WindowFrameExpression,
    WindowFrameSpec
} from "../models/ValueComponent";
import { SelectQueryWithClauseHelper } from "../utils/SelectQueryWithClauseHelper";

/**
 * Source span for a named query definition when parser position metadata is available.
 *
 * @remarks The current extractor does not synthesize ranges. `range` and `nameRange`
 * are returned as `null` until AST nodes expose reliable definition spans.
 */
export interface NamedQueryDefinitionSourceRange {
    start: number;
    end: number;
}

/**
 * DTO-style representation of a named query definition from a SQL AST.
 */
export interface NamedQueryDefinition {
    /** The stable definition name, such as a CTE alias. */
    name: string;
    /** The AST query node that defines the named query. */
    query: CTEQuery;
    /** Whether the definition belongs to a `WITH RECURSIVE` clause, when that context is available. */
    recursive?: boolean;
    /** Full definition source range when available. Currently `null`. */
    range: NamedQueryDefinitionSourceRange | null;
    /** Definition-name source range when available. Currently `null`. */
    nameRange: NamedQueryDefinitionSourceRange | null;
}

/**
 * Extracts named query definitions, starting with CTE definitions from `WITH` clauses.
 *
 * @remarks Definitions are emitted in SQL source order. For nested CTEs, the outer
 * CTE definition is emitted when its name is encountered, then definitions inside
 * that CTE body are emitted before later sibling CTE definitions.
 */
export class NamedQueryDefinitionExtractor {
    private readonly definitions: NamedQueryDefinition[] = [];
    private readonly visited = new Set<object>();

    /**
     * Extract named query definitions from an AST component.
     */
    public static extract(input: SqlComponent | null | undefined): NamedQueryDefinition[] {
        if (!input) {
            return [];
        }

        const extractor = new NamedQueryDefinitionExtractor();
        extractor.visit(input);
        return extractor.definitions;
    }

    private visit(value: unknown): void {
        if (!value || typeof value !== "object") {
            return;
        }

        if (this.visited.has(value)) {
            return;
        }
        this.visited.add(value);

        if (value instanceof WithClause) {
            this.visitWithClause(value);
            return;
        }

        if (value instanceof CommonTable) {
            this.visitCommonTable(value);
            return;
        }

        if (value instanceof SimpleSelectQuery || value instanceof BinarySelectQuery || value instanceof ValuesQuery) {
            this.visitSelectQuery(value);
            return;
        }

        if (value instanceof InsertQuery) {
            this.visitInsertQuery(value);
            return;
        }

        if (value instanceof UpdateQuery) {
            this.visitUpdateQuery(value);
            return;
        }

        if (value instanceof DeleteQuery) {
            this.visitDeleteQuery(value);
            return;
        }

        if (value instanceof MergeQuery) {
            this.visitMergeQuery(value);
            return;
        }

        if (this.visitKnownValueComponent(value)) {
            return;
        }

        if (this.visitKnownSqlComponent(value)) {
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                this.visit(item);
            }
            return;
        }

        for (const key of Object.keys(value)) {
            this.visit((value as Record<string, unknown>)[key]);
        }
    }

    private visitSelectQuery(query: SelectQuery, includeWith: boolean = true): void {
        if (query instanceof SimpleSelectQuery) {
            this.visitSimpleSelectQuery(query, includeWith);
            return;
        }

        if (query instanceof BinarySelectQuery) {
            this.visitSelectQuery(query.left, includeWith);
            this.visitSelectQuery(query.right);
            return;
        }

        if (query instanceof ValuesQuery) {
            if (includeWith) {
                this.visit(query.withClause);
            }
            this.visit(query.tuples);
        }
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery, includeWith: boolean): void {
        if (includeWith) {
            this.visit(query.withClause);
        }
        this.visit(query.selectClause);
        this.visit(query.fromClause);
        this.visit(query.whereClause);
        this.visit(query.groupByClause);
        this.visit(query.havingClause);
        this.visit(query.windowClause);
        this.visit(query.orderByClause);
        this.visit(query.limitClause);
        this.visit(query.offsetClause);
        this.visit(query.fetchClause);
        this.visit(query.forClause);
    }

    private visitInsertQuery(query: InsertQuery): void {
        const withClause = SelectQueryWithClauseHelper.getWithClause(query.selectQuery);
        this.visit(withClause);
        this.visit(query.insertClause);
        if (query.selectQuery) {
            this.visitSelectQuery(query.selectQuery, false);
        }
        this.visit(query.onConflictClause);
        this.visit(query.returningClause);
    }

    private visitUpdateQuery(query: UpdateQuery): void {
        this.visit(query.withClause);
        this.visit(query.updateClause);
        this.visit(query.setClause);
        this.visit(query.fromClause);
        this.visit(query.whereClause);
        this.visit(query.returningClause);
    }

    private visitDeleteQuery(query: DeleteQuery): void {
        this.visit(query.withClause);
        this.visit(query.deleteClause);
        this.visit(query.usingClause);
        this.visit(query.whereClause);
        this.visit(query.returningClause);
    }

    private visitMergeQuery(query: MergeQuery): void {
        this.visit(query.withClause);
        this.visit(query.target);
        this.visit(query.source);
        this.visit(query.onCondition);
        this.visit(query.whenClauses);
        this.visit(query.returningClause);
    }

    private visitWithClause(withClause: WithClause): void {
        for (const commonTable of withClause.tables) {
            this.visitCommonTable(commonTable, withClause.recursive);
        }
    }

    private visitCommonTable(commonTable: CommonTable, recursive?: boolean): void {
        const definition: NamedQueryDefinition = {
            name: commonTable.getSourceAliasName(),
            query: commonTable.query,
            range: null,
            nameRange: null
        };

        if (recursive !== undefined) {
            definition.recursive = recursive;
        }

        this.definitions.push(definition);

        this.visit(commonTable.query);
    }

    private visitKnownSqlComponent(value: object): boolean {
        if (value instanceof SelectClause) {
            this.visit(value.distinct);
            this.visit(value.hints);
            this.visit(value.items);
            return true;
        }

        if (value instanceof SelectItem) {
            this.visit(value.value);
            return true;
        }

        if (value instanceof FromClause) {
            this.visit(value.source);
            this.visit(value.joins);
            return true;
        }

        if (value instanceof JoinClause) {
            this.visit(value.source);
            this.visit(value.condition);
            return true;
        }

        if (value instanceof JoinOnClause || value instanceof JoinUsingClause) {
            this.visit(value.condition);
            return true;
        }

        if (value instanceof SourceExpression) {
            this.visit(value.datasource);
            return true;
        }

        if (value instanceof SubQuerySource) {
            this.visitSelectQuery(value.query);
            return true;
        }

        if (value instanceof FunctionSource) {
            this.visit(value.argument);
            return true;
        }

        if (value instanceof ParenSource) {
            this.visit(value.source);
            return true;
        }

        if (value instanceof WhereClause || value instanceof HavingClause) {
            this.visit(value.condition);
            return true;
        }

        if (value instanceof LimitClause) {
            this.visit(value.value);
            return true;
        }

        if (value instanceof GroupByClause) {
            this.visit(value.grouping);
            return true;
        }

        if (value instanceof WindowsClause) {
            this.visit(value.windows);
            return true;
        }

        if (value instanceof WindowFrameClause) {
            this.visit(value.expression);
            return true;
        }

        if (value instanceof OrderByClause) {
            this.visit(value.order);
            return true;
        }

        if (value instanceof OrderByItem) {
            this.visit(value.value);
            return true;
        }

        if (value instanceof ReturningClause) {
            this.visit(value.items);
            return true;
        }

        if (value instanceof OnConflictClause) {
            this.visit(value.setClause);
            this.visit(value.whereClause);
            this.visit(value.forClause);
            return true;
        }

        if (value instanceof SetClause) {
            for (const item of value.items) {
                this.visit(item.value);
            }
            return true;
        }

        if (value instanceof UpdateClause || value instanceof DeleteClause || value instanceof InsertClause) {
            this.visit(value.source);
            return true;
        }

        if (value instanceof UsingClause) {
            this.visit(value.sources);
            return true;
        }

        if (value instanceof MergeWhenClause) {
            this.visit(value.condition);
            this.visit(value.action);
            return true;
        }

        if (value instanceof MergeUpdateAction) {
            this.visit(value.setClause);
            this.visit(value.whereClause);
            return true;
        }

        if (value instanceof MergeDeleteAction) {
            this.visit(value.whereClause);
            return true;
        }

        if (value instanceof MergeInsertAction) {
            this.visit(value.values);
            return true;
        }

        return false;
    }

    private visitKnownValueComponent(value: object): boolean {
        if (value instanceof ValueList || value instanceof TupleExpression) {
            this.visit(value.values);
            return true;
        }

        if (value instanceof FunctionCall) {
            this.visit(value.argument);
            this.visit(value.internalOrderBy);
            this.visit(value.withinGroup);
            this.visit(value.filterCondition);
            this.visit(value.over);
            return true;
        }

        if (value instanceof WindowFrameExpression) {
            this.visit(value.partition);
            this.visit(value.order);
            this.visit(value.frameSpec);
            return true;
        }

        if (value instanceof WindowFrameSpec) {
            this.visit(value.startBound);
            this.visit(value.endBound);
            return true;
        }

        if (value instanceof WindowFrameBoundaryValue) {
            this.visit(value.value);
            return true;
        }

        if (value instanceof UnaryExpression || value instanceof ParenExpression || value instanceof ArrayExpression || value instanceof JsonPredicateExpression) {
            this.visit(value.expression);
            return true;
        }

        if (value instanceof BinaryExpression) {
            this.visit(value.left);
            this.visit(value.right);
            return true;
        }

        if (value instanceof SwitchCaseArgument) {
            this.visit(value.cases);
            this.visit(value.elseValue);
            return true;
        }

        if (value instanceof CaseKeyValuePair) {
            this.visit(value.key);
            this.visit(value.value);
            return true;
        }

        if (value instanceof CastExpression) {
            this.visit(value.input);
            this.visit(value.castType);
            return true;
        }

        if (value instanceof CaseExpression) {
            this.visit(value.condition);
            this.visit(value.switchCase);
            return true;
        }

        if (value instanceof ArrayQueryExpression) {
            this.visitSelectQuery(value.query);
            return true;
        }

        if (value instanceof InlineQuery) {
            this.visitSelectQuery(value.selectQuery);
            return true;
        }

        if (value instanceof BetweenExpression) {
            this.visit(value.expression);
            this.visit(value.lower);
            this.visit(value.upper);
            return true;
        }

        if (value instanceof TypeValue) {
            this.visit(value.argument);
            return true;
        }

        if (value instanceof ArraySliceExpression) {
            this.visit(value.array);
            this.visit(value.startIndex);
            this.visit(value.endIndex);
            return true;
        }

        if (value instanceof ArrayIndexExpression) {
            this.visit(value.array);
            this.visit(value.index);
            return true;
        }

        return false;
    }
}
