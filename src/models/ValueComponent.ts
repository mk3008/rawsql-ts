import { SelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";

export type ValueComponent = ValueCollection |
    ColumnReference |
    FunctionCall |
    UnaryExpression |
    BinaryExpression |
    LiteralValue |
    ParameterExpression |
    JsonStructureArgument |
    JsonKeyValuePair |
    SwitchCaseArgument |
    CaseKeyValuePair |
    OverlayPlacingFromForArgument |
    SubstringFromForArgument |
    SubstringSimilarEscapeArgument |
    ExtractArgument |
    RawString |
    IdentifierString |
    TrimArgument |
    ParenExpression |
    CastExpression |
    JsonExpression |
    CaseExpression |
    ArrayExpression |
    PositionExpression |
    BetweenExpression |
    InlineQuery;

export class InlineQuery extends SqlComponent {
    static kind = Symbol("InlineQuery");
    selectQuery: SelectQuery;
    constructor(selectQuery: SelectQuery) {
        super();
        this.selectQuery = selectQuery;
    }
}

export class ValueCollection extends SqlComponent {
    static kind = Symbol("ValueCollection");
    values: SqlComponent[];
    constructor(values: SqlComponent[]) {
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
    constructor(namespaces: string[] | null, column: string) {
        super();
        this.namespaces = namespaces !== null ? namespaces.map((namespace) => new IdentifierString(namespace)) : null;
        this.column = new IdentifierString(column);
    }
}

export class FunctionCall extends SqlComponent {
    static kind = Symbol("FunctionCall");
    name: RawString;
    argument: ValueComponent | null;
    constructor(name: string, argument: ValueComponent | null) {
        super();
        this.name = new RawString(name);
        this.argument = argument;
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
    // Use the string type instead of the RawString type because it has its own escaping process.
    escapeOption: string | null;
    constructor(value: string | number | boolean | null, escapeOption: string | null = null) {
        super();
        this.value = value;
        this.escapeOption = escapeOption;
    }
}

export class ParameterExpression extends SqlComponent {
    static kind = Symbol("ParameterExpression");
    name: RawString;
    constructor(name: string) {
        super();
        this.name = new RawString(name);
    }
}

export class JsonStructureArgument extends SqlComponent {
    static kind = Symbol("JsonStructureArgument");
    keyValuePairs: JsonKeyValuePair[];
    constructor(values: JsonKeyValuePair[]) {
        super();
        this.keyValuePairs = values;
    }
}

export class JsonKeyValuePair extends SqlComponent {
    static kind = Symbol("JsonKeyValuePair");
    key: ValueComponent;
    value: ValueComponent;
    constructor(key: ValueComponent, value: ValueComponent) {
        super();
        this.key = key;
        this.value = value;
    }
}

export class SwitchCaseArgument extends SqlComponent {
    static kind = Symbol("SwitchCaseArgument");
    caseKeyValuePairs: CaseKeyValuePair[];
    casePairs: any;
    elseValue: any;
    constructor(values: CaseKeyValuePair[]) {
        super();
        this.caseKeyValuePairs = values;
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

export class OverlayPlacingFromForArgument extends SqlComponent {
    static kind = Symbol("OverlayPlacingFromForArgument");
    input: ValueComponent;
    replacement: ValueComponent;
    start: ValueComponent;
    length: ValueComponent | null;

    constructor(input: ValueComponent, replacement: ValueComponent, start: ValueComponent, length: ValueComponent | null) {
        super();
        this.input = input;
        this.replacement = replacement;
        this.start = start;
        this.length = length;
    }
}

export class SubstringFromForArgument extends SqlComponent {
    static kind = Symbol("SubstringFromForExpression");
    input: ValueComponent;
    start: ValueComponent | null;
    length: ValueComponent | null;

    constructor(input: ValueComponent, start: ValueComponent | null, length: ValueComponent | null) {
        super();
        this.input = input;
        this.start = start;
        this.length = length;
    }
}

export class SubstringSimilarEscapeArgument extends SqlComponent {
    static kind = Symbol("SubstringSimilarEscapeExpression");
    input: ValueComponent;
    pattern: ValueComponent;
    escape: ValueComponent;

    constructor(input: ValueComponent, pattern: ValueComponent, escape: ValueComponent) {
        super();
        this.input = input;
        this.pattern = pattern;
        this.escape = escape;
    }
}

export class ExtractArgument extends SqlComponent {
    static kind = Symbol("ExtractArgument");
    field: RawString;
    source: ValueComponent;
    constructor(field: string, source: ValueComponent) {
        super();
        this.field = new RawString(field);
        this.source = source;
    }
}

/*
 * Values ​​that must be hard-coded, such as type names and function names.
 * A simple check is performed when decoding.
 */
export class RawString extends SqlComponent {
    static kind = Symbol("RawString");
    keyword: string;
    constructor(keyword: string) {
        super();
        this.keyword = keyword;
    }
}

export class IdentifierString extends SqlComponent {
    static kind = Symbol("IdentifierString");
    // Use the string type instead of the RawString type because it has its own escaping process.
    alias: string;
    constructor(alias: string) {
        super();
        this.alias = alias;
    }
}

export class TrimArgument extends SqlComponent {
    static kind = Symbol("TrimArgument");
    modifier: RawString | null;
    character: ValueComponent;
    input: ValueComponent;
    constructor(modifier: string | null, character: ValueComponent, input: ValueComponent) {
        super();
        this.modifier = modifier !== null ? new RawString(modifier) : null;
        this.character = character;
        this.input = input;
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
    expression: ValueComponent;
    castType: RawString;
    constructor(expression: ValueComponent, castType: string) {
        super();
        this.expression = expression;
        this.castType = new RawString(castType);
    }
}

export class JsonExpression extends SqlComponent {
    static kind = Symbol("JsonExpression");
    structureArgument: JsonStructureArgument;
    constructor(structureArgument: JsonStructureArgument) {
        super();
        this.structureArgument = structureArgument;
    }
}

export class CaseExpression extends SqlComponent {
    static kind = Symbol("CaseExpression");
    condition: ValueComponent | null;
    switchCase: SwitchCaseArgument;
    elseValue: ValueComponent | null;
    casePairs: any;

    constructor(condition: ValueComponent | null, switchCase: SwitchCaseArgument, elseValue: ValueComponent | null = null) {
        super();
        this.condition = condition;
        this.switchCase = switchCase;
        this.elseValue = elseValue;
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


export class PositionExpression extends SqlComponent {
    static kind = Symbol("PositionExpression");
    haystack: ValueComponent;
    needle: ValueComponent;
    constructor(haystack: ValueComponent, subExpression: ValueComponent) {
        super();
        this.haystack = haystack;
        this.needle = subExpression;
    }
}

export class BetweenExpression extends SqlComponent {
    static kind = Symbol("BetweenExpression");
    expression: ValueComponent;
    lower: ValueComponent;
    upper: ValueComponent;
    constructor(expression: ValueComponent, lower: ValueComponent, upper: ValueComponent) {
        super();
        this.expression = expression;
        this.lower = lower;
        this.upper = upper;
    }
}