import type { SelectQuery, SqlComponent } from 'rawsql-ts';
import { CTECollector, CTETableReferenceCollector, SelectQueryParser } from 'rawsql-ts';

export interface SelectAnalysisResult {
  tableNames: string[];
  cteNames: string[];
}

export class SelectAnalyzer {
  public analyze(sql: string): SelectAnalysisResult {
    const parsed = SelectQueryParser.parse(sql);

    const cteCollector = new CTECollector();
    const ctes = cteCollector.collect(parsed);
    const cteNames = new Set<string>();
    for (const cte of ctes) {
      cteNames.add(cte.getSourceAliasName().toLowerCase());
    }

    const tableNames = this.collectTables(parsed, ctes.map((cte) => cte.query));

    return {
      tableNames: [...tableNames],
      cteNames: [...cteNames],
    };
  }

  private collectTables(root: SelectQuery, cteQueries: SqlComponent[]): Set<string> {
    const tables = new Set<string>();
    this.collectFromComponent(root, tables);

    // CTE bodies can be writable statements, so treat them as generic SQL components.
    for (const query of cteQueries) {
      this.collectFromComponent(query, tables);
    }

    return tables;
  }

  private collectFromComponent(component: SqlComponent, bucket: Set<string>): void {
    const collector = new CTETableReferenceCollector();
    const tables = collector.collect(component);
    for (const table of tables) {
      bucket.add(table.getSourceName().toLowerCase());
    }
  }
}
