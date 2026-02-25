# ddl-docs-vitepress scaffold化 + DDLフィルタ機能 — 実装の意図

## 背景・動機

`@rawsql-ts/ddl-docs-vitepress` はモノレポ内のデモサイトとして `private: true` で存在していた。
ユーザーが **手元のリポジトリにスキーマドキュメントサイトをゼロから立ち上げる**ユースケースを想定し、
`npx @rawsql-ts/ddl-docs-vitepress init` で雛形を展開できるscaffoldパッケージとして再設計した。

合わせて `ddl-docs-cli` に pg_dump 出力をそのまま入力できる `--filter-pg-dump` フラグを追加した。
pg_dump の出力には `GRANT`/`REVOKE`/`OWNER TO`/`SET` などの管理用SQL文が含まれるため、
これらを取り除かないとパーサーが不要な警告を出す。フィルタをCLI側に持つことで、
ユーザーのワークフロー（pg_dump → DDLドキュメント生成）をシェルパイプなしで完結させられる。

---

## Phase 1 — `ddl-docs-cli` DDLフィルタ機能

### `pgDumpFilter.ts` の設計方針

行ループ + スキップ状態フラグという単純なステートマシンを採用した。

```
行を走査:
  スキップ中でなければ:
    \connect → その1行だけスキップ（セミコロンなしのメタコマンドのため）
    フィルタ対象パターンに一致 → skipping = true（出力しない）
    それ以外 → 出力する
  skipping かつ行に ";" が含まれる → skipping = false
```

正規表現やASTパースを避けて行ベースにした理由:
- pg_dump 出力のフィルタ対象文は行頭が明確（`GRANT`、`SET`、`\connect` 等）
- セミコロンで終わる複数行の文も「最初の行でスキップ開始、`;` が来たら終了」で十分対応できる
- 実装がシンプルで誤爆のリスクが低い

フィルタ対象パターン:

| パターン | 理由 |
|----------|------|
| `GRANT ...` | 権限付与。スキーマドキュメントには不要 |
| `REVOKE ...` | 権限剥奪。同上 |
| `ALTER ... OWNER TO ...` | オーナー変更。同上 |
| `SET ...` | pg_dump ヘッダーの `search_path` 等の設定文 |
| `\connect ...` | psql メタコマンド。セミコロンなし |
| `SELECT pg_catalog.set_config(...)` | pg_dump が出力する設定リセット文 |

### `generate.ts` への組み込み

`collectSqlFiles` の直後に適用することで、後続のすべての処理（パース・スナップショット・レンダリング）が
フィルタ済みのSQLを受け取る。SQL文字列を変換するだけなので副作用がなく、既存の処理フローを変えない。

---

## Phase 2 — `ddl-docs-vitepress` scaffold パッケージ

### privateをやめて公開パッケージにする理由

ユーザーが `npx @rawsql-ts/ddl-docs-vitepress init` を実行するだけで
DDLドキュメントサイトの雛形を手に入れられるようにするため。
モノレポ内のデモ用ファイル（`ddl/`、`docs/`、`scripts/`）はそのまま残し、
`src/` + `templates/` を追加する形で共存させる。

### `gitignore` → `.gitignore` リネームの理由

npm は publish 時にパッケージ内の `.gitignore` を自動的に除外する仕様がある。
そのため `templates/` 内では `gitignore`（ドットなし）として同梱し、
`init` コマンド実行時にリネームする方式をとる。

### `require.resolve("@rawsql-ts/ddl-docs-cli")` を使う理由

テンプレートの `scripts/run-generate.cjs` では、CLI のエントリポイントを
`require.resolve` で解決する。これにより:
- パッケージがインストールされていない場合に明示的なエラーを出せる
- `process.cwd()` やスクリプトの置き場所に依存しない堅牢な解決ができる
- モノレポのような相対パス参照（`../ddl-docs-cli/dist/index.js`）に依存しない

### テンプレートの `config.mts` に `base` を追加する理由

GitHub Pages へのデプロイでは `/<repository-name>/` というサブパスが付く。
`VITEPRESS_BASE` 環境変数で動的に切り替えられるようにすることで、
ローカル開発（`/`）と GitHub Pages（`/my-repo/`）を同じ設定ファイルで扱える。

GitHub Actions ワークフローでは:
```yaml
VITEPRESS_BASE: /${{ github.event.repository.name }}/
```
と設定するだけでリポジトリ名に合わせたベースパスが自動設定される。

### `tsconfig.json` の `rootDir: "src"` について

`rootDir: "."` とすると TypeScript は `src/index.ts` を `dist/src/index.js` に出力する。
`bin` フィールドが指す `dist/index.js` と一致しなくなるため `rootDir: "src"` に設定する。

また `rootDir: "src"` にすることで、コンパイル後の `dist/cli.js` 内の `__dirname` が
`<package>/dist` を指すようになり、`path.join(__dirname, '..', 'templates')` が
パッケージルートの `templates/` を正しく解決できる。
`templates/` を `dist/` に含める必要がないため、`files` フィールドで別途指定するだけでよい。

---

## ファイル構成の変更まとめ

```
packages/ddl-docs-cli/
  src/utils/pgDumpFilter.ts   ← NEW: pg_dump フィルタユーティリティ
  src/types.ts                ← MODIFY: filterPgDump?: boolean 追加
  src/cli.ts                  ← MODIFY: --filter-pg-dump フラグ追加
  src/commands/generate.ts    ← MODIFY: フィルタ適用

packages/ddl-docs-vitepress/
  src/index.ts                ← NEW: CLI エントリポイント
  src/cli.ts                  ← NEW: init コマンド実装
  tsconfig.json               ← NEW: rootDir: "src"
  package.json                ← MODIFY: 公開パッケージ化
  templates/                  ← NEW: scaffold 雛形ファイル群
    ddl/.gitkeep
    docs/index.md
    docs/.vitepress/config.mts       (base 追加)
    docs/.vitepress/theme/index.ts
    docs/.vitepress/theme/custom.css
    scripts/run-generate.cjs         (require.resolve 版 + --filter-pg-dump)
    package.json                     (ユーザープロジェクト用)
    gitignore                        (init 時に .gitignore にリネーム)
    .github/workflows/deploy-docs.yml
```
