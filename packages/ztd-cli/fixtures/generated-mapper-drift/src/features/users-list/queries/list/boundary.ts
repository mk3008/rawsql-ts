import { z } from 'zod';
import { mapListRowsToResult } from './generated/row-mapper.js';

const RowSchema = z.object({
  id: z.string(),
  email: z.string(),
}).strict();

const QueryResultSchema = z.object({
  items: z.array(RowSchema),
}).strict();

export type ListQueryResult = z.infer<typeof QueryResultSchema>;
export type ListRow = z.infer<typeof RowSchema>;

export async function executeListQuerySpec(rows: ListRow[]): Promise<ListQueryResult> {
  return mapListRowsToResult(rows);
}
