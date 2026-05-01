import type { Row } from '../../../local/sql-contract-mapper';

export const rowsAsDto = <T>(rows: Row[]): T[] => rows as T[];

export const first = <T>(rows: T[]): T | undefined => rows[0];
