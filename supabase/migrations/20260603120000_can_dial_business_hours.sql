-- can_dial: honor agents.business_hours + agents.timezone when p_agent_id is set.

create or replace function is_within_business_hours(
  p_hours jsonb,
  p_tz text,
  p_now timestamptz
) returns boolean language plpgsql stable as $$
declare
  v_local timestamp;
  v_dow text;
  v_hour int;
  v_window jsonb;
begin
  v_local := p_now at time zone p_tz;
  v_dow := lower(trim(to_char(v_local, 'Dy')));
  v_hour := extract(hour from v_local)::int;

  if p_hours is null or p_hours = '{}'::jsonb then
    return extract(isodow from v_local) between 1 and 5
       and v_hour between 9 and 19;
  end if;

  v_window := p_hours -> v_dow;
  if v_window is null or jsonb_array_length(v_window) < 2 then
    return false;
  end if;

  return v_hour >= (v_window ->> 0)::int
     and v_hour <= (v_window ->> 1)::int;
end;
$$;

create or replace function can_dial(
  p_org uuid,
  p_e164 text,
  p_now timestamptz,
  p_tz text,
  p_agent_id uuid default null
)
returns boolean language sql stable as $$
  select
        exists (select 1 from contacts
                 where org_id = p_org and e164 = p_e164
                   and consent_status = 'granted' and deleted_at is null)
    and not exists (select 1 from dnc_list where org_id = p_org and e164 = p_e164)
    and coalesce(
      case
        when p_agent_id is not null then (
          select is_within_business_hours(
            a.business_hours,
            coalesce(nullif(a.timezone, ''), p_tz),
            p_now
          )
          from agents a
          where a.id = p_agent_id and a.org_id = p_org and a.deleted_at is null
        )
        else extract(hour from (p_now at time zone p_tz)) between 9 and 19
      end,
      false
    );
$$;
