select
  "transfer_destination_definition_id"
  , "transfer_destination_definition_name"
from
  "public"."transfer_destination_definition"
where
  "transfer_destination_definition_name" = any(:destination_definition_names::text[])
order by
  "transfer_destination_definition_name" asc;
