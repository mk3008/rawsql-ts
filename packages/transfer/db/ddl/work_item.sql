create table rawsql_transfer.work_item (
  work_item_id bigserial primary key

  , run_id bigint not null
    references rawsql_transfer.run(run_id)

  , dirty_key_id bigint not null
    references rawsql_transfer.dirty_key(dirty_key_id)

  , setting_id bigint not null
    references rawsql_transfer.setting(setting_id)

  , destination_link_id bigint not null
    references rawsql_transfer.destination_link(destination_link_id)

  , active_black_id bigint null
    references rawsql_transfer.active_black(active_black_id)

  , source_key_json jsonb not null
  , source_key_hash text not null

  , source_exists boolean not null
  , transfer_model text not null
  , route_type text not null

  , requires_red_transfer boolean not null default false
  , requires_black_insert_transfer boolean not null default false
  , requires_black_update_transfer boolean not null default false
  , requires_physical_delete_transfer boolean not null default false

  , skip_reason text null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_work_item_source_key_json_object
    check (jsonb_typeof(source_key_json) = 'object')

  , constraint chk_work_item_source_key_hash_not_blank
    check (btrim(source_key_hash) <> '')

  , constraint chk_work_item_transfer_model
    check (transfer_model in ('immutable', 'mutable'))

  , constraint chk_work_item_route_type
    check (route_type in ('immutable', 'mutable', 'skipped'))

  , constraint chk_work_item_skip_reason
    check (
      skip_reason is null
      or skip_reason in ('duplicate_ignore', 'no_op')
    )

  , constraint chk_work_item_skip_consistency
    check (
      (
        route_type = 'skipped'
        and skip_reason is not null
        and requires_red_transfer = false
        and requires_black_insert_transfer = false
        and requires_black_update_transfer = false
        and requires_physical_delete_transfer = false
      )
      or (
        route_type <> 'skipped'
        and skip_reason is null
      )
    )

  , constraint fk_work_item_run_setting
    foreign key (run_id, setting_id)
    references rawsql_transfer.run(run_id, setting_id)

  , constraint fk_work_item_setting_destination_link
    foreign key (setting_id, destination_link_id)
    references rawsql_transfer.destination_link(setting_id, destination_link_id)

  , constraint fk_work_item_active_black_destination_link
    foreign key (active_black_id, destination_link_id)
    references rawsql_transfer.active_black(active_black_id, destination_link_id)

  , constraint uq_work_item_run_dirty_destination
    unique (
      run_id
      , dirty_key_id
      , destination_link_id
    )

  , constraint uq_work_item_context_identity
    unique (
      work_item_id
      , run_id
      , dirty_key_id
      , setting_id
      , destination_link_id
    )

  , constraint uq_work_item_link_context_identity
    unique (
      work_item_id
      , run_id
      , setting_id
      , destination_link_id
    )
);

create index idx_work_item_run_destination
  on rawsql_transfer.work_item (
    run_id
    , destination_link_id
    , work_item_id
  );

create index idx_work_item_destination_source
  on rawsql_transfer.work_item (
    destination_link_id
    , source_key_hash
  );

create index idx_work_item_active_black
  on rawsql_transfer.work_item (active_black_id)
  where active_black_id is not null;

comment on table rawsql_transfer.work_item is
  '転送作業対象。Dirty Keyを転送実行内で固定化し、転送元キー、転送モデル、転送操作の判断材料を保持する。';

comment on column rawsql_transfer.work_item.work_item_id is
  '転送作業対象ID。シーケンスで採番するサロゲートキー。';

comment on column rawsql_transfer.work_item.run_id is
  '転送実行ID。この作業対象を作成した転送実行を参照する。';

comment on column rawsql_transfer.work_item.dirty_key_id is
  'Dirty Key ID。この作業対象の元になった変更検知履歴を参照する。';

comment on column rawsql_transfer.work_item.setting_id is
  '転送設定ID。この作業対象を評価した転送設定を参照する。';

comment on column rawsql_transfer.work_item.destination_link_id is
  'Destination Link ID。この作業対象を評価した宛先別の転送単位を参照する。';

comment on column rawsql_transfer.work_item.active_black_id is
  '有効黒伝ID。評価時に参照した現在有効な黒伝を参照する。存在しない場合はnull。';

comment on column rawsql_transfer.work_item.source_key_json is
  '転送元キーJSON。この作業対象が扱う転送元キーをJSONBで保持する。';

comment on column rawsql_transfer.work_item.source_key_hash is
  '転送元キーハッシュ。転送元キーJSONの検索・比較を高速化するための補助値。';

comment on column rawsql_transfer.work_item.source_exists is
  '転送元存在フラグ。作業対象の評価時点で転送元の現在値が存在するかを表す。';

comment on column rawsql_transfer.work_item.transfer_model is
  '転送モデル。評価時点で使用する転送モデル。許可値は immutable, mutable。';

comment on column rawsql_transfer.work_item.route_type is
  '転送ルート種別。許可値は immutable, mutable, skipped。転送操作の実行経路を表す。';

comment on column rawsql_transfer.work_item.requires_red_transfer is
  '赤伝転送要否。赤伝追加が必要かを表す。';

comment on column rawsql_transfer.work_item.requires_black_insert_transfer is
  '黒伝追加転送要否。黒伝追加が必要かを表す。';

comment on column rawsql_transfer.work_item.requires_black_update_transfer is
  '黒伝更新転送要否。黒伝更新が必要かを表す。';

comment on column rawsql_transfer.work_item.requires_physical_delete_transfer is
  '物理削除転送要否。転送先行の物理削除が必要かを表す。';

comment on column rawsql_transfer.work_item.skip_reason is
  'スキップ理由。転送操作を行わない理由を保持する。許可値は duplicate_ignore, no_op。';

comment on column rawsql_transfer.work_item.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.work_item.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.work_item.note is
  '備考。運用上の補足を記録する。';
