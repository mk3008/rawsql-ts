import { useState, type ReactNode } from 'react';
import {
  demoTools,
  initialInputs,
  runDemoTool,
  type DemoInput,
  type DemoToolId,
} from './demoModel';

export function McpToolsDemoApp() {
  const [toolId, setToolId] = useState<DemoToolId>('analyze_query_structure');
  const [input, setInput] = useState<DemoInput>(initialInputs.analyze_query_structure);
  const [result, setResult] = useState<object>(() => runDemoTool('analyze_query_structure', input));
  const [error, setError] = useState<string | null>(null);
  const selectedTool = demoTools.find((tool) => tool.id === toolId)!;

  const selectTool = (next: DemoToolId) => {
    const nextInput = initialInputs[next];
    setToolId(next);
    setInput(nextInput);
    execute(next, nextInput);
  };
  const update = (change: Partial<DemoInput>) => {
    setInput((current) => ({ ...current, ...change }));
    setError(null);
  };
  const execute = (selected = toolId, value = input) => {
    try {
      setResult(runDemoTool(selected, value));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <main className="catalog-shell">
      <header className="catalog-header">
        <strong>rawsql-ts</strong>
        <span>MCP tool catalog</span>
      </header>

      <section className="tool-section" aria-labelledby="tool-list-title">
        <h1 id="tool-list-title">Local MCP capabilities</h1>
        <div className="tool-list">
          {demoTools.map((tool) => (
            <button
              aria-pressed={tool.id === toolId}
              className={tool.id === toolId ? 'active' : ''}
              key={tool.id}
              onClick={() => selectTool(tool.id)}
              type="button"
            >
              {tool.label}
              <small>{tool.experimental ? 'Experimental' : '\u00a0'}</small>
            </button>
          ))}
        </div>
        <article className="tool-overview">
          <h2>{selectedTool.label}</h2>
          <p>{selectedTool.summary}</p>
          <dl className="tool-identity">
            <dt>MCP tool name</dt>
            <dd><code>{selectedTool.id}</code></dd>
          </dl>
        </article>
      </section>

      <section className="workbench">
        <div className="panel inputs">
          <div className="panel-heading">
            <h2>Input</h2>
            <button className="run" onClick={() => execute()} type="button">Run</button>
          </div>
          {toolId === 'find_query_usage' ? (
            <>
              <label><span>Search target kind <small>Required. Choose table or column.</small></span>
                <select value={input.usageKind} onChange={(event) => update({ usageKind: event.target.value as DemoInput['usageKind'] })}>
                  <option value="table">table</option><option value="column">column</option>
                </select>
              </label>
              <TextInput label="Search directory" help="Optional. Enter a workspace-relative directory. Its .sql files are searched recursively." value={input.scopeDir} onChange={(scopeDir) => update({ scopeDir })} />
              <TextInput label="Search target" help="Required. Enter schema.table or schema.table.column." value={input.usageTarget} onChange={(usageTarget) => update({ usageTarget })} />
            </>
          ) : null}
          {toolId === 'extract_cte_query' ? <TextInput label="CTE name" help="Required. Enter the CTE to extract." value={input.cteName} onChange={(cteName) => update({ cteName })} /> : null}
          {toolId === 'analyze_column_lineage' ? <TextInput label="Output column" help="Required. Enter one unique final output column name." value={input.targetColumn} onChange={(targetColumn) => update({ targetColumn })} /> : null}
          {toolId === 'slice_query' ? (
            <label><span>Query scope selector <small>Required. Paste a V1 selector from the full query-structure result for the same SQL.</small></span>
              <textarea value={input.selector} onChange={(event) => update({ selector: event.target.value })} spellCheck={false} />
            </label>
          ) : null}
          {toolId === 'optimize_sql_conditions' ? (
            <TextInput
              label="Optional search conditions"
              help={<>Optional. Enter the parameter names for conditions to remove, separated by commas. <a href="https://mk3008.github.io/rawsql-ts/guide/sssql-for-humans" rel="noreferrer" target="_blank">Learn about the SSSQL convention.</a></>}
              value={input.absentParameterNames}
              onChange={(absentParameterNames) => update({ absentParameterNames })}
            />
          ) : null}
          {toolId !== 'find_query_usage' ? (
            <label><span>SQL <small>Required. Enter the SQL to analyze or transform.</small></span>
              <textarea value={input.sql} onChange={(event) => update({ sql: event.target.value })} spellCheck={false} />
            </label>
          ) : null}
          {(['analyze_query_structure', 'analyze_column_lineage', 'slice_query', 'create_fixture_extraction_plan'] as DemoToolId[]).includes(toolId) ? (
            <label><span>DDL <small>Optional. Enter DDL to resolve tables, columns, and keys.</small></span>
              <textarea value={input.ddl} onChange={(event) => update({ ddl: event.target.value })} spellCheck={false} />
            </label>
          ) : null}
        </div>

        <div className="panel output" aria-live="polite">
          <div className="panel-heading"><h2>Output</h2></div>
          {error
            ? <p className="error">{error}</p>
            : <pre><code>{JSON.stringify(result, null, 2)}</code></pre>}
        </div>
      </section>
    </main>
  );
}

function TextInput(props: { help: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return <label><span>{props.label} <small>{props.help}</small></span><input value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}
