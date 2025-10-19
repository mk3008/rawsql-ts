import { SqlComponent } from "./SqlComponent";
import { IdentifierString, ValueList, ValueComponent } from "./ValueComponent";
import { SetClause, SetClauseItem, SourceExpression, WhereClause, WithClause } from "./Clause";

export type MergeMatchType = "matched" | "not_matched" | "not_matched_by_source" | "not_matched_by_target";

export abstract class MergeAction extends SqlComponent {
    static kind = Symbol("MergeAction");
}

export class MergeUpdateAction extends MergeAction {
    static kind = Symbol("MergeUpdateAction");
    setClause: SetClause;
    whereClause: WhereClause | null;

    constructor(setClause: SetClause | SetClauseItem[], whereClause?: WhereClause | null) {
        super();
        this.setClause = setClause instanceof SetClause ? setClause : new SetClause(setClause);
        this.whereClause = whereClause ?? null;
    }
}

export class MergeDeleteAction extends MergeAction {
    static kind = Symbol("MergeDeleteAction");
    whereClause: WhereClause | null;

    constructor(whereClause?: WhereClause | null) {
        super();
        this.whereClause = whereClause ?? null;
    }
}

export class MergeInsertAction extends MergeAction {
    static kind = Symbol("MergeInsertAction");
    columns: IdentifierString[] | null;
    values: ValueList | null;
    defaultValues: boolean;

    constructor(params: {
        columns?: (IdentifierString | string)[] | null;
        values?: ValueList | null;
        defaultValues?: boolean;
    }) {
        super();
        this.columns = params.columns
            ? params.columns.map(col => (typeof col === "string" ? new IdentifierString(col) : col))
            : null;
        this.values = params.values ?? null;
        this.defaultValues = params.defaultValues ?? false;
    }
}

export class MergeDoNothingAction extends MergeAction {
    static kind = Symbol("MergeDoNothingAction");
}

export class MergeWhenClause extends SqlComponent {
    static kind = Symbol("MergeWhenClause");
    matchType: MergeMatchType;
    condition: ValueComponent | null;
    action: MergeAction;

    constructor(matchType: MergeMatchType, action: MergeAction, condition?: ValueComponent | null) {
        super();
        this.matchType = matchType;
        this.action = action;
        this.condition = condition ?? null;
    }
}

export class MergeQuery extends SqlComponent {
    static kind = Symbol("MergeQuery");
    withClause: WithClause | null;
    target: SourceExpression;
    source: SourceExpression;
    onCondition: ValueComponent;
    whenClauses: MergeWhenClause[];

    constructor(params: {
        withClause?: WithClause | null;
        target: SourceExpression;
        source: SourceExpression;
        onCondition: ValueComponent;
        whenClauses: MergeWhenClause[];
    }) {
        super();
        this.withClause = params.withClause ?? null;
        this.target = params.target;
        this.source = params.source;
        this.onCondition = params.onCondition;
        this.whenClauses = params.whenClauses;
    }
}
