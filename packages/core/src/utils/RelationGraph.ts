import { CreateTableQuery } from '../models/CreateTableQuery';
import { QualifiedName } from '../models/ValueComponent';
import { normalizeTableName } from './TableNameUtils';

export type RelationConstraintKind = 'column-reference' | 'table-foreign-key';

export interface RelationGraphEdge {
  childTable: string;
  parentTable: string;
  childColumns: string[];
  parentColumns: string[];
  constraintKind: RelationConstraintKind;
  constraintName: string | null;
  isSelfReference: boolean;
}

export interface RelationGraph {
  relations: RelationGraphEdge[];
  byChildTable: Map<string, RelationGraphEdge[]>;
  byParentTable: Map<string, RelationGraphEdge[]>;
  tableNames: Set<string>;
}

/**
 * Build a direction-aware relation graph from parsed CREATE TABLE statements.
 */
export function buildRelationGraphFromCreateTableQueries(queries: CreateTableQuery[]): RelationGraph {
  const relations: RelationGraphEdge[] = [];
  const byChildTable = new Map<string, RelationGraphEdge[]>();
  const byParentTable = new Map<string, RelationGraphEdge[]>();
  const tableNames = new Set<string>();
  const seen = new Set<string>();

  for (const query of queries) {
    const childTable = normalizeRelationTableName(buildQualifiedName(query.namespaces, query.tableName.name));
    tableNames.add(childTable);

    for (const column of query.columns) {
      for (const constraint of column.constraints) {
        if (constraint.kind !== 'references' || !constraint.reference) {
          continue;
        }
        const edge = createEdge({
          childTable,
          parentTable: normalizeRelationTableName(constraint.reference.targetTable.toString()),
          childColumns: [column.name.name],
          parentColumns: constraint.reference.columns?.map((item) => item.name) ?? [],
          constraintKind: 'column-reference',
          constraintName: constraint.constraintName?.name ?? null
        });
        addEdge(relations, byChildTable, byParentTable, seen, tableNames, edge);
      }
    }

    for (const constraint of query.tableConstraints) {
      if (constraint.kind !== 'foreign-key' || !constraint.reference) {
        continue;
      }
      const edge = createEdge({
        childTable,
        parentTable: normalizeRelationTableName(constraint.reference.targetTable.toString()),
        childColumns: constraint.columns?.map((item) => item.name) ?? [],
        parentColumns: constraint.reference.columns?.map((item) => item.name) ?? [],
        constraintKind: 'table-foreign-key',
        constraintName: constraint.constraintName?.name ?? null
      });
      addEdge(relations, byChildTable, byParentTable, seen, tableNames, edge);
    }
  }

  return {
    relations,
    byChildTable,
    byParentTable,
    tableNames
  };
}

/**
 * Return the known parent relations for a child table.
 */
export function getOutgoingRelations(graph: RelationGraph, childTable: string): RelationGraphEdge[] {
  return [...(graph.byChildTable.get(normalizeRelationTableName(childTable)) ?? [])];
}

/**
 * Return the known child relations for a parent table.
 */
export function getIncomingRelations(graph: RelationGraph, parentTable: string): RelationGraphEdge[] {
  return [...(graph.byParentTable.get(normalizeRelationTableName(parentTable)) ?? [])];
}

function addEdge(
  relations: RelationGraphEdge[],
  byChildTable: Map<string, RelationGraphEdge[]>,
  byParentTable: Map<string, RelationGraphEdge[]>,
  seen: Set<string>,
  tableNames: Set<string>,
  edge: RelationGraphEdge
): void {
  tableNames.add(edge.childTable);
  tableNames.add(edge.parentTable);

  const signature = [
    edge.childTable,
    edge.parentTable,
    edge.childColumns.join(','),
    edge.parentColumns.join(','),
    edge.constraintKind
  ].join('|');
  if (seen.has(signature)) {
    return;
  }
  seen.add(signature);

  relations.push(edge);
  pushIndexedEdge(byChildTable, edge.childTable, edge);
  pushIndexedEdge(byParentTable, edge.parentTable, edge);
}

function pushIndexedEdge(
  index: Map<string, RelationGraphEdge[]>,
  key: string,
  edge: RelationGraphEdge
): void {
  const bucket = index.get(key) ?? [];
  bucket.push(edge);
  index.set(key, bucket);
}

function createEdge(params: Omit<RelationGraphEdge, 'isSelfReference'>): RelationGraphEdge {
  return {
    childTable: params.childTable,
    parentTable: params.parentTable,
    childColumns: [...params.childColumns],
    parentColumns: [...params.parentColumns],
    constraintKind: params.constraintKind,
    constraintName: params.constraintName,
    isSelfReference: params.childTable === params.parentTable
  };
}

function buildQualifiedName(namespaces: string[] | null | undefined, name: string): string {
  return [...(namespaces ?? []), name].join('.');
}

function normalizeRelationTableName(tableName: string): string {
  return normalizeTableName(tableName);
}

export function getQualifiedNameText(value: QualifiedName): string {
  return normalizeRelationTableName(value.toString());
}
