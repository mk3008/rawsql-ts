import { describe, expect, it } from 'vitest';
import { demoToolIds, demoTools, initialInputs, runDemoTool } from './demoModel';

describe('MCP tool catalog demo', () => {
  it('contains and runs all seven catalog tools', () => {
    expect(demoToolIds).toHaveLength(7);
    for (const toolId of demoToolIds) {
      expect(runDemoTool(toolId, initialInputs[toolId])).toBeTypeOf('object');
    }
  });

  it('models recursive SQL-file search without requiring inline SQL', () => {
    const input = { ...initialInputs.find_query_usage, sql: '', scopeDir: 'queries' };
    const result = runDemoTool('find_query_usage', input) as {
      matches: Array<{ sql_file: string }>;
      source: { kind: string; scopeDir: string };
      summary: { sqlFilesScanned: number };
    };

    expect(result.source).toEqual({ kind: 'sql-files', scopeDir: 'queries' });
    expect(result.summary.sqlFilesScanned).toBe(1);
    expect(result.matches.map((match) => match.sql_file)).toEqual(['queries/orders/list.sql']);
  });

  it('demonstrates optional-condition pruning and duplicate-condition removal together', () => {
    const result = runDemoTool('optimize_sql_conditions', initialInputs.optimize_sql_conditions) as {
      applied: Array<{ kind: string; parameterName?: string }>;
      sql: string;
    };

    expect(initialInputs.optimize_sql_conditions.absentParameterNames).toBe('amount');
    expect(result.sql).not.toContain(':amount');
    expect(result.applied).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'prune_optional_branch', parameterName: 'amount' }),
      expect.objectContaining({ kind: 'dedupe_condition' }),
    ]));
  });

  it('keeps catalog metadata and validation errors in English', () => {
    const catalogCopy = demoTools.flatMap((tool) => [tool.label, tool.summary]).join(' ');
    expect(catalogCopy).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
    expect(() => runDemoTool('optimize_sql_conditions', {
      ...initialInputs.optimize_sql_conditions,
      sql: '',
    })).toThrow('Enter SQL.');
  });
});
