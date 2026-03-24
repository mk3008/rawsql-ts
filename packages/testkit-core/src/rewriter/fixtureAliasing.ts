import {
  ArrayExpression,
  ArrayQueryExpression,
  BinaryExpression,
  BinarySelectQuery,
  BetweenExpression,
  CaseExpression,
  CaseKeyValuePair,
  CastExpression,
  ColumnReference,
  CreateTableQuery,
  FunctionCall,
  FunctionSource,
  IdentifierString,
  InlineQuery,
  JoinOnClause,
  JoinUsingClause,
  ParenExpression,
  ParenSource,
  QueryBuilder,
  SimpleSelectQuery,
  SourceComponent,
  SourceExpression,
  SqlComponent,
  SubQuerySource,
  TableSourceCollector,
  TableSource,
  TupleExpression,
  UnaryExpression,
  ValueComponent,
  ValueList,
  ValuesQuery,
  WindowFrameExpression,
  normalizeTableName,
} from 'rawsql-ts';
import type { FixtureTableDefinition } from 'rawsql-ts';

const normalizeKey = (value: string): string => normalizeTableName(value);

const collectAliasNames = (query: SimpleSelectQuery): Set<string> => {
  const reserved = new Set<string>();

  if (query.withClause?.tables) {
    for (const cte of query.withClause.tables) {
      reserved.add(normalizeKey(cte.aliasExpression.table.name));
    }
  }

  if (query.fromClause?.source.aliasExpression?.table?.name) {
    reserved.add(normalizeKey(query.fromClause.source.aliasExpression.table.name));
  }

  if (query.fromClause?.joins) {
    for (const join of query.fromClause.joins) {
      if (join.source.aliasExpression?.table?.name) {
        reserved.add(normalizeKey(join.source.aliasExpression.table.name));
      }
    }
  }

  return reserved;
};

const buildAliasCandidate = (parts: string[], level: number): string => {
  if (parts.length === 1) {
    return `${parts[0]}${'_'.repeat(level - 1)}`;
  }

  return parts.join('_'.repeat(level));
};

const allocateAlias = (tableName: string, reserved: Set<string>): string => {
  const canonical = normalizeKey(tableName);
  const parts = canonical.split('.').filter((part) => part.length > 0);
  const normalizedParts = parts.length > 0 ? parts : [canonical];

  for (let level = 1; ; level += 1) {
    const candidate = buildAliasCandidate(normalizedParts, level);
    if (!reserved.has(normalizeKey(candidate))) {
      return candidate;
    }
  }
};

export const createCollisionAwareFixtureAliasMap = (
  tableNames: Iterable<string>,
  reservedNames: {
    sourceNames: Iterable<string>;
    sourceAliases: Iterable<string>;
    cteNames: Iterable<string>;
  }
): Map<string, string> => {
  const sourceNames = new Set<string>();
  for (const name of reservedNames.sourceNames) {
    sourceNames.add(normalizeKey(name));
  }

  const sourceAliases = new Set<string>();
  for (const name of reservedNames.sourceAliases) {
    sourceAliases.add(normalizeKey(name));
  }

  const cteNames = new Set<string>();
  for (const name of reservedNames.cteNames) {
    cteNames.add(normalizeKey(name));
  }

  const aliasMap = new Map<string, string>();
  for (const tableName of tableNames) {
    const key = normalizeKey(tableName);
    if (aliasMap.has(key)) {
      continue;
    }

    const reserved = new Set<string>();
    for (const name of sourceAliases) {
      reserved.add(name);
    }
    for (const name of cteNames) {
      reserved.add(name);
    }
    for (const name of sourceNames) {
      if (name === key) {
        continue;
      }
      reserved.add(name);
    }

    const alias = allocateAlias(tableName, reserved);
    aliasMap.set(key, alias);
    sourceNames.add(normalizeKey(alias));
  }

  return aliasMap;
};

export interface SelectReservationNames {
  sourceNames: Set<string>;
  sourceAliases: Set<string>;
  cteNames: Set<string>;
}

