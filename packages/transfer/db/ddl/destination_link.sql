create table rawsql_transfer.destination_link (
  destination_link_id bigserial primary key

  , setting_id bigint not null
    references rawsql_transfer.setting(setting_id)

  , destination_definition_id bigint not null
    references rawsql_transfer.destination_definition(destination_definition_id)

  , destination_link_name text not null
  , execution_order integer not null

  , destination_key_mapping jsonb not null
  , mapping_definition jsonb not null
  , diff_compare_excluded_columns jsonb null

  , generated_insert_transfer_sql_body text not null default ''
  , generated_update_transfer_sql_body text not null default ''
  , generated_delete_transfer_sql_body text not null default ''

  , generated_sql_status text not null default 'not_generated'
  , generated_sql_error text null

  , is_enabled boolean not null default true
  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_setting_destination_execution_order_positive
    check (execution_order > 0)

  , constraint chk_setting_destination_link_name_not_blank
    check (btrim(destination_link_name) <> '')

  , constraint chk_setting_destination_key_mapping_object
    check (jsonb_typeof(destination_key_mapping) = 'object')

  , constraint chk_setting_destination_mapping_definition_object
    check (jsonb_typeof(mapping_definition) = 'object')

  , constraint chk_setting_destination_diff_compare_excluded_columns_object
    check (
      diff_compare_excluded_columns is null
      or jsonb_typeof(diff_compare_excluded_columns) = 'object'
    )

  , constraint chk_setting_destination_generated_sql_status
    check (generated_sql_status in ('not_generated', 'success', 'failed'))

  , constraint uq_setting_destination_link_name
    unique (setting_id, destination_link_name)

  , constraint uq_setting_destination_execution_order
    unique (setting_id, execution_order)

  , constraint uq_destination_link_setting_identity
    unique (setting_id, destination_link_id)
);

create index idx_destination_link_setting
  on rawsql_transfer.destination_link (setting_id);

create index idx_destination_link_destination
  on rawsql_transfer.destination_link (destination_definition_id);

comment on table rawsql_transfer.destination_link is
  '転送設定と転送先定義の紐づけ。転送設定の基礎SQLを、どの転送先定義へ、どの役割名、順序、マッピング、差分比較除外設定で転送するかを管理する。';

comment on column rawsql_transfer.destination_link.destination_link_id is
  'Destination Link ID。サロゲートキー。';

comment on column rawsql_transfer.destination_link.setting_id is
  '転送設定ID。基礎選択SQLを持つ setting を参照する。';

comment on column rawsql_transfer.destination_link.destination_definition_id is
  '転送先定義ID。転送先テーブル、列、主キー、採番式、転送モデルを持つ destination_definition を参照する。';

comment on column rawsql_transfer.destination_link.destination_link_name is
  '転送先リンク名。同一転送設定内で宛先別の役割を識別する人間向け名称。外部キーや安定参照キーとしては使用しない。';

comment on column rawsql_transfer.destination_link.execution_order is
  '実行順。同一転送設定内で複数の転送先定義を処理する順序を表す。1以上の整数とし、同一転送設定内で重複させない。';

comment on column rawsql_transfer.destination_link.destination_key_mapping is
  '転送先キーマッピング。Transfer Settingの転送元キーに対応する、このDestination Link固有の転送先行キーを基礎選択SQLのどの列から取り出すかをJSONBで保持する。';

comment on column rawsql_transfer.destination_link.mapping_definition is
  'マッピング定義。基礎選択SQLの結果列を転送先列へどう対応させるかをJSONBで保持する。';

comment on column rawsql_transfer.destination_link.diff_compare_excluded_columns is
  '差分比較除外列定義。同一転送設定内の転送先定義リンクにおいて、更新判定時に比較対象から除外する転送先列をJSONBで保持する。';

comment on column rawsql_transfer.destination_link.generated_insert_transfer_sql_body is
  '生成追加転送SQL本文。新規またはシンクロ転送で黒を追加するSQLを保持する。';

comment on column rawsql_transfer.destination_link.generated_update_transfer_sql_body is
  '生成更新転送SQL本文。mutableモデルで直接UPDATEするSQLを保持する。';

comment on column rawsql_transfer.destination_link.generated_delete_transfer_sql_body is
  '生成削除転送SQL本文。mutableモデルで物理DELETEするSQLを保持する。';

comment on column rawsql_transfer.destination_link.generated_sql_status is
  '生成SQL状態。許可値は not_generated, success, failed。';

comment on column rawsql_transfer.destination_link.generated_sql_error is
  '生成SQLエラー。SQL生成失敗時の理由を保持する。';

comment on column rawsql_transfer.destination_link.is_enabled is
  '有効フラグ。この紐づけを使用可能にするかを表す。';

comment on column rawsql_transfer.destination_link.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.destination_link.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.destination_link.note is
  '備考。実装・運用上の補足を記録する。';
