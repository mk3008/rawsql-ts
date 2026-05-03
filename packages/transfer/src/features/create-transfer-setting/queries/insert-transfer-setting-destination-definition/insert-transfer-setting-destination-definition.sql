insert into "public"."transfer_setting_destination_definition" (
  "transfer_setting_id"
  , "transfer_destination_definition_id"
  , "execution_order"
  , "source_key_definition"
  , "mapping_definition"
  , "generated_insert_transfer_sql_body"
  , "generated_update_transfer_sql_body"
  , "generated_red_transfer_sql_body"
  , "generated_delete_transfer_sql_body"
  , "generated_sql_status"
  , "generated_sql_error"
  , "is_enabled"
  , "note"
) values (
  :transfer_setting_id
  , :transfer_destination_definition_id
  , :execution_order
  , :source_key_definition
  , :mapping_definition
  , ''
  , ''
  , ''
  , ''
  , 'not_generated'
  , null
  , :is_enabled
  , :note
) returning
  "transfer_setting_destination_definition_id"
  , "transfer_setting_id"
  , "transfer_destination_definition_id"
  , "execution_order"
  , "source_key_definition"
  , "mapping_definition"
  , "generated_insert_transfer_sql_body"
  , "generated_update_transfer_sql_body"
  , "generated_red_transfer_sql_body"
  , "generated_delete_transfer_sql_body"
  , "generated_sql_status"
  , "generated_sql_error"
  , "is_enabled"
  , "created_at"
  , "updated_at"
  , "note";
