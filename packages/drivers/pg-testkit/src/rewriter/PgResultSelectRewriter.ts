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
  DeleteQuery,
  DeleteResultSelectConverter,
  FunctionCall,
  IdentifierString,
  InlineQuery,
  InsertQuery,
  InsertResultSelectConverter,
  MergeQuery,
  MergeResultSelectConverter,
  ParenExpression,
  QueryBuilder,
  SimpleSelectQuery,
  SwitchCaseArgument,
  TupleExpression,
  UnaryExpression,
  UpdateQuery,
  UpdateResultSelectConverter,
  ValueComponent,
  ValueList,
  ValuesQuery,
  WindowFrameExpression,
  SqlComponent,
  SqlFormatter,
  SqlParser,
  ParsedStatement,
  tableNameVariants,
  normalizeTableName,
} from 'rawsql-ts';
import {
  CommonTable,
  FunctionSource,
  JoinClause,
  JoinOnClause,
  JoinUsingClause,
  ParenSource,
  SourceComponent,
  SourceExpression,
  SubQuerySource,
  TableSource,
} from '../../../../core/src/models/Clause';
import { FixtureCteBuilder } from 'rawsql-ts';
import { TableSourceCollector } from 'rawsql-ts';
import type {
  FixtureTableDefinition,
  MissingFixtureStrategy,
  SqlFormatterOptions,
  TableDefinitionRegistry,
  SelectQuery,
} from 'rawsql-ts';
import type { PgFixture, PgFixtureProvider } from '../types';

interface RewriteInputs {
  fixtureTables: ReturnType<PgFixtureProvider['resolve']>['fixtureTables'];
  tableDefinitions: TableDefinitionRegistry;
  fixturesApplied: string[];
}

interface RewriteResult {
  sql: string;
  fixturesApplied: string[];
}

export class PgResultSelectRewriter {
  private readonly formatter: SqlFormatter;

  constructor(
    private readonly fixtures: PgFixtureProvider,
    private readonly missingFixtureStrategy: MissingFixtureStrategy = 'error',
    formatterOptions?: SqlFormatterOptions
  ) {
    this.formatter = new SqlFormatter({
      preset: 'postgres',
      newline: ' ',
      withClauseStyle: 'full-oneline',
      ...(formatterOptions ?? {}),
    });
  }

  public rewrite(sql: string, scopedFixtures?: PgFixture[]): RewriteResult {
    const inputs = this.prepareInputs(scopedFixtures);
    const normalized = this.normalizeParameters(sql);
    const parsedStatements = this.parseStatements(normalized.sql);

    const rewrittenStatements = parsedStatements
      .map((statement) => this.convertStatement(statement, inputs))
      .filter((value): value is string => Boolean(value));

    if (rewrittenStatements.length === 0) {
      return { sql: '', fixturesApplied: [] };
    }

    return {
      sql: this.restoreParameters(rewrittenStatements.join('; '), normalized.placeholders),
      fixturesApplied: inputs.fixturesApplied,
    };
  }

  private prepareInputs(scopedFixtures?: PgFixture[]): RewriteInputs {
    const snapshot = this.fixtures.resolve(scopedFixtures);
    return {
      fixtureTables: snapshot.fixtureTables,
      tableDefinitions: snapshot.tableDefinitions,
      fixturesApplied: snapshot.fixturesApplied,
    };
  }

  private parseStatements(sql: string): ParsedStatement[] {
    // Accept multiple statements so tests can exercise sequential CRUD flows in one call.
    return SqlParser.parseMany(sql, { skipEmptyStatements: true });
  }

  private convertStatement(statement: ParsedStatement, inputs: RewriteInputs): string | null {
    // Convert CRUD + SELECT into result-bearing SELECT statements while ignoring unsupported DDL.
    const converted = this.convertToResultSelect(statement, inputs);

    if (!converted) {
      return null;
    }

    this.rewriteSchemaQualifiers(converted, inputs.fixtureTables);

    const formattedSql = this.formatter.format(converted).formattedSql.trim();
    return formattedSql;
  }

