import { PartitionByClause, OrderByClause } from "./Clause";
import { SelectQuery, SimpleSelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";

export type ValueComponent = ValueList |
    ColumnReference |
    FunctionCall |
    UnaryExpression |
    BinaryExpression |
    LiteralValue |
    ParameterExpression |
    SwitchCaseArgument |
    CaseKeyValuePair |
    RawString |
    IdentifierString |
    ParenExpression |
    CastExpression |
    CaseExpression |
    ArrayExpression |
    BetweenExpression |
    InlineQuery |
    StringSpecifierExpression |
    TypeValue |
    TupleExpression;

export class InlineQuery extends SqlComponent {
    static kind = Symbol("InlineQuery");
    selectQuery: SelectQuery;
    constructor(selectQuery: SelectQuery) {
        super();
        this.selectQuery = selectQuery;
    }
}

export class ValueList extends SqlComponent {
    static kind = Symbol("ValueList");
    values: ValueComponent[];
    constructor(values: ValueComponent[]) {
        super();
        this.values = values;
    }
}

export class ColumnReference extends SqlComponent {
    static kind = Symbol("ColumnReferenceExpression");
    // Use the string type instead of the RawString type because it has its own escaping process.
    namespaces: IdentifierString[] | null;
    // Use the string type instead of the RawString type because it has its own escaping process.
    column: IdentifierString;
    constructor(namespaces: string | string[] | IdentifierString[] | null, column: string | IdentifierString) {
        super();
        this.namespaces = toIdentifierStringArray(namespaces);
        this.column = typeof column === "string" ? new IdentifierString(column) : column;
    }

    public toString(): string {
        if (this.namespaces) {
            return this.getNamespace() + "." + this.column.name;
        } else {
            return this.column.name;
        }
    }
    public getNamespace(): string {
        if (this.namespaces) {
            return this.namespaces.map((namespace) => namespace.name).join(".");
        } else {
            return '';
        }
    }
}

export class FunctionCall extends SqlComponent {
    static kind = Symbol("FunctionCall");
    namespaces: IdentifierString[] | null;
    name: RawString;
    argument: ValueComponent | null;
    over: OverExpression | null;
    constructor(
        namespaces: string[] | IdentifierString[] | null,
        name: string | RawString,
        argument: ValueComponent | null,
        over: OverExpression | null
    ) {
        super();
        this.namespaces = toIdentifierStringArray(namespaces);
        this.name = typeof name === "string" ? new RawString(name) : name;
        this.argument = argument;
        this.over = over;
    }
}

export type OverExpression = WindowFrameExpression | IdentifierString;

export enum WindowFrameType {
    Rows = "rows",
    Range = "range",
    Groups = "groups",
}

export enum WindowFrameBound {
    UnboundedPreceding = "unbounded preceding",
    UnboundedFollowing = "unbounded following",
    CurrentRow = "current row",
}

export type FrameBoundaryComponent = WindowFrameBoundStatic | WindowFrameBoundaryValue;

export class WindowFrameBoundStatic extends SqlComponent {
    static kind = Symbol("WindowFrameStaticBound");
    bound: WindowFrameBound;
    constructor(bound: WindowFrameBound) {
        super();
        this.bound = bound;
    }
}

export class WindowFrameBoundaryValue extends SqlComponent {
    static kind = Symbol("WindowFrameBoundary");
    value: ValueComponent;
    isFollowing: boolean; // true for "FOLLOWING", false for "PRECEDING"
    constructor(value: ValueComponent, isFollowing: boolean) {
        super();
        this.value = value;
        this.isFollowing = isFollowing;
    }
}

export class WindowFrameSpec extends SqlComponent {
    static kind = Symbol("WindowFrameSpec");
    frameType: WindowFrameType;
    startBound: FrameBoundaryComponent;
    endBound: FrameBoundaryComponent | null; // null for single boundary specification
    constructor(frameType: WindowFrameType, startBound: FrameBoundaryComponent, endBound: FrameBoundaryComponent | null) {
        super();
        this.frameType = frameType;
        this.startBound = startBound;
        this.endBound = endBound;
    }
}

export class WindowFrameExpression extends SqlComponent {
    static kind = Symbol("WindowFrameExpression");
    partition: PartitionByClause | null;
    order: OrderByClause | null;
    frameSpec: WindowFrameSpec | null;
    constructor(partition: PartitionByClause | null, order: OrderByClause | null, frameSpec: WindowFrameSpec | null = null) {
        super();
        this.partition = partition;
        this.order = order;
        this.frameSpec = frameSpec;
    }
}

export class UnaryExpression extends SqlComponent {
    static kind = Symbol("UnaryExpression");
    operator: RawString;
    expression: ValueComponent;
    constructor(operator: string, expression: ValueComponent) {
        super();
        this.operator = new RawString(operator);
        this.expression = expression;
    }
}

export class BinaryExpression extends SqlComponent {
    static kind = Symbol("BinaryExpression");
    left: ValueComponent;
    operator: RawString;
    right: ValueComponent;
    constructor(left: ValueComponent, operator: string, right: ValueComponent) {
        super();
        this.left = left;
        this.operator = new RawString(operator);
        this.right = right;
    }
}

export class LiteralValue extends SqlComponent {
    static kind = Symbol("LiteralExpression");
    // Use the string type instead of the RawString type because it has its own escaping process.
    value: string | number | boolean | null;
    constructor(value: string | number | boolean | null) {
        super();
        this.value = value;
    }
}

export class ParameterExpression extends SqlComponent {
    static kind = Symbol("ParameterExpression");
    name: RawString;
    value: any | null; // Holds the parameter value, default is null
    /**
     * The index assigned by the formatter when generating parameterized queries.
     * This is used for naming parameters like $1, $2, ...
     */
    index: number | null;
    constructor(name: string, value: any | null = null) {
        super();
        this.name = new RawString(name);
        this.value = value;
        this.index = null;
    }
}

export class SwitchCaseArgument extends SqlComponent {
    static kind = Symbol("SwitchCaseArgument");
    cases: CaseKeyValuePair[];
    elseValue: ValueComponent | null;
    constructor(cases: CaseKeyValuePair[], elseValue: ValueComponent | null = null) {
        super();
        this.cases = cases;
        this.elseValue = elseValue;
    }
}

export class CaseKeyValuePair extends SqlComponent {
    static kind = Symbol("CaseKeyValuePair");
    key: ValueComponent;
    value: ValueComponent;
    constructor(key: ValueComponent, value: ValueComponent) {
        super();
        this.key = key;
        this.value = value;
    }
}

/*
 * Values ​​that must be hard-coded, such as type names and function names.
 * A simple check is performed when decoding.
 */
export class RawString extends SqlComponent {
    static kind = Symbol("RawString");
    value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }
}

