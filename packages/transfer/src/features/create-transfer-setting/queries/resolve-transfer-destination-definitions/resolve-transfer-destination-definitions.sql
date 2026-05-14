select
  "destination_definition_id"
  , "destination_definition_name"
from
  "rawsql_transfer"."destination_definition"
where
  "destination_definition_name" = any(:destination_definition_names::text[])
order by
  "destination_definition_name" asc;
