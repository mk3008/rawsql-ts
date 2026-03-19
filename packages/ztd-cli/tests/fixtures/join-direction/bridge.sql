select
  s.sale_id,
  t.tag_name
from public.sales s
join public.sale_item_tags sit
  on sit.sale_id = s.sale_id
join public.tags t
  on t.tag_id = sit.tag_id;
