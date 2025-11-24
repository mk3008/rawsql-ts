import {
  DeleteResultSelectConverter,
  InsertResultSelectConverter,
  MergeResultSelectConverter,
  SqlFormatter,
  SqlParser,
  UpdateResultSelectConverter,
  BinarySelectQuery,
  CreateTableQuery,
  DeleteQuery,
  InsertQuery,
  MergeQuery,
  ParsedStatement,
  SimpleSelectQuery,
  SqlComponent,
  UpdateQuery,
  ValuesQuery,
} from 'rawsql-ts';
import { FixtureCteBuilder } from 'rawsql-ts';
import { TableSourceCollector } from 'rawsql-ts';
import { QueryBuilder } from 'rawsql-ts';
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

    return this.formatter.format(converted).formattedSql.trim();
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
    if (!select.withClause) {
      select.appendWith(ctes);
      return select;
    }

    select.withClause.tables = [...ctes, ...select.withClause.tables];
    return select;
  }

  private filterFixturesForQuery(query: SelectQuery, fixtures: FixtureTableDefinition[]): FixtureTableDefinition[] {
    if (fixtures.length === 0) {
      return [];
    }

    const collector = new TableSourceCollector(false);
    const referenced = new Set<string>();
    collector.collect(query).forEach((source) => referenced.add(source.getSourceName().toLowerCase()));

    return fixtures.filter((fixture) => referenced.has(fixture.tableName.toLowerCase()));
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
}
