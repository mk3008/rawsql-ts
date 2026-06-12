insert into "rawsql_transfer"."destination_definition" (
  "destination_definition_name"
  , "description"
  , "destination_table_name"
  , "destination_columns"
  , "destination_key_columns"
  , "sequence_expression_definition"
  , "transfer_model"
  , "sign_inversion_columns"
  , "note"
)
select
  :destination_definition_name
  , :description
  , :destination_table_name
  , :destination_columns::jsonb
  , :destination_key_columns::text[]
  , :sequence_expression_definition::jsonb
  , :transfer_model
  , :sign_inversion_columns::text[]
  , :note
returning
  "destination_definition_id"
  , "destination_definition_name"
  , "description"
  , "destination_table_name"
  , "destination_columns"
  , "destination_key_columns"
  , "sequence_expression_definition"
  , "transfer_model"
  , "sign_inversion_columns"
  , "generated_red_transfer_sql_body"
  , "generated_red_transfer_sql_status"
  , "generated_red_transfer_sql_error"
  , "created_at"
  , "updated_at"
  , "note";
