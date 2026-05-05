insert into "public"."transfer_destination_definition" (
  "transfer_destination_definition_name"
  , "description"
  , "destination_table_name"
  , "destination_columns"
  , "destination_key_definition"
  , "sequence_expression_definition"
  , "transfer_model"
  , "sign_inversion_columns"
  , "red_transfer_source_columns"
  , "note"
)
select
  :transfer_destination_definition_name
  , :description
  , :destination_table_name
  , :destination_columns::jsonb
  , :destination_key_definition::jsonb
  , :sequence_expression_definition::jsonb
  , :transfer_model
  , :sign_inversion_columns::jsonb
  , :red_transfer_source_columns::jsonb
  , :note
returning
  "transfer_destination_definition_id"
  , "transfer_destination_definition_name"
  , "description"
  , "destination_table_name"
  , "destination_columns"
  , "destination_key_definition"
  , "sequence_expression_definition"
  , "transfer_model"
  , "sign_inversion_columns"
  , "red_transfer_source_columns"
  , "created_at"
  , "updated_at"
  , "note";
