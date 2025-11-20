import { SelectQuery } from '../models/SelectQuery';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { FixtureTableDefinition, FixtureCteBuilder } from './FixtureCteBuilder';
import { TableSourceCollector } from './TableSourceCollector';
import { MissingFixtureStrategy } from './InsertResultSelectConverter';

export interface SelectResultSelectOptions {
    fixtureTables?: FixtureTableDefinition[];
    missingFixtureStrategy?: MissingFixtureStrategy;
}

export class SelectResultSelectConverter {
    public static toSelectQuery(query: SelectQuery, options?: SelectResultSelectOptions): SelectQuery {
        const fixtureTables = options?.fixtureTables ?? [];
        if (fixtureTables.length === 0) {
            return query;
        }

        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const referencedTables = new Set<string>();
        sources.forEach(s => referencedTables.add(s.getSourceName().toLowerCase()));

        const neededFixtures = fixtureTables.filter(f => referencedTables.has(f.tableName.toLowerCase()));

        if (neededFixtures.length === 0) {
            return query;
        }

        const fixtureCtes = FixtureCteBuilder.buildFixtures(neededFixtures);

        if (query instanceof SimpleSelectQuery) {
            if (!query.withClause) {
                query.appendWith(fixtureCtes);
            } else {
                // Prepend fixtures to existing CTEs
                query.withClause.tables = [...fixtureCtes, ...query.withClause.tables];
            }
        }

        return query;
    }
}
