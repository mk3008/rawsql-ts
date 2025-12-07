import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DdlFixtureLoader } from '../src/fixtures/DdlFixtureLoader';
import { TableNameResolver } from '../src/fixtures/TableNameResolver';

describe('DdlFixtureLoader cache key', () => {
  it('includes resolver configuration so schema-aware clients do not share cache entries', async () => {
    const ddlRoot = path.join('tmp', 'ddl-cache-demo');
    const ddlFile = path.join(ddlRoot, 'tables.sql');
    await mkdir(ddlRoot, { recursive: true });

    try {
      await writeFile(ddlFile, 'CREATE TABLE foo (id int);');
      const resolverPublic = new TableNameResolver({ defaultSchema: 'public', searchPath: ['public'] });
      const resolverOther = new TableNameResolver({
        defaultSchema: 'other',
        searchPath: ['other', 'public'],
      });
      const loaderPublic = new DdlFixtureLoader({
        directories: [ddlRoot],
        tableNameResolver: resolverPublic,
      });
      const loaderOther = new DdlFixtureLoader({
        directories: [ddlRoot],
        tableNameResolver: resolverOther,
      });

      // Read the cache keys to ensure resolver state is embedded in each entry.
      const publicKey = Reflect.get(loaderPublic, 'cacheKey') as string;
      const otherKey = Reflect.get(loaderOther, 'cacheKey') as string;
      expect(publicKey).not.toEqual(otherKey);
      expect(publicKey).toContain('resolver:public|public');
      expect(otherKey).toContain('resolver:other|other,public');
    } finally {
      await rm(ddlRoot, { recursive: true, force: true });
    }
  });
});
