create table transfer_destination_definition (
  transfer_destination_definition_id bigserial primary key

  , transfer_destination_definition_name text not null unique
  , description text null

  , destination_table_name text not null unique
  , destination_columns jsonb not null
  , destination_key_definition jsonb not null
  , sequence_expression_definition jsonb null

  , transfer_model text not null

  , sign_inversion_columns jsonb null
  , red_transfer_source_columns jsonb null

  , created_at timestamptz not null default current_timestamp
  , updated_at timestamptz not null default current_timestamp
  , note text null

  , constraint chk_transfer_destination_definition_name_not_blank
    check (btrim(transfer_destination_definition_name) <> '')

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
);

comment on table transfer_destination_definition is
  '転送先定義。完全修飾された転送先テーブル名、列、主キー、採番式、転送モデル、赤伝生成に必要な列情報を管理する。';

comment on column transfer_destination_definition.transfer_destination_definition_id is
  '転送先定義ID。サロゲートキー。';

comment on column transfer_destination_definition.transfer_destination_definition_name is
  '転送先定義名。アプリケーションや他の転送定義から名前で参照するため一意にする。例: journal, account_balance。';

comment on column transfer_destination_definition.description is
  '説明。転送先定義の目的や業務上の意味を記録する。';

comment on column transfer_destination_definition.destination_table_name is
  '転送先テーブル名。実際に転送先として書き込むテーブルをスキーマ名などを含む完全修飾名で保持し、一意にする。例: public.journal, public.account_balance。';

comment on column transfer_destination_definition.destination_columns is
  '転送先列定義。転送先テーブルへ書き込む列の一覧、型、役割などをJSONBで保持する。例: {"columns":[{"name":"amount","type":"numeric","role":"amount"}]}。';

comment on column transfer_destination_definition.destination_key_definition is
  '転送先キー定義。転送先行を一意に特定する主キーまたは一意キーの列定義をJSONBで保持する。赤伝生成時に元黒行を参照するためにも使用する。例: {"keys":["journal_id"]}。';

comment on column transfer_destination_definition.sequence_expression_definition is
  '採番式定義。採番列と採番式をJSONBで保持する。例: {"journal_id": "nextval(''journal_seq'')" }。';

comment on column transfer_destination_definition.transfer_model is
  '転送モデル。許可値は immutable, mutable。immutable は更新時に元黒の赤伝転送後に新黒を追加し、削除時に元黒の赤伝転送を行う。mutable は更新時に直接UPDATEし、削除時に物理DELETEする。';

comment on column transfer_destination_definition.sign_inversion_columns is
  '符号反転列定義。赤伝生成時に符号を反転する列をJSONBで保持する。例: {"columns": ["amount"]}。';

comment on column transfer_destination_definition.red_transfer_source_columns is
  '赤伝生成対象列定義。元黒行から赤伝へコピーする対象列をJSONBで保持する。採番列は通常含めない。例: {"columns":["journal_date","amount","remarks"]}。';

comment on column transfer_destination_definition.created_at is
  '作成日時。レコード作成時刻。';

comment on column transfer_destination_definition.updated_at is
  '更新日時。レコード更新時刻。CreateのみのIssueでは初期値として作成日時と同じになる。';

comment on column transfer_destination_definition.note is
  '備考。実装・運用上の補足を記録する。';
