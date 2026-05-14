create table rawsql_transfer.active_black (
  active_black_id bigserial primary key

  , destination_link_id bigint not null
    references rawsql_transfer.destination_link(destination_link_id)

  , source_key_json jsonb not null
  , source_key_hash text not null

  , destination_key_json jsonb not null

  , activated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_active_black_source_key_json_object
    check (jsonb_typeof(source_key_json) = 'object')

  , constraint chk_active_black_source_key_hash_not_blank
    check (btrim(source_key_hash) <> '')

  , constraint chk_active_black_destination_key_json_object
    check (jsonb_typeof(destination_key_json) = 'object')

  , constraint uq_active_black_source
    unique (
      destination_link_id
      , source_key_json
    )

  , constraint uq_active_black_link_identity
    unique (active_black_id, destination_link_id)
);

create index idx_active_black_source_lookup
  on rawsql_transfer.active_black (
    destination_link_id
    , source_key_hash
  );

comment on table rawsql_transfer.active_black is
  '有効黒伝。転送プロセスで現在有効な黒伝の存在確認と転送先行特定に使う現在状態テーブル。';

comment on column rawsql_transfer.active_black.active_black_id is
  '有効黒伝ID。シーケンスで採番するサロゲートキー。';

comment on column rawsql_transfer.active_black.destination_link_id is
  'Destination Link ID。有効黒伝を区別する宛先別の転送単位を参照する。';

comment on column rawsql_transfer.active_black.source_key_json is
  '転送元キーJSON。転送プロセスで現在有効な黒伝を検索するための転送元キーをJSONBで保持する。';

comment on column rawsql_transfer.active_black.source_key_hash is
  '転送元キーハッシュ。転送元キーJSONによる検索の前段絞り込みに使う補助値。正本はsource_key_json。';

comment on column rawsql_transfer.active_black.destination_key_json is
  '転送先キーJSON。Red Transfer、Black Update Transfer、Physical Delete Transferで既存の有効黒伝行を特定するための転送先キー。';

comment on column rawsql_transfer.active_black.activated_at is
  '有効化日時。この黒伝が現在有効な黒伝として登録された日時。検索キーではなく運用確認用の時刻。';

comment on column rawsql_transfer.active_black.note is
  '備考。運用上の補足を記録する。';
