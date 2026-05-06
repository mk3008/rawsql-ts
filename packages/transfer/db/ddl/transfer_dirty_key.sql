create table transfer_dirty_key (
  transfer_dirty_key_id bigserial primary key

  , source_schema_name text not null
  , source_table_name text not null

  , source_key_json jsonb not null

  , created_at timestamptz not null default current_timestamp

  , note text null

  , constraint chk_transfer_dirty_key_source_schema_name_not_blank
    check (btrim(source_schema_name) <> '')

  , constraint chk_transfer_dirty_key_source_table_name_not_blank
    check (btrim(source_table_name) <> '')

  , constraint chk_transfer_dirty_key_source_key_json_object
    check (jsonb_typeof(source_key_json) = 'object')
);

create index idx_transfer_dirty_key_source_created_at
  on transfer_dirty_key (
    source_schema_name
    , source_table_name
    , created_at
    , transfer_dirty_key_id
  );

create index idx_transfer_dirty_key_created_at
  on transfer_dirty_key (
    created_at
    , transfer_dirty_key_id
  );

comment on table transfer_dirty_key is
  'Dirty Key Management。転送元行に何らかの変更が起きた可能性を記録するイミュータブルな変更検知履歴。転送指示、転送状態、転送結果ではない。';

comment on column transfer_dirty_key.transfer_dirty_key_id is
  'Dirty Key ID。シーケンスで採番するサロゲートキー。識別子であり、登録確定順、イベント順、処理順を保証しない。';

comment on column transfer_dirty_key.source_schema_name is
  '発生元スキーマ名。変更が起きた可能性のある発生元schemaを示す。';

comment on column transfer_dirty_key.source_table_name is
  '発生元テーブル名。変更が起きた可能性のある発生元tableを示す。';

comment on column transfer_dirty_key.source_key_json is
  '転送元キーJSON。変更が起きた可能性のある発生元行、または転送元として再評価すべき単位を識別するキーをJSONBで保持する。複合キーに対応する。手動登録を難しくしないため、正規化ハッシュ列は持たない。';

comment on column transfer_dirty_key.created_at is
  '登録日時。Dirty Key行が登録された日時。この値は厳密なイベント順、登録確定順、処理順を保証しない。';

comment on column transfer_dirty_key.note is
  '備考。運用上の補足を記録する。転送状態や処理結果を記録するための列ではない。';
