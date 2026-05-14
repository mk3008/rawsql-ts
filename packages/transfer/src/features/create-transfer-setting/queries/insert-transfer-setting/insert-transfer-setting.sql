insert into "rawsql_transfer"."setting" (
  "setting_name"
  , "description"
  , "source_sql_body"
  , "source_sql_hash"
  , "source_key_definition"
  , "source_sql_analysis_result"
  , "search_condition_analysis_result"
  , "source_sql_analysis_status"
  , "source_sql_analysis_error"
  , "is_enabled"
  , "note"
) values (
  :setting_name
  , :description
  , :source_sql_body
  , :source_sql_hash
  , :source_key_definition::jsonb
  , :source_sql_analysis_result
  , :search_condition_analysis_result
  , :source_sql_analysis_status
  , :source_sql_analysis_error
  , :is_enabled
  , :note
) returning
  "setting_id"
  , "setting_name"
  , "description"
  , "source_sql_body"
  , "source_sql_hash"
  , "source_key_definition"
  , "source_sql_analysis_result"
  , "search_condition_analysis_result"
  , "source_sql_analysis_status"
  , "source_sql_analysis_error"
  , "is_enabled"
  , "created_at"
  , "updated_at"
  , "note";
