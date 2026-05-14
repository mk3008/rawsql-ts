create table rawsql_transfer.dirty_key_processing (
  dirty_key_processing_id bigserial primary key

  , dirty_key_id bigint not null
    references rawsql_transfer.dirty_key(dirty_key_id)

  , run_id bigint not null
    references rawsql_transfer.run(run_id)

  , work_item_id bigint not null
    references rawsql_transfer.work_item(work_item_id)

  , setting_id bigint not null
    references rawsql_transfer.setting(setting_id)

  , destination_link_id bigint not null
    references rawsql_transfer.destination_link(destination_link_id)

  , source_key_json jsonb not null
  , source_key_hash text not null

  , processing_status text not null
  , processing_result text not null
  , error_message text null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_dirty_key_processing_source_key_json_object
    check (jsonb_typeof(source_key_json) = 'object')

  , constraint chk_dirty_key_processing_source_key_hash_not_blank
    check (btrim(source_key_hash) <> '')

  , constraint chk_dirty_key_processing_status
    check (processing_status in ('succeeded', 'failed', 'skipped'))

  , constraint chk_dirty_key_processing_result
    check (
      processing_result in (
        'no_op'
        , 'duplicate_ignore'
        , 'red_then_black_insert'
        , 'black_insert'
        , 'red'
        , 'black_update'
        , 'physical_delete'
      )
    )

  , constraint fk_dirty_key_processing_run_setting
    foreign key (run_id, setting_id)
    references rawsql_transfer.run(run_id, setting_id)

  , constraint fk_dirty_key_processing_setting_destination_link
    foreign key (setting_id, destination_link_id)
    references rawsql_transfer.destination_link(setting_id, destination_link_id)

  , constraint fk_dirty_key_processing_work_item_context
    foreign key (
      work_item_id
      , run_id
      , dirty_key_id
      , setting_id
      , destination_link_id
    )
    references rawsql_transfer.work_item(
      work_item_id
      , run_id
      , dirty_key_id
      , setting_id
      , destination_link_id
    )
);

create unique index uq_dirty_key_processing_final
  on rawsql_transfer.dirty_key_processing (
    dirty_key_id
    , destination_link_id
  )
  where processing_status in ('succeeded', 'skipped');

create index idx_dirty_key_processing_run_destination
  on rawsql_transfer.dirty_key_processing (
    run_id
    , destination_link_id
  );

create index idx_dirty_key_processing_destination_source
  on rawsql_transfer.dirty_key_processing (
    destination_link_id
    , source_key_hash
  );

create index idx_dirty_key_processing_work_item
  on rawsql_transfer.dirty_key_processing (work_item_id);

comment on table rawsql_transfer.dirty_key_processing is
  'Dirty Key処理記録。Dirty Keyがどの転送実行、転送設定、宛先別転送単位で処理されたかと、その処理結果を記録する。';

comment on column rawsql_transfer.dirty_key_processing.dirty_key_processing_id is
  'Dirty Key処理記録ID。シーケンスで採番するサロゲートキー。';

comment on column rawsql_transfer.dirty_key_processing.dirty_key_id is
  'Dirty Key ID。処理済みとして記録する変更検知履歴を参照する。';

comment on column rawsql_transfer.dirty_key_processing.run_id is
  '転送実行ID。この処理記録を作成した転送実行を参照する。';

comment on column rawsql_transfer.dirty_key_processing.work_item_id is
  '転送作業対象ID。この処理記録の元になった作業対象を参照する。';

comment on column rawsql_transfer.dirty_key_processing.setting_id is
  '転送設定ID。この処理記録が属する転送設定を参照する。';

comment on column rawsql_transfer.dirty_key_processing.destination_link_id is
  'Destination Link ID。この処理記録が属する宛先別の転送単位を参照する。';

comment on column rawsql_transfer.dirty_key_processing.source_key_json is
  '転送元キーJSON。処理した転送元キーをJSONBで保持する。';

comment on column rawsql_transfer.dirty_key_processing.source_key_hash is
  '転送元キーハッシュ。転送元キーJSONの検索・比較を高速化するための補助値。';

comment on column rawsql_transfer.dirty_key_processing.processing_status is
  '処理状態。許可値は succeeded, failed, skipped。Dirty Key処理記録の状態を表す。';

comment on column rawsql_transfer.dirty_key_processing.processing_result is
  '処理結果。no_op, duplicate_ignore, red_then_black_insert, black_insert, red, black_update, physical_delete のいずれかを保持する。';

comment on column rawsql_transfer.dirty_key_processing.error_message is
  'エラーメッセージ。処理失敗時の理由を保持する。';

comment on column rawsql_transfer.dirty_key_processing.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.dirty_key_processing.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.dirty_key_processing.note is
  '備考。運用上の補足を記録する。';