  private convertToResultSelect(statement: ParsedStatement, inputs: RewriteInputs): SqlComponent | null {
    const options = {
      fixtureTables: inputs.fixtureTables,
      tableDefinitions: inputs.tableDefinitions,
      missingFixtureStrategy: this.missingFixtureStrategy,
    };

    if (statement instanceof InsertQuery) {
      return InsertResultSelectConverter.toSelectQuery(statement, options);
    }

    if (statement instanceof UpdateQuery) {
      return UpdateResultSelectConverter.toSelectQuery(statement, options);
    }

    if (statement instanceof DeleteQuery) {
      return DeleteResultSelectConverter.toSelectQuery(statement, options);
    }

    if (statement instanceof MergeQuery) {
      return MergeResultSelectConverter.toSelectQuery(statement, options);
    }

    if (statement instanceof SimpleSelectQuery) {
      return this.injectFixtures(statement, inputs.fixtureTables);
    }

    if (statement instanceof BinarySelectQuery || statement instanceof ValuesQuery) {
      // Normalize complex select shapes into a simple query so fixture CTEs can be prefixed consistently.
      const simple = QueryBuilder.buildSimpleQuery(statement);
      return this.injectFixtures(simple, inputs.fixtureTables);
    }

    if (statement instanceof CreateTableQuery) {
      if (statement.isTemporary && statement.asSelectQuery) {
        // Preserve allowed CREATE TEMP ... AS SELECT statements by injecting fixtures into the inner query.
        const innerSimple = statement.asSelectQuery instanceof SimpleSelectQuery
          ? statement.asSelectQuery
          : QueryBuilder.buildSimpleQuery(statement.asSelectQuery);
        statement.asSelectQuery = this.injectFixtures(innerSimple, inputs.fixtureTables);
        return statement;
      }
      return null;
    }

    return null;
  }

  private injectFixtures(select: SimpleSelectQuery, fixtures: FixtureTableDefinition[]): SimpleSelectQuery {
    const targetedFixtures = this.filterFixturesForQuery(select, fixtures);
    if (targetedFixtures.length === 0) {
      return select;
    }

    const ctes = FixtureCteBuilder.buildFixtures(targetedFixtures);
    this.applyFixtureAliases(ctes, targetedFixtures);
    if (!select.withClause) {
      select.appendWith(ctes);
      return select;
    }

    select.withClause.tables = [...ctes, ...select.withClause.tables];
    return select;
  }

  private applyFixtureAliases(ctes: CommonTable[], fixtures: FixtureTableDefinition[]): void {
    const aliasMap = this.buildFixtureAliasMap(fixtures);

    for (const cte of ctes) {
      const alias = aliasMap.get(normalizeTableName(cte.aliasExpression.table.name));
      if (!alias) {
        continue;
      }

      // Replace the CTE alias with the sanitized fixture alias to prevent schema-qualified names from escaping the WITH clause.
      cte.aliasExpression.table = new IdentifierString(alias);
    }
  }

  private buildFixtureAliasMap(fixtures: FixtureTableDefinition[]): Map<string, string> {
    const aliasMap = new Map<string, string>();
    for (const fixture of fixtures) {
      aliasMap.set(normalizeTableName(fixture.tableName), this.buildFixtureAlias(fixture.tableName));
    }
    return aliasMap;
  }

  private buildFixtureAlias(tableName: string): string {
    // Use normalized names and replace dots with underscores so the alias remains a single identifier without schema separators.
    return normalizeTableName(tableName).replace(/\./g, '_');
  }

  private filterFixturesForQuery(query: SelectQuery, fixtures: FixtureTableDefinition[]): FixtureTableDefinition[] {
    if (fixtures.length === 0) {
      return [];
    }

    const collector = new TableSourceCollector(false);
    const referenced = new Set<string>();
    for (const source of collector.collect(query)) {
      for (const variant of tableNameVariants(source.getSourceName())) {
        referenced.add(variant);
      }
    }

    return fixtures.filter((fixture) =>
      tableNameVariants(fixture.tableName).some((variant) => referenced.has(variant))
    );
  }

  private normalizeParameters(sql: string): { sql: string; placeholders: Map<string, string> } {
    const placeholders = new Map<string, string>();
    const normalized = sql.replace(/\$(\d+)/g, (_match, index) => {
      const token = `__rawsqlts_param_${index}__`;
      placeholders.set(`'${token}'`, `$${index}`);
      return `'${token}'`;
    });
    return { sql: normalized, placeholders };
  }

  private restoreParameters(sql: string, placeholders: Map<string, string>): string {
    let restored = sql;
    for (const [token, original] of placeholders.entries()) {
      // replaceAll is not available in the configured TS lib target; use split/join for compatibility.
      restored = restored.split(token).join(original);
    }
    return restored;
  }


