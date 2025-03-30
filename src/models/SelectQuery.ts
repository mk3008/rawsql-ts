import { SqlComponent } from "./SqlComponent";
import { ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, WithClause } from "./Clause";

export class SelectQuery extends SqlComponent {
    static kind = Symbol("SelectQuery");
    WithClause: WithClause | null = null;
    selectClause: SelectClause;
    fromClause: FromClause | null;
    whereClause: WhereClause | null;
    groupByClause: GroupByClause | null;
    havingClause: HavingClause | null;
    orderByClause: OrderByClause | null;
    windowFrameClause: WindowFrameClause | null;
    rowLimitClause: LimitClause | null;
    forClause: ForClause | null;

    constructor(
        withClause: WithClause | null,
        selectClause: SelectClause,
        fromClause: FromClause | null,
        whereClause: WhereClause | null,
        groupByClause: GroupByClause | null,
        havingClause: HavingClause | null,
        orderByClause: OrderByClause | null,
        windowFrameClause: WindowFrameClause | null,
        rowLimitClause: LimitClause | null,
        forClause: ForClause | null
    ) {
        super();
        this.WithClause = withClause;
        this.selectClause = selectClause;
        this.fromClause = fromClause;
        this.whereClause = whereClause;
        this.groupByClause = groupByClause;
        this.havingClause = havingClause;
        this.orderByClause = orderByClause;
        this.windowFrameClause = windowFrameClause;
        this.rowLimitClause = rowLimitClause;
        this.forClause = forClause;
    }
}
