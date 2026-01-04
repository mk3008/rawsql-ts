import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
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
      expect(publicKey).toContain('ddlLint:strict');
      expect(otherKey).toContain('resolver:other|other,public');
    } finally {
      await rm(ddlRoot, { recursive: true, force: true });
    }
  });
});

describe('DdlFixtureLoader ddlLint', () => {
  const createDdlRoot = async (suffix: string): Promise<{ root: string }> => {
    const ddlRoot = path.join('tmp', `ddl-lint-${suffix}`);
    const ddlFile = path.join(ddlRoot, 'tables.sql');
    await mkdir(ddlRoot, { recursive: true });
    await writeFile(
      ddlFile,
      `CREATE TABLE public.users (id int, CONSTRAINT users_missing UNIQUE (missing_col));`
    );
    return { root: ddlRoot };
  };

  it('throws when ddlLint is strict', async () => {
    const { root } = await createDdlRoot('strict');
    try {
      const loader = new DdlFixtureLoader({ directories: [root] });
      expect(() => loader.getFixtures()).toThrow(/DDL integrity check/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('warns when ddlLint is warn', async () => {
    const { root } = await createDdlRoot('warn');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const loader = new DdlFixtureLoader({
        directories: [root],
        ddlLint: 'warn',
      });
      expect(() => loader.getFixtures()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips lint when ddlLint is off', async () => {
    const { root } = await createDdlRoot('off');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const loader = new DdlFixtureLoader({
        directories: [root],
        ddlLint: 'off',
      });
      expect(() => loader.getFixtures()).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });
});