export const collectSelectReservationNames = (query: SimpleSelectQuery): SelectReservationNames => {
  const sourceNames = new Set<string>();
  const sourceAliases = new Set<string>();
  const cteNames = new Set<string>();
  const add = (bucket: Set<string>, value?: string | null): void => {
    if (!value) {
      return;
    }
    bucket.add(normalizeKey(value));
  };

  const cteCollector = new TableSourceCollector(false);
  for (const source of cteCollector.collect(query)) {
    add(sourceNames, source.getSourceName());
  }

  for (const alias of collectAliasNames(query)) {
    sourceAliases.add(alias);
  }

  if (query.withClause?.tables) {
    for (const cte of query.withClause.tables) {
      add(cteNames, cte.aliasExpression.table.name);
    }
  }

  return {
    sourceNames,
    sourceAliases,
    cteNames,
  };
};

export const rewriteSelectFixtureReferences = (
  component: SqlComponent | null,
  aliasMap: Map<string, string>
): void => {
  if (!component || aliasMap.size === 0) {
    return;
  }

  const visitedComponents = new WeakSet<SqlComponent>();

  const rewriteSqlComponent = (innerComponent: SqlComponent | null): void => {
    if (!innerComponent) {
      return;
    }

    if (visitedComponents.has(innerComponent)) {
      return;
    }
    visitedComponents.add(innerComponent);

    if (innerComponent instanceof SimpleSelectQuery) {
      rewriteColumnReferencesInQuery(innerComponent);
      return;
    }

    if (innerComponent instanceof BinarySelectQuery) {
      rewriteColumnReferencesInQuery(innerComponent.toSimpleQuery());
      return;
    }

    if (innerComponent instanceof ValuesQuery) {
      rewriteColumnReferencesInQuery(QueryBuilder.buildSimpleQuery(innerComponent));
      return;
    }

    if (innerComponent instanceof CreateTableQuery && innerComponent.asSelectQuery) {
      rewriteSqlComponent(innerComponent.asSelectQuery);
    }
  };

  const rewriteSourceExpression = (source: SourceExpression): void => {
    if (source.datasource instanceof TableSource) {
      const referencedName = normalizeKey(source.datasource.getSourceName());
      const alias = aliasMap.get(referencedName);
      if (alias) {
        source.datasource.qualifiedName.namespaces = null;
        source.datasource.qualifiedName.name = new IdentifierString(alias);
      }
    }

    rewriteSourceComponent(source.datasource);
  };

  const rewriteSourceComponent = (source: SourceComponent): void => {
    if (source instanceof SubQuerySource) {
      rewriteSqlComponent(source.query);
    } else if (source instanceof ParenSource) {
      rewriteSourceComponent(source.source);
    } else if (source instanceof FunctionSource && source.argument) {
      rewriteValueComponent(source.argument);
    }
  };

  const rewriteValueComponent = (value: ValueComponent | null): void => {
    if (!value) {
      return;
    }

    if (value instanceof ColumnReference) {
      rewriteColumnReference(value);
      return;
    }

    if (value instanceof BinaryExpression) {
      rewriteValueComponent(value.left);
      rewriteValueComponent(value.right);
      return;
    }

    if (value instanceof UnaryExpression) {
      rewriteValueComponent(value.expression);
      return;
    }

    if (value instanceof FunctionCall) {
      if (value.argument) {
        rewriteValueComponent(value.argument);
      }
      if (value.over && value.over instanceof WindowFrameExpression) {
        rewriteWindowFrameExpression(value.over);
      }
      return;
    }

    if (value instanceof InlineQuery) {
      rewriteSqlComponent(value.selectQuery);
      return;
    }

    if (value instanceof ParenExpression) {
      rewriteValueComponent(value.expression);
      return;
    }

    if (value instanceof ArrayExpression) {
      rewriteValueComponent(value.expression);
      return;
    }

    if (value instanceof ArrayQueryExpression) {
      rewriteSqlComponent(value.query);
      return;
    }

    if (value instanceof TupleExpression) {
      for (const tupleValue of value.values) {
        rewriteValueComponent(tupleValue);
      }
      return;
    }

    if (value instanceof ValueList) {
      for (const listValue of value.values) {
        rewriteValueComponent(listValue);
      }
      return;
    }

    if (value instanceof CaseExpression) {
      if (value.condition) {
        rewriteValueComponent(value.condition);
      }
      rewriteSwitchCaseArgument(value.switchCase);
      return;
    }

    if (value instanceof CaseKeyValuePair) {
      rewriteValueComponent(value.key);
      rewriteValueComponent(value.value);
      return;
    }

    if (value instanceof BetweenExpression) {
      rewriteValueComponent(value.expression);
      rewriteValueComponent(value.lower);
      rewriteValueComponent(value.upper);
      return;
    }

    if (value instanceof CastExpression) {
      rewriteValueComponent(value.input);
      rewriteValueComponent(value.castType);
      return;
    }

    if (value instanceof WindowFrameExpression) {
      rewriteWindowFrameExpression(value);
    }
  };

  const rewriteSwitchCaseArgument = (argument: { cases: CaseKeyValuePair[]; elseValue?: ValueComponent | null }): void => {
    for (const pair of argument.cases) {
      rewriteValueComponent(pair.key);
      rewriteValueComponent(pair.value);
    }

    if (argument.elseValue) {
      rewriteValueComponent(argument.elseValue);
    }
  };

  const rewriteWindowFrameExpression = (expression: WindowFrameExpression): void => {
    if (expression.partition) {
      rewriteValueComponent(expression.partition.value);
    }

    if (expression.order?.order) {
      for (const orderItem of expression.order.order) {
        if (orderItem && typeof orderItem === 'object' && 'value' in orderItem && orderItem.value) {
          rewriteValueComponent(orderItem.value as ValueComponent);
        }
      }
    }
  };

  const rewriteColumnReference = (columnRef: ColumnReference): void => {
    const namespaceKey = (columnRef.namespaces ?? []).map((namespace) => namespace.name).join('.');
    if (!namespaceKey) {
      return;
    }

    const alias = aliasMap.get(normalizeKey(namespaceKey));
    if (!alias) {
      return;
    }

    columnRef.qualifiedName.namespaces = [new IdentifierString(alias)];
  };

  const rewriteColumnReferencesInQuery = (query: SimpleSelectQuery): void => {
    if (query.withClause?.tables) {
      for (const cte of query.withClause.tables) {
        const alias = aliasMap.get(normalizeKey(cte.aliasExpression.table.name));
        if (alias) {
          cte.aliasExpression.table = new IdentifierString(alias);
        }
        rewriteSqlComponent(cte.query);
      }
    }

    if (query.selectClause?.items) {
      for (const item of query.selectClause.items) {
        rewriteValueComponent(item.value);
      }
    }

    if (query.fromClause) {
      rewriteSourceExpression(query.fromClause.source);
      if (query.fromClause.joins) {
        for (const join of query.fromClause.joins) {
          rewriteSourceExpression(join.source);
          if (join.condition instanceof JoinOnClause || join.condition instanceof JoinUsingClause) {
            rewriteValueComponent(join.condition.condition);
          }
        }
      }
    }

    if (query.whereClause) {
      rewriteValueComponent(query.whereClause.condition);
    }

    if (query.groupByClause?.grouping) {
      for (const item of query.groupByClause.grouping) {
        rewriteValueComponent(item);
      }
    }

    if (query.havingClause) {
      rewriteValueComponent(query.havingClause.condition);
    }

    if (query.orderByClause?.order) {
      for (const item of query.orderByClause.order) {
        if (item && typeof item === 'object' && 'value' in item && item.value) {
          rewriteValueComponent(item.value as ValueComponent);
        } else if (item && typeof item === 'object' && 'accept' in item) {
          rewriteValueComponent(item as ValueComponent);
        }
      }
    }

    if (query.windowClause?.windows) {
      for (const window of query.windowClause.windows) {
        if (window.expression) {
          rewriteWindowFrameExpression(window.expression);
        }
      }
    }

    if (query.limitClause) {
      rewriteValueComponent(query.limitClause.value);
    }

    if (query.offsetClause) {
      rewriteValueComponent(query.offsetClause.value);
    }

    if (query.fetchClause?.expression?.count) {
      rewriteValueComponent(query.fetchClause.expression.count);
    }
  };

  rewriteSqlComponent(component);
};