export class IdentifierString extends SqlComponent {
    static kind = Symbol("IdentifierString");
    name: string;
    constructor(alias: string) {
        super();
        this.name = alias;
    }
}

export class ParenExpression extends SqlComponent {
    static kind = Symbol("ParenExpression");
    expression: ValueComponent;
    constructor(expression: ValueComponent) {
        super();
        this.expression = expression;
    }
}

export class CastExpression extends SqlComponent {
    static kind = Symbol("CastExpression");
    input: ValueComponent;
    castType: TypeValue;
    constructor(input: ValueComponent, castType: TypeValue) {
        super();
        this.input = input;
        this.castType = castType;
    }
}

export class CaseExpression extends SqlComponent {
    static kind = Symbol("CaseExpression");
    condition: ValueComponent | null;
    switchCase: SwitchCaseArgument;

    constructor(condition: ValueComponent | null, switchCase: SwitchCaseArgument) {
        super();
        this.condition = condition;
        this.switchCase = switchCase;
    }
}

export class ArrayExpression extends SqlComponent {
    static kind = Symbol("ArrayExpression");
    expression: ValueComponent;
    constructor(expression: ValueComponent) {
        super();
        this.expression = expression;
    }
}

export class BetweenExpression extends SqlComponent {
    static kind = Symbol("BetweenExpression");
    expression: ValueComponent;
    lower: ValueComponent;
    upper: ValueComponent;
    negated: boolean;
    constructor(expression: ValueComponent, lower: ValueComponent, upper: ValueComponent, negated: boolean) {
        super();
        this.expression = expression;
        this.lower = lower;
        this.upper = upper;
        this.negated = negated;
    }
}

export class StringSpecifierExpression extends SqlComponent {
    static kind = Symbol("StringSpecifierExpression");
    // e.g. 'E', 'X', 'U&'
    specifier: RawString;
    value: LiteralValue;
    constructor(specifier: string, value: string) {
        super();
        this.specifier = new RawString(specifier);
        this.value = new LiteralValue(value);
    }
}

// other

export class TypeValue extends SqlComponent {
    static kind = Symbol("TypeValue");
    namespaces: IdentifierString[] | null;
    name: RawString;
    argument: ValueComponent | null;
    constructor(namespaces: string[] | IdentifierString[] | null, name: string | RawString, argument: ValueComponent | null = null) {
        super();
        this.namespaces = toIdentifierStringArray(namespaces);
        this.name = typeof name === "string" ? new RawString(name) : name;
        this.argument = argument;
    }
    public getTypeName(): string {
        if (this.namespaces && this.namespaces.length > 0) {
            return this.namespaces.map(ns => ns.name).join(".") + "." + this.name.value;
        } else {
            return this.name.value;
        }
    }
}

export class TupleExpression extends SqlComponent {
    static kind = Symbol("TupleExpression");
    values: ValueComponent[];
    constructor(values: ValueComponent[]) {
        super();
        this.values = values;
    }
}

function toIdentifierStringArray(input: string | string[] | IdentifierString[] | null): IdentifierString[] | null {
    if (input == null) return null;
    if (typeof input === "string") return [new IdentifierString(input)];
    if (Array.isArray(input)) {
        if (typeof input[0] === "string") {
            return (input as string[]).map(ns => new IdentifierString(ns));
        } else {
            return input as IdentifierString[];
        }
    }
    return null;
}