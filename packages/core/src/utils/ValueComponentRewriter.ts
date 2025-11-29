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
    ColumnReference,
    FunctionCall,
    FrameBoundaryComponent,
    IdentifierString,
    InlineQuery,
    LiteralValue,
    OverExpression,
    ParameterExpression,
    ParenExpression,
    RawString,
    StringSpecifierExpression,
    SwitchCaseArgument,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList,
    WindowFrameBoundaryValue,
    WindowFrameBoundStatic,
    WindowFrameExpression,
    WindowFrameSpec
} from '../models/ValueComponent';
import { OrderByClause, OrderByComponent, OrderByItem, PartitionByClause } from '../models/Clause';

export type ColumnReferenceResolver = (column: ColumnReference) => ValueComponent;

export function rewriteValueComponentWithColumnResolver(
    value: ValueComponent,
    resolver: ColumnReferenceResolver
): ValueComponent {
    if (value instanceof ColumnReference) {
        return resolver(value);
    }

    if (value instanceof FunctionCall) {
        const rewrittenArgument = value.argument
            ? rewriteValueComponentWithColumnResolver(value.argument, resolver)
            : null;
        const rewrittenOver = value.over ? rewriteOverExpression(value.over, resolver) : null;
        const rewrittenWithinGroup = value.withinGroup
            ? rewriteOrderByClause(value.withinGroup, resolver)
            : null;
        const rewrittenInternalOrderBy = value.internalOrderBy
            ? rewriteOrderByClause(value.internalOrderBy, resolver)
            : null;
        // Preserve FILTER predicates so aggregate behaviour remains intact.
        const rewrittenFilterCondition = value.filterCondition
            ? rewriteValueComponentWithColumnResolver(value.filterCondition, resolver)
            : null;

        return new FunctionCall(
            value.qualifiedName.namespaces,
            value.qualifiedName.name,
            rewrittenArgument,
            rewrittenOver,
            rewrittenWithinGroup,
            value.withOrdinality,
            rewrittenInternalOrderBy,
            rewrittenFilterCondition
        );
    }

    if (value instanceof UnaryExpression) {
        const rewrittenExpression = rewriteValueComponentWithColumnResolver(value.expression, resolver);
        return new UnaryExpression(value.operator.value, rewrittenExpression);
    }

    if (value instanceof BinaryExpression) {
        const left = rewriteValueComponentWithColumnResolver(value.left, resolver);
        const right = rewriteValueComponentWithColumnResolver(value.right, resolver);
        return new BinaryExpression(left, value.operator.value, right);
    }

    if (value instanceof CaseExpression) {
        const condition = value.condition
            ? rewriteValueComponentWithColumnResolver(value.condition, resolver)
            : null;
        const switchCase = rewriteSwitchCaseArgument(value.switchCase, resolver);
        return new CaseExpression(condition, switchCase);
    }

    if (value instanceof SwitchCaseArgument) {
        return rewriteSwitchCaseArgument(value, resolver);
    }

    if (value instanceof CaseKeyValuePair) {
        return rewriteCaseKeyValuePair(value, resolver);
    }

    if (value instanceof BetweenExpression) {
        const expression = rewriteValueComponentWithColumnResolver(value.expression, resolver);
        const lower = rewriteValueComponentWithColumnResolver(value.lower, resolver);
        const upper = rewriteValueComponentWithColumnResolver(value.upper, resolver);
        return new BetweenExpression(expression, lower, upper, value.negated);
    }

    if (value instanceof CastExpression) {
        const input = rewriteValueComponentWithColumnResolver(value.input, resolver);
        const castType = rewriteTypeValue(value.castType, resolver);
        return new CastExpression(input, castType);
    }

    if (value instanceof ParenExpression) {
        const expression = rewriteValueComponentWithColumnResolver(value.expression, resolver);
        return new ParenExpression(expression);
    }

    if (value instanceof TupleExpression) {
        const rewrittenValues = value.values.map((item) =>
            rewriteValueComponentWithColumnResolver(item, resolver)
        );
        return new TupleExpression(rewrittenValues);
    }

    if (value instanceof ArrayExpression) {
        const expression = rewriteValueComponentWithColumnResolver(value.expression, resolver);
        return new ArrayExpression(expression);
    }

    if (value instanceof ArraySliceExpression) {
        const array = rewriteValueComponentWithColumnResolver(value.array, resolver);
        const startIndex = value.startIndex
            ? rewriteValueComponentWithColumnResolver(value.startIndex, resolver)
            : null;
        const endIndex = value.endIndex
            ? rewriteValueComponentWithColumnResolver(value.endIndex, resolver)
            : null;
        return new ArraySliceExpression(array, startIndex, endIndex);
    }

    if (value instanceof ArrayIndexExpression) {
        const array = rewriteValueComponentWithColumnResolver(value.array, resolver);
        const index = rewriteValueComponentWithColumnResolver(value.index, resolver);
        return new ArrayIndexExpression(array, index);
    }

    if (value instanceof ArrayQueryExpression) {
        return value;
    }

    if (value instanceof ValueList) {
        const rewrittenList = value.values.map((item) =>
            rewriteValueComponentWithColumnResolver(item, resolver)
        );
        return new ValueList(rewrittenList);
    }

    if (value instanceof InlineQuery) {
        return value;
    }

    if (value instanceof WindowFrameExpression) {
        return rewriteWindowFrameExpression(value, resolver) as unknown as ValueComponent;
    }

    if (value instanceof WindowFrameSpec) {
        return rewriteWindowFrameSpec(value, resolver) as unknown as ValueComponent;
    }

    if (value instanceof WindowFrameBoundaryValue) {
        const rewrittenValue = rewriteValueComponentWithColumnResolver(value.value, resolver);
        return new WindowFrameBoundaryValue(rewrittenValue, value.isFollowing) as unknown as ValueComponent;
    }

    if (value instanceof WindowFrameBoundStatic) {
        return value as unknown as ValueComponent;
    }

    if (value instanceof TypeValue) {
        return rewriteTypeValue(value, resolver);
    }

    if (value instanceof StringSpecifierExpression) {
        return value;
    }

    if (value instanceof LiteralValue || value instanceof RawString || value instanceof IdentifierString) {
        return value;
    }

    if (value instanceof ParameterExpression) {
        return value;
    }

    return value;
}

