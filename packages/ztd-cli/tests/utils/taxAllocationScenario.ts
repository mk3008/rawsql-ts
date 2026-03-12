export interface TaxAllocationCase {
  invoiceId: number;
  label: string;
  expectedRows: Array<{ id: number; amount_cents: number; allocated_tax_cents: number }>;
}

export const TAX_ALLOCATION_QUERY = `
with input_lines as (
  select
    l.id,
    l.amount_cents,
    l.tax_rate_basis_points
  from public.invoice_lines l
  where l.invoice_id = $1
),
raw_tax_basis as (
  select
    id,
    amount_cents,
    tax_rate_basis_points,
    amount_cents::numeric * tax_rate_basis_points::numeric / 10000 as raw_tax_cents
  from input_lines
),
floored_allocations as (
  select
    id,
    amount_cents,
    floor(raw_tax_cents)::int as floored_tax_cents,
    raw_tax_cents - floor(raw_tax_cents) as discarded_fraction
  from raw_tax_basis
),
expected_total_tax as (
  select
    round(sum(amount_cents::numeric * tax_rate_basis_points::numeric / 10000))::int as expected_tax_cents
  from input_lines
),
ranked_allocations as (
  select
    id,
    amount_cents,
    floored_tax_cents,
    discarded_fraction,
    row_number() over (
      order by discarded_fraction desc, id asc
    ) as allocation_rank
  from floored_allocations
),
bonus_rows as (
  select id
  from ranked_allocations
  where allocation_rank <= (
    select greatest(
      (select round(sum(amount_cents::numeric * tax_rate_basis_points::numeric / 10000))::int from input_lines)
      - coalesce(sum(floored_tax_cents), 0)::int,
      0
    )
    from floored_allocations
  )
),
final_allocations as (
  select
    ranked.id,
    ranked.amount_cents,
    ranked.floored_tax_cents + case when bonus.id is null then 0 else 1 end as allocated_tax_cents
  from ranked_allocations ranked
  left join bonus_rows bonus on bonus.id = ranked.id
)
select id, amount_cents, allocated_tax_cents
from final_allocations
order by id
`;

export const TAX_ALLOCATION_METADATA = {
  material: ['input_lines', 'floored_allocations', 'ranked_allocations'],
  scalarFilterColumns: ['allocation_rank']
} as const;

export const TAX_ALLOCATION_FIXTURE_ROWS = [
  { invoice_id: 1, id: 11, amount_cents: 100, tax_rate_basis_points: 1000 },
  { invoice_id: 1, id: 12, amount_cents: 200, tax_rate_basis_points: 1000 },
  { invoice_id: 2, id: 21, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 2, id: 22, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 2, id: 23, amount_cents: 100, tax_rate_basis_points: 1000 },
  { invoice_id: 3, id: 31, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 3, id: 32, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 3, id: 33, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 4, id: 41, amount_cents: 105, tax_rate_basis_points: 1000 },
  { invoice_id: 5, id: 51, amount_cents: 333, tax_rate_basis_points: 1000 },
  { invoice_id: 5, id: 52, amount_cents: 333, tax_rate_basis_points: 1000 },
  { invoice_id: 5, id: 53, amount_cents: 334, tax_rate_basis_points: 1000 },
  { invoice_id: 6, id: 61, amount_cents: 109, tax_rate_basis_points: 1000 },
  { invoice_id: 6, id: 62, amount_cents: 109, tax_rate_basis_points: 1000 },
  { invoice_id: 6, id: 63, amount_cents: 109, tax_rate_basis_points: 1000 }
] as const;

export const TAX_ALLOCATION_CASES: TaxAllocationCase[] = [
  {
    invoiceId: 1,
    label: 'no remainder',
    expectedRows: [
      { id: 11, amount_cents: 100, allocated_tax_cents: 10 },
      { id: 12, amount_cents: 200, allocated_tax_cents: 20 }
    ]
  },
  {
    invoiceId: 2,
    label: 'remainder 1 with deterministic tie-break',
    expectedRows: [
      { id: 21, amount_cents: 105, allocated_tax_cents: 11 },
      { id: 22, amount_cents: 105, allocated_tax_cents: 10 },
      { id: 23, amount_cents: 100, allocated_tax_cents: 10 }
    ]
  },
  {
    invoiceId: 3,
    label: 'remainder greater than 1',
    expectedRows: [
      { id: 31, amount_cents: 105, allocated_tax_cents: 11 },
      { id: 32, amount_cents: 105, allocated_tax_cents: 11 },
      { id: 33, amount_cents: 105, allocated_tax_cents: 10 }
    ]
  },
  {
    invoiceId: 4,
    label: 'single row',
    expectedRows: [
      { id: 41, amount_cents: 105, allocated_tax_cents: 11 }
    ]
  },
  {
    invoiceId: 5,
    label: 'largest fraction wins',
    expectedRows: [
      { id: 51, amount_cents: 333, allocated_tax_cents: 33 },
      { id: 52, amount_cents: 333, allocated_tax_cents: 33 },
      { id: 53, amount_cents: 334, allocated_tax_cents: 34 }
    ]
  },
  {
    invoiceId: 6,
    label: 'many rows all receive the remainder',
    expectedRows: [
      { id: 61, amount_cents: 109, allocated_tax_cents: 11 },
      { id: 62, amount_cents: 109, allocated_tax_cents: 11 },
      { id: 63, amount_cents: 109, allocated_tax_cents: 11 }
    ]
  }
];
