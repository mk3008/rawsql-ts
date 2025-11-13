import { ColumnReferenceCollector, IdentifierString, QualifiedName, SelectQuery, TableSourceCollector } from 'rawsql-ts';

export const renameTableReferences = (query: SelectQuery, renameMap: Map<string, string>): void => {
  if (renameMap.size === 0) {
    return;
  }

  const tableCollector = new TableSourceCollector(false);
  const tableSources = tableCollector.collect(query);

  for (const tableSource of tableSources) {
    const sourceName = tableSource.getSourceName();
    const alias = renameMap.get(sourceName.toLowerCase());
    if (!alias) {
      continue;
    }
    tableSource.qualifiedName = new QualifiedName(null, new IdentifierString(alias));
  }

  const columnCollector = new ColumnReferenceCollector();
  const columnReferences = columnCollector.collect(query);

  for (const columnReference of columnReferences) {
    const namespace = columnReference.getNamespace();
    if (!namespace) {
      continue;
    }
    const alias = renameMap.get(namespace.toLowerCase());
    if (!alias) {
      continue;
    }
    columnReference.qualifiedName = new QualifiedName([new IdentifierString(alias)], columnReference.qualifiedName.name);
  }
};

export const renameSqlIdentifiers = (sql: string, renameMap: Map<string, string>): string => {
  if (renameMap.size === 0) {
    return sql;
  }

  const shouldLogRename = Boolean(process.env.DEBUG_RENAME_SQL);
  let result = sql;

  for (const [original, replacement] of renameMap) {
    const escapedOriginal = escapeRegExp(original);
    const plainPattern = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');
    const previous = result;
    result = result.replace(plainPattern, replacement);
    if (shouldLogRename && previous !== result) {
      console.debug('renameSqlIdentifiers applied plain pattern', { original, replacement });
    }

    const parts = original.split('.');
    if (parts.length === 2) {
      const [schema, table] = parts.map((value) => escapeRegExp(value));
      const quotedPattern = new RegExp(`"\\s*${schema}\\s*"\\s*\\.\\s*"\\s*${table}\\s*"`, 'gi');
      const beforeQuoted = result;
      result = result.replace(quotedPattern, `"${replacement}"`);
      if (shouldLogRename && beforeQuoted !== result) {
        console.debug('renameSqlIdentifiers applied quoted pattern', { original, replacement });
      }
    }
  }

  return result;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
