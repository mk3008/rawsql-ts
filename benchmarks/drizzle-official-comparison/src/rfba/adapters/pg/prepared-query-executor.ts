import type { Row } from '../../../local/sql-contract-mapper';
import type { PreparedQuery } from '../../features/_shared/queryCatalog';
import { pool } from './pool';

export const executePreparedRows = async (
  query: PreparedQuery,
  values: readonly unknown[] = [],
): Promise<Row[]> => {
  const result = await pool.query({
    name: query.name,
    text: query.text,
    values: values as unknown[],
  });
  return result.rows;
};

export const executePrepared = async (
  query: PreparedQuery,
  values: readonly unknown[] = [],
): Promise<{
  rows: Row[];
  rowCount?: number;
}> => {
  const result = await pool.query({
    name: query.name,
    text: query.text,
    values: values as unknown[],
  });
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? undefined,
  };
};
