create table transfer_setting_destination_definition (
  transfer_setting_destination_definition_id bigserial primary key

  , transfer_setting_id bigint not null
    references transfer_setting(transfer_setting_id)

  , transfer_destination_definition_id bigint not null
    references transfer_destination_definition(transfer_destination_definition_id)

  , execution_order integer not null

  , source_key_definition jsonb not null
  , mapping_definition jsonb not null

  , generated_insert_transfer_sql_body text not null default ''
  , generated_update_transfer_sql_body text not null default ''
  , generated_red_transfer_sql_body text not null default ''
  , generated_delete_transfer_sql_body text not null default ''

  , generated_sql_status text not null default 'not_generated'
  , generated_sql_error text null

  , is_enabled boolean not null default true
  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_transfer_setting_destination_execution_order_positive
    check (execution_order > 0)

  , constraint chk_transfer_setting_destination_source_key_definition_object
    check (jsonb_typeof(source_key_definition) = 'object')

  , constraint chk_transfer_setting_destination_mapping_definition_object
    check (jsonb_typeof(mapping_definition) = 'object')

  , constraint chk_transfer_setting_destination_generated_sql_status
    check (generated_sql_status in ('not_generated', 'success', 'failed'))

  , constraint uq_transfer_setting_destination_definition_pair
    unique (transfer_setting_id, transfer_destination_definition_id)

  , constraint uq_transfer_setting_destination_execution_order
    unique (transfer_setting_id, execution_order)
);

create index idx_transfer_setting_destination_definition_setting
  on transfer_setting_destination_definition (transfer_setting_id);

create index idx_transfer_setting_destination_definition_destination
  on transfer_setting_destination_definition (transfer_destination_definition_id);

comment on table transfer_setting_destination_definition is
  '転送設定と転送先定義の紐づけ。転送設定の基礎SQLを、どの転送先定義へ、どの順序とマッピングで転送するかを管理する。';

comment on column transfer_setting_destination_definition.transfer_setting_destination_definition_id is
  '転送設定転送先定義ID。サロゲートキー。';

comment on column transfer_setting_destination_definition.transfer_setting_id is
  '転送設定ID。基礎選択SQLを持つ transfer_setting を参照する。';

comment on column transfer_setting_destination_definition.transfer_destination_definition_id is
  '転送先定義ID。転送先テーブル、列、主キー、採番式、転送モデルを持つ transfer_destination_definition を参照する。';

comment on column transfer_setting_destination_definition.execution_order is
  '実行順。同一転送設定内で複数の転送先定義を処理する順序を表す。1以上の整数とし、同一転送設定内で重複させない。';

comment on column transfer_setting_destination_definition.source_key_definition is
  '転送元キー定義。基礎選択SQLの結果から転送元キーをどう取り出すかをJSONBで保持する。例: {"keys":[{"name":"sale_id","sourceColumn":"sale_id","type":"bigint"}]}。';

comment on column transfer_setting_destination_definition.mapping_definition is
  'マッピング定義。基礎選択SQLの結果列を転送先列へどう対応させるかをJSONBで保持する。';

comment on column transfer_setting_destination_definition.generated_insert_transfer_sql_body is
  '生成追加転送SQL本文。新規またはシンクロ転送で黒を追加するSQLを保持する。このIssueではSQL生成未実装のため空文字を保存する。';

comment on column transfer_setting_destination_definition.generated_update_transfer_sql_body is
  '生成更新転送SQL本文。mutableモデルで直接UPDATEするSQLを保持する。このIssueではSQL生成未実装のため空文字を保存する。';

comment on column transfer_setting_destination_definition.generated_red_transfer_sql_body is
  '生成赤伝転送SQL本文。immutableモデルで元黒を読み、符号反転した赤伝を追加するSQLを保持する。このIssueではSQL生成未実装のため空文字を保存する。';

comment on column transfer_setting_destination_definition.generated_delete_transfer_sql_body is
  '生成削除転送SQL本文。mutableモデルで物理DELETEするSQLを保持する。このIssueではSQL生成未実装のため空文字を保存する。';

comment on column transfer_setting_destination_definition.generated_sql_status is
  '生成SQL状態。許可値は not_generated, success, failed。このIssueではSQL生成未実装のため not_generated を保存する。';

comment on column transfer_setting_destination_definition.generated_sql_error is
  '生成SQLエラー。SQL生成失敗時の理由を保持する。このIssueでは通常nullとする。';

comment on column transfer_setting_destination_definition.is_enabled is
  '有効フラグ。この紐づけを使用可能にするかを表す。';

comment on column transfer_setting_destination_definition.created_at is
  '作成日時。レコード作成時刻。';

comment on column transfer_setting_destination_definition.updated_at is
  '更新日時。レコード更新時刻。CreateのみのIssueでは初期値として作成日時と同じになる。';

comment on column transfer_setting_destination_definition.note is
  '備考。実装・運用上の補足を記録する。';
