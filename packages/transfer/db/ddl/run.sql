create table rawsql_transfer.run (
  run_id bigserial primary key

  , setting_id bigint not null
    references rawsql_transfer.setting(setting_id)

  , run_arguments jsonb not null default '{}'::jsonb
  , run_status text not null
  , trigger_kind text null
  , snapshot_at timestamptz null
  , started_at timestamptz null
  , finished_at timestamptz null
  , error_message text null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_run_arguments_object
    check (jsonb_typeof(run_arguments) = 'object')

  , constraint chk_run_status
    check (run_status in ('created', 'running', 'succeeded', 'failed', 'cancelled'))

  , constraint chk_run_trigger_kind_not_blank
    check (
      trigger_kind is null
      or btrim(trigger_kind) <> ''
    )

  , constraint uq_run_setting_identity
    unique (run_id, setting_id)
);

create index idx_run_setting_created_at
  on rawsql_transfer.run (
    setting_id
    , created_at
    , run_id
  );

create index idx_run_status_created_at
  on rawsql_transfer.run (
    run_status
    , created_at
    , run_id
  );

comment on table rawsql_transfer.run is
  '転送実行。転送実行時の引数、対象転送設定、実行全体の状態、実行時刻を記録するプロセスヘッダー。';

comment on column rawsql_transfer.run.run_id is
  '転送実行ID。シーケンスで採番するサロゲートキー。';

comment on column rawsql_transfer.run.setting_id is
  '転送設定ID。この転送実行が対象にする転送設定を参照する。';

comment on column rawsql_transfer.run.run_arguments is
  '実行引数。転送実行開始時に指定された任意引数をJSONBで保持する。';

comment on column rawsql_transfer.run.run_status is
  '実行状態。許可値は created, running, succeeded, failed, cancelled。実行全体のライフサイクル状態を表す。';

comment on column rawsql_transfer.run.trigger_kind is
  '実行契機種別。日次、月次、手動、再実行などの実行契機の分類を保持する。';

comment on column rawsql_transfer.run.snapshot_at is
  'スナップショット基準日時。転送元をどの時点の状態として扱ったかを説明する日時。';

comment on column rawsql_transfer.run.started_at is
  '開始日時。転送実行の開始日時。';

comment on column rawsql_transfer.run.finished_at is
  '終了日時。転送実行の終了日時。';

comment on column rawsql_transfer.run.error_message is
  'エラーメッセージ。転送実行全体で発生したエラーの説明を保持する。';

comment on column rawsql_transfer.run.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.run.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.run.note is
  '備考。運用上の補足を記録する。';
