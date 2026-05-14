create table rawsql_transfer.setting (
  setting_id bigserial primary key

  , setting_name text not null unique
  , description text null

  , source_sql_body text not null
  , source_sql_hash text not null
  , source_key_definition jsonb not null

  , source_sql_analysis_result jsonb null
  , search_condition_analysis_result jsonb null
  , source_sql_analysis_status text not null
  , source_sql_analysis_error text null

  , is_enabled boolean not null default true
  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_setting_name_not_blank
    check (btrim(setting_name) <> '')

  , constraint chk_setting_source_sql_body_not_blank
    check (btrim(source_sql_body) <> '')

  , constraint chk_setting_source_sql_hash_not_blank
    check (btrim(source_sql_hash) <> '')

  , constraint chk_setting_source_key_definition_object
    check (
      jsonb_typeof(source_key_definition) = 'object'
      and jsonb_object_length(source_key_definition) > 0
    )

  , constraint chk_setting_source_sql_analysis_status
    check (source_sql_analysis_status in ('not_analyzed', 'success', 'failed'))
);

comment on table rawsql_transfer.setting is
  '転送設定。名前で一意に特定できる転送元データソース定義。基礎となる選択SQL、転送元キー定義、解析結果を管理する。転送指示、転送処理、転送結果ではない。';

comment on column rawsql_transfer.setting.setting_id is
  '転送設定ID。サロゲートキー。';

comment on column rawsql_transfer.setting.setting_name is
  '転送設定名。アプリケーションや後続処理から名前で参照するため一意にする。';

comment on column rawsql_transfer.setting.description is
  '説明。転送設定の目的や業務上の意味を記録する。';

comment on column rawsql_transfer.setting.source_sql_body is
  '基礎選択SQL本文。転送元データを抽出するSQLを保持する。SSSQL形式の任意検索条件を含めてよい。';

comment on column rawsql_transfer.setting.source_sql_hash is
  '基礎選択SQL本文から算出したハッシュ。SQL本文の変更検知に使用する。';

comment on column rawsql_transfer.setting.source_key_definition is
  '転送元キー定義。転送元データソースの行、または転送元として再評価すべき単位を識別するキーをJSONBで保持する。columnは基礎選択SQLの結果からsource keyとして読む列名を表す。元テーブルの生列名ではなく、演算列や別名列にも対応する。単一キー、複合キーに対応する。後続の転送処理、リネージュ、キー変換表、二重転送防止の判断材料として参照する。';

comment on column rawsql_transfer.setting.source_sql_analysis_result is
  '基礎選択SQLの解析結果。戻り列、推定型などをJSONBで保持する。';

comment on column rawsql_transfer.setting.search_condition_analysis_result is
  '検索条件解析結果。SSSQLから抽出した検索条件情報をJSONBで保持する。実行ロジックの正本ではなく、デバッグや検証補助に使用する。';

comment on column rawsql_transfer.setting.source_sql_analysis_status is
  '基礎選択SQLの解析状態。許可値は not_analyzed, success, failed。';

comment on column rawsql_transfer.setting.source_sql_analysis_error is
  '基礎選択SQLの解析エラー。解析失敗時の理由を記録する。';

comment on column rawsql_transfer.setting.is_enabled is
  '有効フラグ。この転送設定を使用可能にするかを表す。';

comment on column rawsql_transfer.setting.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.setting.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.setting.note is
  '備考。実装・運用上の補足を記録する。';
