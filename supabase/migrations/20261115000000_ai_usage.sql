-- Counters behind the free AI logging quota. No meal content is stored:
-- only how many AI logs each device and network address has used per day,
-- and what the day's calls cost.

create table if not exists public.ai_usage (
  day date not null,
  kind text not null check (kind in ('device', 'ip')),
  subject text not null,
  count integer not null default 0,
  primary key (day, kind, subject)
);

create table if not exists public.ai_spend (
  day date primary key,
  micros bigint not null default 0,  -- millionths of a US dollar
  calls integer not null default 0
);

-- Row level security with no policies: only the service role (the edge function) can read or write.
alter table public.ai_usage enable row level security;
alter table public.ai_spend enable row level security;

create or replace function public.ai_budget_left(p_daily_micros bigint, p_monthly_micros bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select micros from ai_spend where day = (now() at time zone 'utc')::date), 0) < p_daily_micros
    and coalesce((select sum(micros) from ai_spend
                  where day >= date_trunc('month', now() at time zone 'utc')::date), 0) < p_monthly_micros;
$$;

-- Takes one AI log from the device's and the address's daily allowance, if the budget allows.
create or replace function public.claim_ai_log(
  p_device text, p_ip text, p_device_limit integer, p_ip_limit integer,
  p_daily_micros bigint, p_monthly_micros bigint
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d date := (now() at time zone 'utc')::date;
  dev_count integer;
  ip_count integer;
begin
  if not ai_budget_left(p_daily_micros, p_monthly_micros) then
    return jsonb_build_object('ok', false, 'reason', 'budget');
  end if;

  delete from ai_usage where day < d - 7;

  insert into ai_usage (day, kind, subject) values (d, 'device', p_device), (d, 'ip', p_ip)
  on conflict do nothing;

  select count into dev_count from ai_usage where day = d and kind = 'device' and subject = p_device for update;
  select count into ip_count from ai_usage where day = d and kind = 'ip' and subject = p_ip for update;

  if dev_count >= p_device_limit then
    return jsonb_build_object('ok', false, 'reason', 'device', 'remaining', 0);
  end if;
  if ip_count >= p_ip_limit then
    return jsonb_build_object('ok', false, 'reason', 'ip', 'remaining', 0);
  end if;

  update ai_usage set count = count + 1
  where day = d and ((kind = 'device' and subject = p_device) or (kind = 'ip' and subject = p_ip));

  return jsonb_build_object('ok', true, 'remaining', p_device_limit - dev_count - 1);
end;
$$;

-- Gives the allowance back when the AI call failed.
create or replace function public.refund_ai_log(p_device text, p_ip text)
returns void
language sql security definer set search_path = public
as $$
  update ai_usage set count = greatest(count - 1, 0)
  where day = (now() at time zone 'utc')::date
    and ((kind = 'device' and subject = p_device) or (kind = 'ip' and subject = p_ip));
$$;

create or replace function public.record_ai_spend(p_micros bigint)
returns void
language sql security definer set search_path = public
as $$
  insert into ai_spend (day, micros, calls) values ((now() at time zone 'utc')::date, p_micros, 1)
  on conflict (day) do update set micros = ai_spend.micros + excluded.micros, calls = ai_spend.calls + 1;
$$;

create or replace function public.ai_quota(
  p_device text, p_device_limit integer, p_daily_micros bigint, p_monthly_micros bigint
) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'remaining', greatest(p_device_limit - coalesce((
      select count from ai_usage
      where day = (now() at time zone 'utc')::date and kind = 'device' and subject = p_device), 0), 0),
    'limit', p_device_limit,
    'paused', not ai_budget_left(p_daily_micros, p_monthly_micros));
$$;

-- These functions are for the edge function only.
revoke execute on function public.ai_budget_left(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.claim_ai_log(text, text, integer, integer, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.refund_ai_log(text, text) from public, anon, authenticated;
revoke execute on function public.record_ai_spend(bigint) from public, anon, authenticated;
revoke execute on function public.ai_quota(text, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.claim_ai_log(text, text, integer, integer, bigint, bigint) to service_role;
grant execute on function public.refund_ai_log(text, text) to service_role;
grant execute on function public.record_ai_spend(bigint) to service_role;
grant execute on function public.ai_quota(text, integer, bigint, bigint) to service_role;
