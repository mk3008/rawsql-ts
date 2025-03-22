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
    ExtractArgument |
    RawString |
    IdentifierString |
    ParenExpression |
    CastExpression |
    JsonExpression |
    CaseExpression |
    ArrayExpression |
    PositionExpression |
    BetweenExpression |
    InlineQuery |
    StringSpecifierExpression |
    ModifierExpression;

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
    constructor(value: string | number | boolean | null) {
        super();
        this.value = value;
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
    casePairs: CaseKeyValuePair[];
    elseValue: ValueComponent | null;
    constructor(casePairs: CaseKeyValuePair[], elseValue: ValueComponent | null = null) {
        super();
        this.casePairs = casePairs;
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
    castType: TypeValue;
    constructor(expression: ValueComponent, castType: TypeValue) {
        super();
        this.expression = expression;
        this.castType = castType;
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
    value: ValueComponent;
    constructor(specifier: string, value: string) {
        super();
        this.specifier = new RawString(specifier);
        this.value = new LiteralValue(value);
    }
}

export class ModifierExpression extends SqlComponent {
    static kind = Symbol("ModifierExpression");
    // e.g. year from
    modifier: RawString;
    value: ValueComponent;
    constructor(specifier: string, value: ValueComponent) {
        super();
        this.modifier = new RawString(specifier);
        this.value = value;
    }
}

// other

export class TypeValue extends SqlComponent {
    static kind = Symbol("TypeValue");
    type: RawString;
    constructor(type: string) {
        super();
        this.type = new RawString(type);
    }
}