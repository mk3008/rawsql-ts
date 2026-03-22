import type {
  ApplyPlanOperation,
  DdlApplyPlan,
  DdlDiffRisks,
  DdlDiffSummaryEntry,
  DestructiveRisk,
  OperationalRisk,
} from './ddlDiffContracts';

export function analyzeMigrationPlanRisks(plan: DdlApplyPlan, summary: DdlDiffSummaryEntry[] = []): DdlDiffRisks {
  const destructiveRisks: DestructiveRisk[] = [];
  const operationalRisks: OperationalRisk[] = [];
  const summaryByTable = groupSummaryByTable(summary);
  const rebuiltTables = new Set(
    plan.operations
      .filter((operation) => operation.kind === 'recreate_table')
      .map((operation) => operation.target)
      .filter((target): target is string => Boolean(target))
  );

  for (const operation of plan.operations) {
    switch (operation.kind) {
      case 'drop_table_cascade':
        if (operation.target) {
          destructiveRisks.push(createGuidedRisk('drop_table', operation.target));
          destructiveRisks.push(createGuidedRisk('cascade_drop', operation.target));
        }
        break;
      case 'drop_column_effect':
        if (operation.target) {
          destructiveRisks.push(createGuidedRisk('drop_column', operation.target));
        }
        break;
      case 'alter_type_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('alter_type', operation.target));
        }
        break;
      case 'nullability_tighten_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('nullability_tighten', operation.target));
        }
        break;
      case 'rename_candidate_effect':
        destructiveRisks.push(createDestructiveRisk('rename_candidate', undefined, operation.from, operation.to));
        break;
      case 'semantic_constraint_change_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('semantic_constraint_change', operation.target));
        }
        break;
      case 'recreate_table':
        if (operation.target) {
          operationalRisks.push({ kind: 'table_rebuild', target: operation.target });
          operationalRisks.push({ kind: 'full_table_copy', target: operation.target });
        }
        break;
      case 'index_rebuild_effect':
        if (operation.target) {
          operationalRisks.push({ kind: 'index_rebuild', target: operation.target });
        }
        break;
    }
  }

  // Preserve summary-aware rename and typed column signals that are not recoverable from plan operations alone.
  for (const [tableKey, entries] of summaryByTable.entries()) {
    for (const candidate of findRenameCandidates(entries)) {
      destructiveRisks.push(createDestructiveRisk('rename_candidate', undefined, candidate.from, candidate.to));
    }

    if (!rebuiltTables.has(tableKey)) {
      continue;
    }

    for (const entry of entries.filter((item) => item.changeKind === 'alter_type')) {
      destructiveRisks.push(createDestructiveRisk('alter_type', `${tableKey}.${String(entry.details.column)}`));
    }
  }

  return {
    destructiveRisks: dedupeDestructiveRisks(destructiveRisks),
    operationalRisks: dedupeOperationalRisks(operationalRisks)
  };
}

export function analyzeMigrationSqlRisks(sql: string): DdlDiffRisks {
  const destructiveRisks: DestructiveRisk[] = [];
  const operationalRisks: OperationalRisk[] = [];
  const normalized = sql.replace(/\r\n/g, '\n');
  const statements = normalized
    .split(/;\s*/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  const droppedTables = new Set<string>();
  const createdTables = new Set<string>();
  const rebuiltTables = new Set<string>();
  const createTablesWithConstraints = new Set<string>();
  const alteredConstraintTables = new Set<string>();

  for (const statement of statements) {
    const dropTableMatch = statement.match(/^drop\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)(?:\s+cascade)?$/i);
    if (dropTableMatch) {
      const table = normalizeQualifiedTarget(dropTableMatch[1]);
      destructiveRisks.push(createGuidedRisk('drop_table', table));
      if (/\bcascade\b/i.test(statement)) {
        destructiveRisks.push(createGuidedRisk('cascade_drop', table));
      }
      droppedTables.add(table);
      continue;
    }

    const createTableMatch = statement.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i);
    if (createTableMatch) {
      const table = normalizeQualifiedTarget(createTableMatch[1]);
      createdTables.add(table);

      // Rebuilt CREATE TABLE statements can reintroduce or tighten constraints without explicit ALTER CONSTRAINT steps.
      if (hasConstraintLikeClause(statement)) {
        createTablesWithConstraints.add(table);
      }
      continue;
    }

    const dropColumnMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s+drop\s+column\s+(?:if\s+exists\s+)?("?[\w$]+"?)/i);
    if (dropColumnMatch) {
      destructiveRisks.push(createGuidedRisk('drop_column', `${normalizeQualifiedTarget(dropColumnMatch[1])}.${normalizeIdentifier(dropColumnMatch[2])}`));
      continue;
    }

    const alterTypeMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s+alter\s+column\s+("?[\w$]+"?)\s+type\b/i);
    if (alterTypeMatch) {
      destructiveRisks.push(createDestructiveRisk('alter_type', `${normalizeQualifiedTarget(alterTypeMatch[1])}.${normalizeIdentifier(alterTypeMatch[2])}`));
      continue;
    }

    const setNotNullMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s+alter\s+column\s+("?[\w$]+"?)\s+set\s+not\s+null\b/i);
    if (setNotNullMatch) {
      destructiveRisks.push(createDestructiveRisk('nullability_tighten', `${normalizeQualifiedTarget(setNotNullMatch[1])}.${normalizeIdentifier(setNotNullMatch[2])}`));
      continue;
    }

    const addConstraintMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s+add\s+constraint\s+("?[\w$]+"?)/i);
    if (addConstraintMatch) {
      const table = normalizeQualifiedTarget(addConstraintMatch[1]);
      alteredConstraintTables.add(table);
      destructiveRisks.push(createDestructiveRisk('semantic_constraint_change', table));
      continue;
    }

    const dropConstraintMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s+drop\s+constraint\s+(?:if\s+exists\s+)?("?[\w$]+"?)/i);
    if (dropConstraintMatch) {
      const table = normalizeQualifiedTarget(dropConstraintMatch[1]);
      alteredConstraintTables.add(table);
      destructiveRisks.push(createDestructiveRisk('semantic_constraint_change', table));
      continue;
    }

    const createIndexMatch = statement.match(/^create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?("?[\w$]+"?).*?\bon\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i);
    if (createIndexMatch) {
      const indexName = normalizeIdentifier(createIndexMatch[1]);
      const tableTarget = normalizeQualifiedTarget(createIndexMatch[2]);
      if (droppedTables.has(tableTarget)) {
        operationalRisks.push({ kind: 'index_rebuild', target: indexName });
      }
    }
  }

  for (const table of droppedTables) {
    if (createdTables.has(table)) {
      rebuiltTables.add(table);
    }
  }

  for (const table of rebuiltTables) {
    operationalRisks.push({ kind: 'table_rebuild', target: table });
    operationalRisks.push({ kind: 'full_table_copy', target: table });

    if (createTablesWithConstraints.has(table) || alteredConstraintTables.has(table)) {
      destructiveRisks.push(createDestructiveRisk('semantic_constraint_change', table));
    }
  }

  return {
    destructiveRisks: dedupeDestructiveRisks(destructiveRisks),
    operationalRisks: dedupeOperationalRisks(operationalRisks)
  };
}

