create table rawsql_transfer.destination_definition (
  destination_definition_id bigserial primary key

  , destination_definition_name text not null unique
  , description text null

  , destination_table_name text not null unique
  , destination_columns jsonb not null
  , destination_key_columns text[] not null
  , sequence_expression_definition jsonb null

  , transfer_model text not null

  , sign_inversion_columns text[] null
  , date_lower_bound_adjustments jsonb null
  , generated_red_transfer_sql_body text not null default ''
  , generated_red_transfer_sql_status text not null default 'not_generated'
  , generated_red_transfer_sql_error text null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_destination_definition_name_not_blank
    check (btrim(destination_definition_name) <> '')

  , constraint chk_transfer_destination_table_name_not_blank
    check (btrim(destination_table_name) <> '')

  , constraint chk_transfer_destination_table_name_qualified
    check (
      position('.' in btrim(destination_table_name)) > 1
      and split_part(btrim(destination_table_name), '.', 1) <> ''
      and split_part(btrim(destination_table_name), '.', 2) <> ''
      and btrim(destination_table_name) =
        split_part(btrim(destination_table_name), '.', 1)
        || '.'
        || split_part(btrim(destination_table_name), '.', 2)
      and right(btrim(destination_table_name), 1) <> '.'
    )

  , constraint chk_transfer_destination_transfer_model
    check (transfer_model in ('immutable', 'mutable'))

  , constraint chk_transfer_destination_columns_object
    check (jsonb_typeof(destination_columns) = 'object')

  , constraint chk_transfer_destination_key_columns_not_empty
    check (cardinality(destination_key_columns) > 0)

  , constraint chk_transfer_destination_key_columns_no_blank
    check (array_position(destination_key_columns, '') is null)

  , constraint chk_transfer_sequence_expression_definition_object
    check (
      sequence_expression_definition is null
      or jsonb_typeof(sequence_expression_definition) = 'object'
    )

  , constraint chk_transfer_sign_inversion_columns_no_blank
    check (
      sign_inversion_columns is null
      or array_position(sign_inversion_columns, '') is null
    )

  , constraint chk_transfer_immutable_sign_inversion_columns_required
    check (
      transfer_model <> 'immutable'
      or (
        sign_inversion_columns is not null
        and cardinality(sign_inversion_columns) > 0
      )
    )

  , constraint chk_transfer_date_lower_bound_adjustments_object
    check (
      date_lower_bound_adjustments is null
      or jsonb_typeof(date_lower_bound_adjustments) = 'object'
    )

  , constraint chk_transfer_destination_generated_red_transfer_sql_status
    check (generated_red_transfer_sql_status in ('not_generated', 'success', 'failed'))
);

comment on table rawsql_transfer.destination_definition is
  '転送先定義。完全修飾された転送先テーブル名、列、主キー、採番式、転送モデル、赤伝生成に必要な列情報を管理する。';

comment on column rawsql_transfer.destination_definition.destination_definition_id is
  '転送先定義ID。サロゲートキー。';

comment on column rawsql_transfer.destination_definition.destination_definition_name is
  '転送先定義名。アプリケーションや他の転送定義から名前で参照するため一意にする。';

comment on column rawsql_transfer.destination_definition.description is
  '説明。転送先定義の目的や業務上の意味を記録する。';

comment on column rawsql_transfer.destination_definition.destination_table_name is
  '転送先テーブル名。実際に転送先として書き込むテーブルをスキーマ名などを含む完全修飾名で保持し、一意にする。';

comment on column rawsql_transfer.destination_definition.destination_columns is
  '転送先列定義。転送先テーブルへ書き込む列名と型情報をJSONBで保持する。';

comment on column rawsql_transfer.destination_definition.destination_key_columns is
  '転送先キー列。転送先行を一意に特定する主キーまたは一意キーの列名を配列で保持する。赤伝生成時に元黒行を参照するためにも使用する。';

comment on column rawsql_transfer.destination_definition.sequence_expression_definition is
  '採番式定義。採番列と採番式をJSONBで保持する。';

comment on column rawsql_transfer.destination_definition.transfer_model is
  '転送モデル。許可値は immutable, mutable。immutable は更新時に元黒の赤伝転送後に新黒を追加し、削除時に元黒の赤伝転送を行う。mutable は更新時に直接UPDATEし、削除時に物理DELETEする。';

comment on column rawsql_transfer.destination_definition.sign_inversion_columns is
  '符号反転列。赤伝生成時に符号を反転する数値列名を配列で保持する。';

comment on column rawsql_transfer.destination_definition.date_lower_bound_adjustments is
  '日付下限制御定義。転送先行の日付補正対象列、補正関数名、引数列、任意の補正通知列をJSONBで保持する。締め管理テーブルや締め判定ロジックそのものは保持しない。';

comment on column rawsql_transfer.destination_definition.generated_red_transfer_sql_body is
  '生成赤伝転送SQL本文。転送先定義に基づき、元黒を読み、符号反転した赤伝を追加するSQLを保持する。';

comment on column rawsql_transfer.destination_definition.generated_red_transfer_sql_status is
  '生成赤伝転送SQL状態。許可値は not_generated, success, failed。';

comment on column rawsql_transfer.destination_definition.generated_red_transfer_sql_error is
  '生成赤伝転送SQLエラー。赤伝転送SQL生成失敗時の理由を保持する。';

comment on column rawsql_transfer.destination_definition.created_at is
  '作成日時。レコード作成時刻。';

comment on column rawsql_transfer.destination_definition.updated_at is
  '更新日時。レコード更新時刻。';

comment on column rawsql_transfer.destination_definition.note is
  '備考。実装・運用上の補足を記録する。';
