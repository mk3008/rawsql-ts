import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { DdlFixtureLoader } from '../src/fixtures/DdlFixtureLoader';
import { TableNameResolver } from '../src/fixtures/TableNameResolver';
import {
  DdlViewUnsupportedError,
  collectDdlViewDefinitions,
} from '../src/fixtures/DdlViewCatalog';

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

describe('DDL view extraction', () => {
  it('extracts simple CREATE VIEW definitions from DDL sources', () => {
    const resolver = new TableNameResolver({ defaultSchema: 'public', searchPath: ['public'] });
    const views = collectDdlViewDefinitions(
      [
        {
          path: 'db/ddl/views.sql',
          sql: `
            CREATE VIEW public.active_users AS
            SELECT id, name
            FROM public.users
            WHERE role = 'admin';
          `,
        },
      ],
      { tableNameResolver: resolver }
    );

    expect(views).toEqual([
      expect.objectContaining({
        name: 'public.active_users',
        cteName: 'active_users',
        source: 'db/ddl/views.sql',
        sql: expect.stringMatching(/^SELECT id, name/i),
      }),
    ]);
  });

  it('extracts CREATE OR REPLACE VIEW definitions and dependent views', () => {
    const resolver = new TableNameResolver({ defaultSchema: 'public', searchPath: ['public'] });
    const views = collectDdlViewDefinitions(
      [
        {
          path: 'db/ddl/views.sql',
          sql: `
            CREATE OR REPLACE VIEW public.active_users AS
            SELECT id, name FROM public.users WHERE role = 'admin';

            CREATE VIEW public.active_user_names AS
            SELECT name FROM public.active_users;
          `,
        },
      ],
      { tableNameResolver: resolver }
    );

    expect(views.map((view) => view.name)).toEqual([
      'public.active_users',
      'public.active_user_names',
    ]);
  });

  it('rejects unsupported materialized and recursive views', () => {
    expect(() =>
      collectDdlViewDefinitions([
        {
          path: 'db/ddl/views.sql',
          sql: 'CREATE MATERIALIZED VIEW public.active_users AS SELECT id FROM public.users;',
        },
      ])
    ).toThrow(DdlViewUnsupportedError);

    expect(() =>
      collectDdlViewDefinitions([
        {
          path: 'db/ddl/views.sql',
          sql: 'CREATE VIEW public.active_users AS WITH RECURSIVE u AS (SELECT 1) SELECT * FROM u;',
        },
      ])
    ).toThrow(DdlViewUnsupportedError);

    expect(() =>
      collectDdlViewDefinitions([
        {
          path: 'db/ddl/views.sql',
          sql: 'CREATE VIEW public.active_users WITH (security_barrier) AS SELECT id FROM public.users;',
        },
      ])
    ).toThrow(DdlViewUnsupportedError);
  });

  it('rejects cyclic view dependencies', () => {
    expect(() =>
      collectDdlViewDefinitions([
        {
          path: 'db/ddl/views.sql',
          sql: `
            CREATE VIEW public.a AS SELECT id FROM public.b;
            CREATE VIEW public.b AS SELECT id FROM public.a;
          `,
        },
      ], {
        tableNameResolver: new TableNameResolver({ defaultSchema: 'public', searchPath: ['public'] }),
      })
    ).toThrow(/Circular CREATE VIEW dependency/);
  });

  it('exposes DDL-derived view definitions from DdlFixtureLoader', async () => {
    const ddlRoot = path.join('tmp', 'ddl-view-loader');
    const ddlFile = path.join(ddlRoot, 'views.sql');
    await mkdir(ddlRoot, { recursive: true });

    try {
      await writeFile(
        ddlFile,
        `
          CREATE TABLE public.users (id int, name text, role text);
          CREATE VIEW public.active_users AS
          SELECT id, name FROM public.users WHERE role = 'admin';
        `
      );

      const loader = new DdlFixtureLoader({
        directories: [ddlRoot],
        tableNameResolver: new TableNameResolver({ defaultSchema: 'public', searchPath: ['public'] }),
      });

      expect(loader.getFixtures()).toHaveLength(1);
      expect(loader.getViewDefinitions()).toEqual([
        expect.objectContaining({
          name: 'public.active_users',
          cteName: 'active_users',
        }),
      ]);
    } finally {
      await rm(ddlRoot, { recursive: true, force: true });
    }
  });
});
