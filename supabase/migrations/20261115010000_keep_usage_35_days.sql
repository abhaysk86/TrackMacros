-- Keep the anonymous usage counters for 35 days so that week-on-week return of
-- free AI users can be measured. Matches the retention stated in the privacy policy.
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

  delete from ai_usage where day < d - 35;

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
