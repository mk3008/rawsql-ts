create table transfer_destination_definition (
  transfer_destination_definition_id bigserial primary key

  , transfer_destination_definition_name text not null unique
  , description text null

  , destination_table_name text not null
  , destination_columns jsonb not null
  , destination_key_definition jsonb not null
  , sequence_expression_definition jsonb null

  , update_transfer_policy text not null
  , delete_transfer_policy text not null

  , sign_inversion_columns jsonb null
  , red_transfer_source_columns jsonb null
  , diff_compare_excluded_columns jsonb null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_transfer_destination_definition_name_not_blank
    check (btrim(transfer_destination_definition_name) <> '')

  , constraint chk_transfer_destination_table_name_not_blank
    check (btrim(destination_table_name) <> '')

  , constraint chk_transfer_destination_update_policy
    check (update_transfer_policy in ('overwrite', 'immutable'))

  , constraint chk_transfer_destination_delete_policy
    check (delete_transfer_policy in ('physical_delete', 'immutable', 'ignore'))

  , constraint chk_transfer_destination_columns_object
    check (jsonb_typeof(destination_columns) = 'object')

  , constraint chk_transfer_destination_key_definition_object
    check (jsonb_typeof(destination_key_definition) = 'object')

  , constraint chk_transfer_sequence_expression_definition_object
    check (
      sequence_expression_definition is null
      or jsonb_typeof(sequence_expression_definition) = 'object'
    )

  , constraint chk_transfer_sign_inversion_columns_object
    check (
      sign_inversion_columns is null
      or jsonb_typeof(sign_inversion_columns) = 'object'
    )

  , constraint chk_transfer_red_transfer_source_columns_object
    check (
      red_transfer_source_columns is null
      or jsonb_typeof(red_transfer_source_columns) = 'object'
    )

  , constraint chk_transfer_diff_compare_excluded_columns_object
    check (
      diff_compare_excluded_columns is null
      or jsonb_typeof(diff_compare_excluded_columns) = 'object'
    )
);

comment on table transfer_destination_definition is
  '転送先定義。転送先テーブル、列、主キー、採番式、変更方針、削除方針、赤伝生成に必要な列情報を管理する。';

comment on column transfer_destination_definition.transfer_destination_definition_id is
  '転送先定義ID。サロゲートキー。';

comment on column transfer_destination_definition.transfer_destination_definition_name is
  '転送先定義名。アプリケーションや他の転送定義から名前で参照するため一意にする。例: journal, account_balance。';

comment on column transfer_destination_definition.description is
  '説明。転送先定義の目的や業務上の意味を記録する。';

comment on column transfer_destination_definition.destination_table_name is
  '転送先テーブル名。実際に転送先として書き込むテーブル名。例: journal, account_balance。';

comment on column transfer_destination_definition.destination_columns is
  '転送先列定義。転送先テーブルへ書き込む列の一覧、型、役割などをJSONBで保持する。例: {"columns":[{"name":"amount","type":"numeric","role":"amount"}]}。';

comment on column transfer_destination_definition.destination_key_definition is
  '転送先キー定義。転送先行を一意に特定する主キーまたは一意キーの列定義をJSONBで保持する。赤伝生成時に元黒行を参照するためにも使用する。例: {"keys":["journal_id"]}。';

comment on column transfer_destination_definition.sequence_expression_definition is
  '採番式定義。採番列と採番式をJSONBで保持する。例: {"journal_id": "nextval(''journal_seq'')" }。';

comment on column transfer_destination_definition.update_transfer_policy is
  '変更転送方針。更新時の扱いを表す。許可値は overwrite, immutable。overwrite は既存の転送先行を上書きする方針。immutable は旧黒を赤伝化して新黒を追加する方針。';

comment on column transfer_destination_definition.delete_transfer_policy is
  '削除転送方針。削除時の扱いを表す。許可値は physical_delete, immutable, ignore。physical_delete は転送先行を物理削除する方針。immutable は元黒から赤伝を追加する方針。ignore は削除依頼時に何もしない方針。';

comment on column transfer_destination_definition.sign_inversion_columns is
  '符号反転列定義。赤伝生成時に符号を反転する列をJSONBで保持する。例: {"columns": ["amount"]}。';

comment on column transfer_destination_definition.red_transfer_source_columns is
  '赤伝生成対象列定義。元黒行から赤伝へコピーする対象列をJSONBで保持する。採番列は通常含めない。例: {"columns":["journal_date","amount","remarks"]}。';

comment on column transfer_destination_definition.diff_compare_excluded_columns is
  '差分比較除外列定義。更新判定時に比較対象から除外する転送先列をJSONBで保持する。例: {"columns":["journal_id","created_at"]}。';

comment on column transfer_destination_definition.created_at is
  '作成日時。レコード作成時刻。';

comment on column transfer_destination_definition.updated_at is
  '更新日時。レコード更新時刻。CreateのみのIssueでは初期値として作成日時と同じになる。';

comment on column transfer_destination_definition.note is
  '備考。実装・運用上の補足を記録する。';
