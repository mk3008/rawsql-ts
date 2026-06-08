import { describe, expect, it } from 'vitest';
import { SSSQLFilterBuilder } from '../../src/transformers/SSSQLFilterBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const applyPlan = (sql: string, edits: readonly { start: number; end: number; after: string }[]): string => {
    return [...edits]
        .sort((left, right) => right.start - left.start)
        .reduce((current, edit) => {
            return current.slice(0, edit.start) + edit.after + current.slice(edit.end);
        }, sql);
};

describe('SSSQLFilterBuilder', () => {
    it('plans scalar scaffold as a minimal insert without reformatting existing SQL', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            -- keep report comment
            SELECT u.id, u.name
            FROM users u
            WHERE u.active = true
        `;

        const plan = builder.planScaffold(sql, { 'users.name': 'Alice' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.edits).toHaveLength(1);
        expect(plan.edits[0]).toEqual(expect.objectContaining({
            before: '',
            kind: 'insert',
            target: {
                branchKind: 'scalar',
                parameterName: 'users_name',
                column: 'u.name'
            }
        }));
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.sql).toContain('and (:users_name is null or u.name = :users_name)');
        expect(plan.safety.tokenCountAfter).toBeGreaterThan(plan.safety.tokenCountBefore);
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.safety.commentsPreserved).toBe(true);
        expect(plan.safety.changedRegions).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'boolean-operator' }),
            expect.objectContaining({ kind: 'target-branch' })
        ]));
        expect(plan.warnings).toEqual([]);
        expect(plan.errors).toEqual([]);
    });

    it('plans scalar scaffold into a query without WHERE as a minimal WHERE insert', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select u.id, u.name from users u order by u.id';

        const plan = builder.planScaffold(sql, { 'users.name': 'Alice' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe('select u.id, u.name from users u where (:users_name is null or u.name = :users_name) order by u.id');
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.safety.changedRegions).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'where-keyword' }),
            expect.objectContaining({ kind: 'target-branch' })
        ]));
    });

    it('plans scalar scaffold into the root query when earlier CTEs already contain WHERE clauses', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            with latest_customer_reply as (
                select tm.ticket_id, max(tm.created_at) as last_customer_reply_at
                from ticket_messages tm
                where tm.sender_role = 'customer'
                group by tm.ticket_id
            )
            select t.ticket_id, t.status
            from tickets t
            left join latest_customer_reply lcr on lcr.ticket_id = t.ticket_id
            order by t.ticket_id
        `;

        const plan = builder.planScaffoldBranch(sql, {
            target: 'tickets.status',
            parameterName: 'status',
            operator: '='
        });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(normalizeSql(plan.sql ?? '')).toContain(
            "where tm.sender_role = 'customer' group by tm.ticket_id"
        );
        expect(normalizeSql(plan.sql ?? '')).toContain(
            'from tickets t left join latest_customer_reply lcr on lcr.ticket_id = t.ticket_id where (:status is null or t.status = :status) order by t.ticket_id'
        );
    });

    it('does not add a duplicate scalar branch when an equivalent casted null guard already exists', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select t.ticket_id, t.status
            from tickets t
            where (cast(:status as text) is null or t.status = :status)
            order by t.ticket_id
        `;

        const plan = builder.planScaffoldBranch(sql, {
            target: 'tickets.status',
            parameterName: 'status',
            operator: '='
        });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.edits).toHaveLength(0);
        expect(plan.sql).toBe(sql);
    });

    it('plans scalar scaffold for AS aliases and quoted identifiers without full reformat', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select "u"."id", "u"."name" from "users" as "u" where "u"."active" = true';

        const plan = builder.planScaffold(sql, { 'users.name': 'Alice' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.sql).toContain('and (:users_name is null or "u"."name" = :users_name)');
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
    });

    it('falls back to formatter-backed scaffold planning for nested query targets', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            with base_users as (
                select u.id, u.name
                from users u
            )
            select b.id
            from base_users b
        `;

        const plan = builder.planScaffold(sql, { 'users.name': 'Alice' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(true);
        expect(plan.safety.changedOnlyTargetBranches).toBe(false);
        expect(normalizeSql(plan.sql ?? '')).toContain('from "users" as "u" where (:users_name is null or "u"."name" = :users_name)');
        expect(normalizeSql(plan.sql ?? '')).toContain('select "b"."id" from "base_users" as "b"');
    });

    it('plans exists and not-exists scaffold branches as minimal inserts', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select p.product_id, p.product_name from products p where p.active = true order by p.product_id';

        const existsPlan = builder.planScaffoldBranch(sql, {
            kind: 'exists',
            parameterName: 'category_name',
            anchorColumns: ['products.product_id'],
            query: `
                select 1
                from product_categories pc
                where pc.product_id = $c0
                  and pc.category_name = :category_name
            `
        });

        expect(existsPlan.ok).toBe(true);
        expect(existsPlan.requiresFullReformat).toBe(false);
        expect(existsPlan.sql).toBe(applyPlan(sql, existsPlan.edits));
        expect(existsPlan.sql).toContain('and (:category_name is null or exists');
        expect(existsPlan.sql).toContain('pc.product_id = p.product_id');
        expect(existsPlan.safety.changedOnlyTargetBranches).toBe(true);

        const notExistsPlan = builder.planScaffoldBranch(sql, {
            kind: 'not-exists',
            parameterName: 'archived_name',
            anchorColumns: ['products.product_id'],
            query: `
                select 1
                from archived_products ap
                where ap.product_id = $c0
                  and ap.product_name = :archived_name
            `
        });

        expect(notExistsPlan.ok).toBe(true);
        expect(notExistsPlan.requiresFullReformat).toBe(false);
        expect(notExistsPlan.sql).toBe(applyPlan(sql, notExistsPlan.edits));
        expect(notExistsPlan.sql).toContain('and (:archived_name is null or not exists');
        expect(notExistsPlan.sql).toContain('ap.product_id = p.product_id');
        expect(notExistsPlan.safety.changedOnlyTargetBranches).toBe(true);
    });

    it('plans refresh rewrites and exposes the rewritten SQL without applying it to the input text', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            WITH base_orders AS (
                SELECT o.order_id, o.status
                FROM orders o
            )
            SELECT b.order_id
            FROM base_orders b
            WHERE (:orders_status IS NULL OR lower(b.status) LIKE lower(:orders_status))
        `;

        const plan = builder.planRefresh(sql, { 'orders.status': { '=': 'paid' } });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(true);
        expect(plan.sql).toContain(':orders_status is null');
        expect(normalizeSql(plan.sql ?? '')).toContain('from "orders" as "o" where (:orders_status is null or lower("o"."status") like lower(:orders_status))');
        expect(plan.safety.changedOnlyTargetBranches).toBe(false);
    });

    it('plans scalar remove as a minimal delete', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select p.product_id, p.product_name from products p where p.active = true and (:product_name is null or p.product_name ilike :product_name) order by p.product_id';

        const plan = builder.planRemove(sql, { parameterName: 'product_name', kind: 'scalar' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.edits).toHaveLength(1);
        expect(plan.edits[0]).toEqual(expect.objectContaining({
            kind: 'delete',
            target: expect.objectContaining({
                branchKind: 'scalar',
                parameterName: 'product_name'
            })
        }));
        expect(plan.sql).not.toContain(':product_name');
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.safety.changedRegions).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'boolean-operator' }),
            expect.objectContaining({ kind: 'target-branch' })
        ]));
    });

    it('plans scalar remove without leaving an empty WHERE clause', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select p.product_id from products p where (:product_name is null or p.product_name = :product_name) order by p.product_id';

        const plan = builder.planRemove(sql, { parameterName: 'product_name', kind: 'scalar' });

        expect(plan.ok).toBe(true);
        expect(plan.sql).toBe('select p.product_id from products p order by p.product_id');
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.sql).not.toMatch(/\bwhere\b/i);
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.safety.changedRegions).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'where-keyword' }),
            expect.objectContaining({ kind: 'target-branch' })
        ]));
    });

    it('plans scalar remove at the beginning of a compound WHERE clause', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = 'select p.product_id from products p where (:product_name is null or p.product_name = :product_name) and p.active = true';

        const plan = builder.planRemove(sql, { parameterName: 'product_name', kind: 'scalar' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe('select p.product_id from products p where p.active = true');
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
    });

    it('plans exists branch remove as a minimal delete', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select p.product_id
            from products p
            where p.active = true
              and (:category_name is null or exists (
                select 1
                from product_categories pc
                where pc.product_id = p.product_id
                  and pc.category_name = :category_name
              ))
        `;

        const plan = builder.planRemove(sql, { parameterName: 'category_name', kind: 'exists' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.sql).not.toContain(':category_name');
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.edits[0]?.target).toEqual(expect.objectContaining({
            branchKind: 'exists',
            parameterName: 'category_name'
        }));
    });

    it('plans not-exists branch remove as a minimal delete', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select p.product_id
            from products p
            where p.active = true
              and (:archived_name is null or not exists (
                select 1
                from archived_products ap
                where ap.product_id = p.product_id
                  and ap.product_name = :archived_name
              ))
        `;

        const plan = builder.planRemove(sql, { parameterName: 'archived_name', kind: 'not-exists' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(false);
        expect(plan.sql).toBe(applyPlan(sql, plan.edits));
        expect(plan.sql).not.toContain(':archived_name');
        expect(plan.safety.changedOnlyTargetBranches).toBe(true);
        expect(plan.edits[0]?.target).toEqual(expect.objectContaining({
            branchKind: 'not-exists',
            parameterName: 'archived_name'
        }));
    });

    it('falls back to formatter-backed remove planning for ambiguous source spans', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select p.product_id
            from products p
            where p.active = true
              and (:product_name is null or p.product_name = :product_name)
              /* archived example: (:product_name is null or old.product_name = :product_name) */
        `;

        const plan = builder.planRemove(sql, { parameterName: 'product_name', kind: 'scalar' });

        expect(plan.ok).toBe(true);
        expect(plan.requiresFullReformat).toBe(true);
        expect(plan.errors).toEqual([]);
        expect(plan.warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'FULL_REFORMAT_REQUIRED' })
        ]));
        expect(normalizeSql(plan.sql ?? '')).toBe('select "p"."product_id" from "products" as "p" where "p"."active" = true');
    });

    it('reports rewrite failures as plan errors instead of throwing', () => {
        const builder = new SSSQLFilterBuilder();

        const plan = builder.planScaffold(
            `
                SELECT u.name, p.name
                FROM users u
                JOIN profiles p ON p.user_id = u.id
            `,
            { name: 'Alice' }
        );

        expect(plan.ok).toBe(false);
        expect(plan.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'REWRITE_FAILED',
                detail: expect.stringMatching(/ambiguous/i)
            })
        ]));
        expect(plan.sql).toBeUndefined();
    });

    it('scaffolds an equality-based optional filter into a simple query', () => {
        const builder = new SSSQLFilterBuilder();
        const query = builder.scaffold(
            `
                SELECT u.id, u.name
                FROM users u
                WHERE u.active = true
            `,
            { 'users.name': 'Alice' }
        );

        const normalized = normalizeSql(new SqlFormatter().format(query).formattedSql);
        expect(normalized).toContain('where "u"."active" = true and (:users_name is null or "u"."name" = :users_name)');
    });

    it('rejects ambiguous unqualified scaffold targets', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.scaffold(
            `
                SELECT u.name, p.name
                FROM users u
                JOIN profiles p ON p.user_id = u.id
            `,
            { name: 'Alice' }
        )).toThrow(/ambiguous/i);
    });

    it('rejects non-equality scaffold filters in v1', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.scaffold(
            `
                SELECT p.product_id, p.brand_name
                FROM products p
            `,
            { brand_name: { like: 'Acme%' } as unknown }
        )).toThrow(/only supports equality/i);
    });

    it('refresh moves an existing optional branch without changing its predicate shape', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                WITH base_orders AS (
                    SELECT o.order_id, o.status
                    FROM orders o
                )
                SELECT b.order_id
                FROM base_orders b
                WHERE (:orders_status IS NULL OR lower(b.status) LIKE lower(:orders_status))
            `,
            { 'orders.status': { '=': 'paid' } }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('with "base_orders" as (select "o"."order_id", "o"."status" from "orders" as "o" where (:orders_status is null or lower("o"."status") like lower(:orders_status)))');
        expect(normalized).toContain('select "b"."order_id" from "base_orders" as "b"');
    });

    it('scaffolds a new branch during refresh when none exists yet', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                SELECT p.product_id, p.product_name
                FROM products p
                WHERE p.active = true
            `,
            { 'products.product_name': 'shoe' }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('where "p"."active" = true and (:products_product_name is null or "p"."product_name" = :products_product_name)');
    });

    it('scaffolds operator-based branches idempotently and normalizes != to <>', () => {
        const builder = new SSSQLFilterBuilder();
        const once = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.brand_name
                FROM products p
            `,
            {
                target: 'products.brand_name',
                parameterName: 'brand_name',
                operator: '!='
            }
        );

        const twice = builder.scaffoldBranch(once, {
            target: 'products.brand_name',
            parameterName: 'brand_name',
            operator: '<>'
        });

        const normalized = normalizeSql(new SqlFormatter().format(twice).formattedSql);
        expect(normalized).toContain('(:brand_name is null or "p"."brand_name" <> :brand_name)');
        expect(normalized.match(/:brand_name is null or "p"\."brand_name" <> :brand_name/g)?.length).toBe(1);
    });

    it('scaffolds exists and not-exists branches from explicit subquery input', () => {
        const builder = new SSSQLFilterBuilder();
        const existsQuery = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                kind: 'exists',
                parameterName: 'category_name',
                anchorColumns: ['products.product_id'],
                query: `
                    SELECT 1
                    FROM product_categories pc
                    JOIN categories c
                      ON c.category_id = pc.category_id
                    WHERE pc.product_id = $c0
                      AND c.category_name = :category_name
                `
            }
        );

        const notExistsQuery = builder.scaffoldBranch(existsQuery, {
            kind: 'not-exists',
            parameterName: 'archived_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM archived_products ap
                WHERE ap.product_id = $c0
                  AND ap.product_name = :archived_name
            `
        });

        const normalized = normalizeSql(new SqlFormatter().format(notExistsQuery).formattedSql);
        expect(normalized).toContain(':category_name is null or exists');
        expect(normalized).toContain('"pc"."product_id" = "p"."product_id"');
        expect(normalized).toContain(':archived_name is null or not exists');
    });

    it('refresh relocates correlated exists branches and rebases the outer alias safely', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                WITH base_products AS (
                    SELECT p.product_id, p.product_name
                    FROM products p
                )
                SELECT bp.product_id
                FROM base_products bp
                WHERE (
                    :category_name IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM product_categories pc
                        WHERE pc.product_id = bp.product_id
                          AND pc.category_name = :category_name
                    )
                )
            `,
            { category_name: null }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('with "base_products" as (select "p"."product_id", "p"."product_name" from "products" as "p" where (:category_name is null or exists');
        expect(normalized).toContain('"pc"."product_id" = "p"."product_id"');
        expect(normalized).not.toContain('from "base_products" as "bp" where (:category_name is null or exists');
    });

    it('refresh relocates correlated not-exists branches and rebases the outer alias safely', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                WITH base_products AS (
                    SELECT p.product_id, p.product_name
                    FROM products p
                )
                SELECT bp.product_id
                FROM base_products bp
                WHERE (
                    :archived_name IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM archived_products ap
                        WHERE ap.product_id = bp.product_id
                          AND ap.product_name = :archived_name
                    )
                )
            `,
            { archived_name: null }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('with "base_products" as (select "p"."product_id", "p"."product_name" from "products" as "p" where (:archived_name is null or not exists');
        expect(normalized).toContain('"ap"."product_id" = "p"."product_id"');
        expect(normalized).not.toContain('from "base_products" as "bp" where (:archived_name is null or not exists');
    });

    it('refresh fails fast when correlated exists anchors are ambiguous', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.refresh(
            `
                WITH base_products AS (
                    SELECT p.product_id, p.product_name
                    FROM products p
                )
                SELECT bp.product_id
                FROM base_products bp
                WHERE (
                    :category_name IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM product_categories pc
                        WHERE pc.product_id = bp.product_id
                          AND pc.product_name = bp.product_name
                          AND pc.category_name = :category_name
                    )
                )
            `,
            { category_name: null }
        )).toThrow(/multiple correlated anchor candidates/i);
    });

    it('refresh fails fast when correlated exists anchors cannot be inferred', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.refresh(
            `
                SELECT p.product_id
                FROM products p
                WHERE (
                    :category_name IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM product_categories pc
                        WHERE pc.category_name = :category_name
                    )
                )
            `,
            { category_name: null }
        )).toThrow(/could not infer a correlated anchor/i);
    });

    it('lists supported branch metadata and removes a targeted branch idempotently', () => {
        const builder = new SSSQLFilterBuilder();
        const scaffolded = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                target: 'products.product_name',
                parameterName: 'product_name',
                operator: 'ilike'
            }
        );

        const withExists = builder.scaffoldBranch(scaffolded, {
            kind: 'exists',
            parameterName: 'category_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM product_categories pc
                WHERE pc.product_id = $c0
                  AND pc.category_name = :category_name
            `
        });

        const listed = builder.list(withExists);
        expect(listed).toEqual(expect.arrayContaining([
            expect.objectContaining({
                parameterName: 'product_name',
                kind: 'scalar',
                operator: 'ilike',
                target: 'p.product_name'
            }),
            expect.objectContaining({
                parameterName: 'category_name',
                kind: 'exists'
            })
        ]));

        const removed = builder.remove(withExists, { parameterName: 'category_name', kind: 'exists' });
        const normalized = normalizeSql(new SqlFormatter().format(removed).formattedSql);
        expect(normalized).not.toContain(':category_name');
        expect(normalized).toContain(':product_name is null or "p"."product_name" ilike :product_name');

        const removedAgain = builder.remove(removed, { parameterName: 'category_name', kind: 'exists' });
        expect(normalizeSql(new SqlFormatter().format(removedAgain).formattedSql)).toBe(normalized);
    });

    it('lists casted null-guard optional expression branches', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select u.id, u.email
            from users u
            where (cast(:keyword as text) is null
                or u.email ilike '%' || :keyword || '%'
                or u.name ilike '%' || :keyword || '%')
              and (:status::text is null or u.status = :status)
        `;

        expect(builder.list(sql)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                parameterName: 'keyword',
                kind: 'expression'
            }),
            expect.objectContaining({
                parameterName: 'status',
                kind: 'scalar',
                operator: '=',
                target: 'u.status'
            })
        ]));
    });

    it('refresh keeps existing scalar branches when the parameter name is not a resolvable target name', () => {
        const builder = new SSSQLFilterBuilder();
        const sql = `
            select t.ticket_id, c.tier as customer_tier
            from tickets t
            join customers c on c.customer_id = t.customer_id
            where (cast(:customerTier as text) is null or c.tier = :customerTier)
        `;

        const plan = builder.planRefresh(sql, { customerTier: null });

        expect(plan.ok).toBe(true);
        expect(plan.sql).toContain('cast(:customerTier as text) is null');
        expect(plan.sql).toContain('"c"."tier" = :customerTier');
        expect(plan.errors).toEqual([]);
    });

    it('removes not-exists branches idempotently', () => {
        const builder = new SSSQLFilterBuilder();
        const scaffolded = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                kind: 'not-exists',
                parameterName: 'archived_name',
                anchorColumns: ['products.product_id'],
                query: `
                    SELECT 1
                    FROM archived_products ap
                    WHERE ap.product_id = $c0
                      AND ap.product_name = :archived_name
                `
            }
        );

        expect(builder.list(scaffolded)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                parameterName: 'archived_name',
                kind: 'not-exists'
            })
        ]));

        const removed = builder.remove(scaffolded, { parameterName: 'archived_name', kind: 'not-exists' });
        const normalized = normalizeSql(new SqlFormatter().format(removed).formattedSql);
        expect(normalized).toBe('select "p"."product_id", "p"."product_name" from "products" as "p"');

        const removedAgain = builder.remove(removed, { parameterName: 'archived_name', kind: 'not-exists' });
        expect(normalizeSql(new SqlFormatter().format(removedAgain).formattedSql)).toBe(normalized);
        expect(normalizeSql(new SqlFormatter().format(builder.removeAll(scaffolded)).formattedSql)).toBe(normalized);
    });

    it('removes all recognized branches in one call', () => {
        const builder = new SSSQLFilterBuilder();
        const scaffolded = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                target: 'products.product_name',
                parameterName: 'product_name',
                operator: 'ilike'
            }
        );

        const withExists = builder.scaffoldBranch(scaffolded, {
            kind: 'exists',
            parameterName: 'category_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM product_categories pc
                WHERE pc.product_id = $c0
                  AND pc.category_name = :category_name
            `
        });

        const removed = builder.removeAll(withExists);
        const normalized = normalizeSql(new SqlFormatter().format(removed).formattedSql);
        expect(normalized).toBe('select "p"."product_id", "p"."product_name" from "products" as "p"');
    });

    it('fails fast when exists scaffolding has no anchor columns', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                kind: 'exists',
                parameterName: 'category_name',
                anchorColumns: [],
                query: `
                    SELECT 1
                    FROM product_categories pc
                    WHERE pc.product_id = $c0
                      AND pc.category_name = :category_name
                `
            }
        )).toThrow(/at least one anchorcolumn/i);
    });

});
