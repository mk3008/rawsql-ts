import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import type { QueryCatalog } from '../_shared/queryCatalog';
import { mapEmployeeWithRecipientRowsToResult } from './generated/row-mapper';

export type Employee = {
  id: number;
  lastName: string;
  firstName: string | null;
  title: string;
  titleOfCourtesy: string;
  birthDate: string;
  hireDate: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  homePhone: string;
  extension: number;
  notes: string;
  recipientId: number | null;
  recipient?: Employee | null;
};

export const executeGetEmployeeWithRecipientEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
): Promise<Employee[]> => {
  const rows = await executeRows(executor, queries.employeeWithRecipient, [id]);
  return mapEmployeeWithRecipientRowsToResult(rows);
};