  private rewriteSchemaQualifiers(component: SqlComponent, fixtures: FixtureTableDefinition[]): void {
    const fixtureAliasMap = this.buildFixtureAliasMap(fixtures);
    if (fixtureAliasMap.size === 0) {
      return;
    }

    const collector = new TableSourceCollector(false);
    for (const source of collector.collect(component)) {
      const referencedName = normalizeTableName(source.getSourceName());
      const alias = fixtureAliasMap.get(referencedName);
      if (!alias) {
        continue;
      }

      // Update table references so the rewritten SQL always uses the fixture alias rather than the physical schema-qualified table.
      source.qualifiedName.namespaces = null;
      source.qualifiedName.name = new IdentifierString(alias);
    }

    const columnQuery =
      component instanceof SimpleSelectQuery
        ? component
        : component instanceof BinarySelectQuery
          ? component.toSimpleQuery()
          : null;

    if (!columnQuery) {
      return;
    }

    // Traverse the query tree and reroute every column reference so it targets the fixture alias.
    this.rewriteColumnReferencesInQuery(columnQuery, fixtureAliasMap);
  }

  private rewriteColumnReferencesInQuery(query: SimpleSelectQuery, aliasMap: Map<string, string>): void {
    if (query.withClause?.tables) {
      for (const cte of query.withClause.tables) {
        const normalized = normalizeTableName(cte.aliasExpression.table.name);
        const alias = aliasMap.get(normalized);
        if (alias) {
          // Align the WITH clause alias with the names used later in the main query.
          cte.aliasExpression.table = new IdentifierString(alias);
        }
        this.rewriteSqlComponent(cte.query, aliasMap);
      }
    }

    if (query.selectClause?.items) {
      for (const item of query.selectClause.items) {
        this.rewriteValueComponent(item.value, aliasMap);
      }
    }

    if (query.fromClause) {
      this.rewriteSourceExpression(query.fromClause.source, aliasMap);
      if (query.fromClause.joins) {
        for (const join of query.fromClause.joins) {
          this.rewriteSourceExpression(join.source, aliasMap);
          if (join.condition instanceof JoinOnClause || join.condition instanceof JoinUsingClause) {
            this.rewriteValueComponent(join.condition.condition, aliasMap);
          }
        }
      }
    }

    if (query.whereClause) {
      this.rewriteValueComponent(query.whereClause.condition, aliasMap);
    }

    if (query.groupByClause?.grouping) {
      for (const item of query.groupByClause.grouping) {
        this.rewriteValueComponent(item, aliasMap);
      }
    }

    if (query.havingClause) {
      this.rewriteValueComponent(query.havingClause.condition, aliasMap);
    }

    if (query.orderByClause?.order) {
      for (const item of query.orderByClause.order) {
        if (item && typeof item === 'object' && 'value' in item && item.value) {
          this.rewriteValueComponent(item.value, aliasMap);
        } else if (item && typeof item === 'object' && 'accept' in item) {
          this.rewriteValueComponent(item as ValueComponent, aliasMap);
        }
      }
    }

    if (query.windowClause?.windows) {
      for (const window of query.windowClause.windows) {
        if (window.expression) {
          this.rewriteWindowFrameExpression(window.expression, aliasMap);
        }
      }
    }

    if (query.limitClause) {
      this.rewriteValueComponent(query.limitClause.value, aliasMap);
    }

    if (query.offsetClause) {
      this.rewriteValueComponent(query.offsetClause.value, aliasMap);
    }

    if (query.fetchClause?.expression?.count) {
      this.rewriteValueComponent(query.fetchClause.expression.count, aliasMap);
    }
  }

  private rewriteSourceExpression(source: SourceExpression, aliasMap: Map<string, string>): void {
    this.rewriteSourceComponent(source.datasource, aliasMap);
  }

  private rewriteSourceComponent(source: SourceComponent, aliasMap: Map<string, string>): void {
    if (source instanceof SubQuerySource) {
      this.rewriteSqlComponent(source.query, aliasMap);
    } else if (source instanceof ParenSource) {
      this.rewriteSourceComponent(source.source, aliasMap);
    } else if (source instanceof FunctionSource && source.argument) {
      this.rewriteValueComponent(source.argument, aliasMap);
    }
  }

  private rewriteSqlComponent(component: SqlComponent | null, aliasMap: Map<string, string>): void {
    if (!component) {
      return;
    }

    if (component instanceof SimpleSelectQuery) {
      this.rewriteColumnReferencesInQuery(component, aliasMap);
    } else if (component instanceof BinarySelectQuery) {
      this.rewriteColumnReferencesInQuery(component.toSimpleQuery(), aliasMap);
    } else if (component instanceof ValuesQuery) {
      this.rewriteColumnReferencesInQuery(QueryBuilder.buildSimpleQuery(component), aliasMap);
    } else if (component instanceof CreateTableQuery && component.asSelectQuery) {
      this.rewriteSqlComponent(component.asSelectQuery, aliasMap);
    }
  }