function createGuidedRisk(kind: 'drop_table' | 'drop_column' | 'cascade_drop', target: string): DestructiveRisk {
  return {
    kind,
    target,
    avoidable: true,
    guidance: ['review_if_required', 'avoid_if_possible', 'cli_option_not_exposed']
  };
}

function createDestructiveRisk(
  kind: Exclude<DestructiveRisk['kind'], 'drop_table' | 'drop_column' | 'cascade_drop'>,
  target?: string,
  from?: string,
  to?: string
): DestructiveRisk {
  return {
    kind,
    target,
    from,
    to,
    guidance: ['review_if_required']
  };
}

function dedupeDestructiveRisks(risks: DestructiveRisk[]): DestructiveRisk[] {
  const seen = new Map<string, DestructiveRisk>();
  for (const risk of risks) {
    const key = JSON.stringify({
      kind: risk.kind,
      target: risk.target ?? '',
      from: risk.from ?? '',
      to: risk.to ?? ''
    });
    if (!seen.has(key)) {
      seen.set(key, risk);
    }
  }

  return [...seen.values()].sort((left, right) => {
    const leftKey = `${left.kind}:${left.target ?? left.from ?? ''}:${left.to ?? ''}`;
    const rightKey = `${right.kind}:${right.target ?? right.from ?? ''}:${right.to ?? ''}`;
    return leftKey.localeCompare(rightKey);
  });
}

function dedupeOperationalRisks(risks: OperationalRisk[]): OperationalRisk[] {
  const seen = new Map<string, OperationalRisk>();
  for (const risk of risks) {
    const key = `${risk.kind}:${risk.target}`;
    if (!seen.has(key)) {
      seen.set(key, risk);
    }
  }

  return [...seen.values()].sort((left, right) => {
    const leftKey = `${left.kind}:${left.target}`;
    const rightKey = `${right.kind}:${right.target}`;
    return leftKey.localeCompare(rightKey);
  });
}

function groupSummaryByTable(summary: DdlDiffSummaryEntry[]): Map<string, DdlDiffSummaryEntry[]> {
  const grouped = new Map<string, DdlDiffSummaryEntry[]>();
  for (const entry of summary) {
    const key = `${entry.schema}.${entry.table}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }
  return grouped;
}

function findRenameCandidates(entries: DdlDiffSummaryEntry[]): Array<{ from: string; to: string }> {
  const addedColumns = entries.filter((entry) => entry.changeKind === 'add_column');
  const droppedColumns = entries.filter((entry) => entry.changeKind === 'drop_column');
  const candidates: Array<{ from: string; to: string }> = [];

  for (const dropped of droppedColumns) {
    const matched = addedColumns.find((entry) => normalizeSql(String(entry.details.type)) === normalizeSql(String(dropped.details.type)));
    if (!matched) {
      continue;
    }

    const tableKey = `${dropped.schema}.${dropped.table}`;
    candidates.push({
      from: `${tableKey}.${String(dropped.details.column)}`,
      to: `${tableKey}.${String(matched.details.column)}`
    });
  }

  return candidates;
}

function normalizeQualifiedTarget(value: string): string {
  const cleaned = value.trim();
  const segments = cleaned.split('.');
  if (segments.length === 1) {
    return `public.${normalizeIdentifier(segments[0])}`;
  }

  return `${normalizeIdentifier(segments[0])}.${normalizeIdentifier(segments[1])}`;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/^"/, '').replace(/"$/, '');
}

function normalizeSql(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function hasConstraintLikeClause(statement: string): boolean {
  const bodyStart = statement.indexOf('(');
  const bodyEnd = statement.lastIndexOf(')');
  if (bodyStart === -1 || bodyEnd <= bodyStart) {
    return false;
  }

  const body = statement.slice(bodyStart + 1, bodyEnd);
  return /\bconstraint\b|\bprimary\s+key\b|\bforeign\s+key\b|\breferences\b|\bcheck\b|\bunique\b/i.test(body);
}

// Re-exporting the shape keeps future SQL re-evaluation entrypoints on the same contract.
export type { DdlDiffRisks, DdlApplyPlan, DdlDiffSummaryEntry } from './ddlDiffContracts';