function rewriteSwitchCaseArgument(
    argument: SwitchCaseArgument,
    resolver: ColumnReferenceResolver
): SwitchCaseArgument {
    const rewrittenCases = argument.cases.map((pair) => rewriteCaseKeyValuePair(pair, resolver));
    const elseValue = argument.elseValue
        ? rewriteValueComponentWithColumnResolver(argument.elseValue, resolver)
        : null;
    return new SwitchCaseArgument(rewrittenCases, elseValue);
}

function rewriteCaseKeyValuePair(
    pair: CaseKeyValuePair,
    resolver: ColumnReferenceResolver
): CaseKeyValuePair {
    const key = rewriteValueComponentWithColumnResolver(pair.key, resolver);
    const value = rewriteValueComponentWithColumnResolver(pair.value, resolver);
    return new CaseKeyValuePair(key, value);
}

function rewriteOrderByClause(
    clause: OrderByClause,
    resolver: ColumnReferenceResolver
): OrderByClause {
    const rewrittenOrder = clause.order.map((component) =>
        rewriteOrderByComponent(component, resolver)
    );
    return new OrderByClause(rewrittenOrder);
}

function rewriteOrderByComponent(
    component: OrderByComponent,
    resolver: ColumnReferenceResolver
): OrderByComponent {
    if (component instanceof OrderByItem) {
        const rewrittenValue = rewriteValueComponentWithColumnResolver(component.value, resolver);
        return new OrderByItem(rewrittenValue, component.sortDirection, component.nullsPosition);
    }
    return rewriteValueComponentWithColumnResolver(component, resolver);
}

function rewriteOverExpression(
    over: OverExpression,
    resolver: ColumnReferenceResolver
): OverExpression {
    if (over instanceof WindowFrameExpression) {
        return rewriteWindowFrameExpression(over, resolver);
    }
    return over;
}

function rewriteWindowFrameExpression(
    expression: WindowFrameExpression,
    resolver: ColumnReferenceResolver
): WindowFrameExpression {
    const partition = expression.partition
        ? rewritePartitionByClause(expression.partition, resolver)
        : null;
    const order = expression.order ? rewriteOrderByClause(expression.order, resolver) : null;
    const frameSpec = expression.frameSpec
        ? rewriteWindowFrameSpec(expression.frameSpec, resolver)
        : null;
    return new WindowFrameExpression(partition, order, frameSpec);
}

function rewritePartitionByClause(
    clause: PartitionByClause,
    resolver: ColumnReferenceResolver
): PartitionByClause {
    const value = rewriteValueComponentWithColumnResolver(clause.value, resolver);
    return new PartitionByClause(value);
}

function rewriteWindowFrameSpec(
    spec: WindowFrameSpec,
    resolver: ColumnReferenceResolver
): WindowFrameSpec {
    const startBound = rewriteFrameBoundaryComponent(spec.startBound, resolver);
    const endBound = spec.endBound
        ? rewriteFrameBoundaryComponent(spec.endBound, resolver)
        : null;
    return new WindowFrameSpec(spec.frameType, startBound, endBound);
}

function rewriteFrameBoundaryComponent(
    bound: FrameBoundaryComponent,
    resolver: ColumnReferenceResolver
): FrameBoundaryComponent {
    if (bound instanceof WindowFrameBoundaryValue) {
        const value = rewriteValueComponentWithColumnResolver(bound.value, resolver);
        return new WindowFrameBoundaryValue(value, bound.isFollowing);
    }
    return bound;
}

function rewriteTypeValue(value: TypeValue, resolver: ColumnReferenceResolver): TypeValue {
    const argument = value.argument
        ? rewriteValueComponentWithColumnResolver(value.argument, resolver)
        : null;
    return new TypeValue(value.namespaces, value.qualifiedName.name, argument);
}