  private rewriteValueComponent(value: ValueComponent | null, aliasMap: Map<string, string>): void {
    if (!value) {
      return;
    }

    if (value instanceof ColumnReference) {
      this.rewriteColumnReference(value, aliasMap);
      return;
    }

    if (value instanceof BinaryExpression) {
      this.rewriteValueComponent(value.left, aliasMap);
      this.rewriteValueComponent(value.right, aliasMap);
      return;
    }

    if (value instanceof UnaryExpression) {
      this.rewriteValueComponent(value.expression, aliasMap);
      return;
    }

    if (value instanceof FunctionCall) {
      if (value.argument) {
        this.rewriteValueComponent(value.argument, aliasMap);
      }
      if (value.over && value.over instanceof WindowFrameExpression) {
        this.rewriteWindowFrameExpression(value.over, aliasMap);
      }
      return;
    }

    if (value instanceof InlineQuery) {
      this.rewriteSqlComponent(value.selectQuery, aliasMap);
      return;
    }

    if (value instanceof ParenExpression) {
      this.rewriteValueComponent(value.expression, aliasMap);
      return;
    }

    if (value instanceof ArrayExpression) {
      this.rewriteValueComponent(value.expression, aliasMap);
      return;
    }

    if (value instanceof ArrayQueryExpression) {
      this.rewriteSqlComponent(value.query, aliasMap);
      return;
    }

    if (value instanceof TupleExpression) {
      for (const tupleValue of value.values) {
        this.rewriteValueComponent(tupleValue, aliasMap);
      }
      return;
    }

    if (value instanceof ValueList) {
      for (const listValue of value.values) {
        this.rewriteValueComponent(listValue, aliasMap);
      }
      return;
    }

    if (value instanceof CaseExpression) {
      if (value.condition) {
        this.rewriteValueComponent(value.condition, aliasMap);
      }
      this.rewriteSwitchCaseArgument(value.switchCase, aliasMap);
      return;
    }

    if (value instanceof CaseKeyValuePair) {
      this.rewriteValueComponent(value.key, aliasMap);
      this.rewriteValueComponent(value.value, aliasMap);
      return;
    }

    if (value instanceof SwitchCaseArgument) {
      this.rewriteSwitchCaseArgument(value, aliasMap);
      return;
    }

    if (value instanceof BetweenExpression) {
      this.rewriteValueComponent(value.expression, aliasMap);
      this.rewriteValueComponent(value.lower, aliasMap);
      this.rewriteValueComponent(value.upper, aliasMap);
      return;
    }

    if (value instanceof CastExpression) {
      this.rewriteValueComponent(value.input, aliasMap);
      this.rewriteValueComponent(value.castType, aliasMap);
      return;
    }

    if (value instanceof WindowFrameExpression) {
      this.rewriteWindowFrameExpression(value, aliasMap);
      return;
    }
  }

  private rewriteSwitchCaseArgument(argument: SwitchCaseArgument, aliasMap: Map<string, string>): void {
    for (const pair of argument.cases) {
      this.rewriteValueComponent(pair.key, aliasMap);
      this.rewriteValueComponent(pair.value, aliasMap);
    }
    if (argument.elseValue) {
      this.rewriteValueComponent(argument.elseValue, aliasMap);
    }
  }

  private rewriteWindowFrameExpression(expression: WindowFrameExpression, aliasMap: Map<string, string>): void {
    if (expression.partition) {
      this.rewriteValueComponent(expression.partition.value, aliasMap);
    }

    if (expression.order?.order) {
      for (const orderItem of expression.order.order) {
        if (orderItem && typeof orderItem === 'object' && 'value' in orderItem && orderItem.value) {
          this.rewriteValueComponent(orderItem.value, aliasMap);
        }
      }
    }
  }

  private rewriteColumnReference(columnRef: ColumnReference, aliasMap: Map<string, string>): void {
    const namespaceKey = (columnRef.namespaces ?? []).map((namespace) => namespace.name).join('.');
    if (!namespaceKey) {
      return;
    }

    const alias = aliasMap.get(normalizeTableName(namespaceKey));
    if (!alias) {
      return;
    }

    columnRef.qualifiedName.namespaces = [new IdentifierString(alias)];
  }
}
