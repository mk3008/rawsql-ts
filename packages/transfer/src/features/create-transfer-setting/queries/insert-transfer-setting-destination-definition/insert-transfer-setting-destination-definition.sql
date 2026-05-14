insert into "rawsql_transfer"."destination_link" (
  "setting_id"
  , "destination_definition_id"
  , "execution_order"
  , "destination_key_mapping"
  , "mapping_definition"
  , "diff_compare_excluded_columns"
  , "generated_insert_transfer_sql_body"
  , "generated_update_transfer_sql_body"
  , "generated_delete_transfer_sql_body"
  , "generated_sql_status"
  , "generated_sql_error"
  , "is_enabled"
  , "note"
) values (
  :setting_id
  , :destination_definition_id
  , :execution_order
  , :destination_key_mapping
  , :mapping_definition
  , :diff_compare_excluded_columns::jsonb
  , ''
  , ''
  , ''
  , 'not_generated'
  , null
  , :is_enabled
  , :note
) returning
  "destination_link_id"
  , "setting_id"
  , "destination_definition_id"
  , "execution_order"
  , "destination_key_mapping"
  , "mapping_definition"
  , "diff_compare_excluded_columns"
  , "generated_insert_transfer_sql_body"
  , "generated_update_transfer_sql_body"
  , "generated_delete_transfer_sql_body"
  , "generated_sql_status"
  , "generated_sql_error"
  , "is_enabled"
  , "created_at"
  , "updated_at"
  , "note";
