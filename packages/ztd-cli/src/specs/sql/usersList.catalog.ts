import { defineSqlCatalogDefinition } from '../sqlCatalogDefinition';

/**
 * Reference SQL catalog definition used by tests and examples.
 */
export const usersListCatalog = defineSqlCatalogDefinition<{ active: number }, { id: number }>({
  id: 'users.list',
  params: { shape: 'named', example: { active: 1 } },
  output: { mapping: { columnMap: { id: 'id' } } },
  sql: 'select id from users where active = :active',
});
