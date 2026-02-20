import { usersListCatalog } from '../../../src/specs/sql/usersList.catalog';
import { defineSqlCatalog } from '../../utils/sqlCatalog';

/**
 * Minimal SQL catalog spec used as a reference for data-only test cases.
 */
export const sampleSqlCatalog = defineSqlCatalog({
  id: 'sql.sample',
  title: 'sample sql cases',
  fixtures: [
    {
      tableName: 'users',
      rows: [
        { id: 1, active: 1 },
        { id: 2, active: 0 },
      ],
      schema: { columns: { id: 'INTEGER', active: 'INTEGER' } },
    },
  ],
  catalog: usersListCatalog,
  cases: [
    {
      id: 'returns-inactive-users-when-active-0',
      title: 'returns inactive users when active=0',
      arrange: () => ({ active: 0 }),
      expected: [{ id: 2 }],
    },
    {
      id: 'returns-active-users',
      title: 'returns active users',
      expected: [{ id: 1 }],
    },
  ],
});
