alter table public.profiles
add column onboarding_draft jsonb;

create function public.finalize_onboarding(
  p_draft jsonb,
  p_effective_from date
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_completed_at timestamptz;
  v_item jsonb;
  v_item_id uuid;
  v_parent_id uuid;
  v_plan_id uuid;
  v_ids jsonb := '{}'::jsonb;
  v_position integer := 0;
  v_label text;
  v_label_position bigint;
  v_weekday text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select profile.onboarding_completed_at
  into v_completed_at
  from public.profiles as profile
  where profile.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'profile not found or not owned by caller';
  end if;

  if v_completed_at is not null then
    return false;
  end if;

  if jsonb_typeof(p_draft) <> 'object'
    or jsonb_typeof(p_draft -> 'items') <> 'array'
    or nullif(btrim(p_draft ->> 'language'), '') is null
    or nullif(btrim(p_draft ->> 'timezone'), '') is null
    or p_effective_from is null then
    raise exception using errcode = '22023', message = 'invalid onboarding draft';
  end if;

  -- Reconcile setups left partially created by the former multi-request flow.
  delete from public.weekly_plan_versions where user_id = v_user_id;
  delete from public.focus_items where user_id = v_user_id;

  for v_item in
    select item.value
    from jsonb_array_elements(p_draft -> 'items') as item(value)
    where item.value ->> 'kind' = 'area'
      and nullif(btrim(item.value ->> 'name'), '') is not null
  loop
    insert into public.focus_items (user_id, kind, name, position)
    values (v_user_id, 'area', v_item ->> 'name', v_position)
    returning id into v_item_id;

    v_ids := v_ids || jsonb_build_object(v_item ->> 'clientId', v_item_id::text);

    for v_label, v_label_position in
      select label.value, label.ordinality - 1
      from jsonb_array_elements_text(v_item -> 'checklist') with ordinality as label(value, ordinality)
      where nullif(btrim(label.value), '') is not null
    loop
      insert into public.checklist_templates (
        user_id, focus_item_id, label, position, effective_from
      ) values (
        v_user_id, v_item_id, v_label, v_label_position, p_effective_from
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  if v_position = 0 then
    raise exception using errcode = '22023', message = 'at least one named focus area is required';
  end if;

  v_position := 0;
  for v_item in
    select item.value
    from jsonb_array_elements(p_draft -> 'items') as item(value)
    where item.value ->> 'kind' = 'subtask'
      and nullif(btrim(item.value ->> 'name'), '') is not null
  loop
    v_parent_id := nullif(v_ids ->> (v_item ->> 'parentClientId'), '')::uuid;
    if v_parent_id is null then
      raise exception using errcode = '22023', message = 'named subtask has no named parent area';
    end if;

    insert into public.focus_items (user_id, parent_id, kind, name, position)
    values (v_user_id, v_parent_id, 'subtask', v_item ->> 'name', v_position)
    returning id into v_item_id;

    v_ids := v_ids || jsonb_build_object(v_item ->> 'clientId', v_item_id::text);

    for v_label, v_label_position in
      select label.value, label.ordinality - 1
      from jsonb_array_elements_text(v_item -> 'checklist') with ordinality as label(value, ordinality)
      where nullif(btrim(label.value), '') is not null
    loop
      insert into public.checklist_templates (
        user_id, focus_item_id, label, position, effective_from
      ) values (
        v_user_id, v_item_id, v_label, v_label_position, p_effective_from
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  insert into public.weekly_plan_versions (user_id, effective_from)
  values (v_user_id, p_effective_from)
  returning id into v_plan_id;

  for v_item in
    select item.value
    from jsonb_array_elements(p_draft -> 'items') as item(value)
    where nullif(btrim(item.value ->> 'name'), '') is not null
  loop
    v_item_id := nullif(v_ids ->> (v_item ->> 'clientId'), '')::uuid;
    if v_item_id is null then
      continue;
    end if;

    for v_weekday in
      select day.value
      from jsonb_array_elements_text(v_item -> 'weekdays') as day(value)
    loop
      insert into public.weekly_plan_entries (
        user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes
      ) values (
        v_user_id, v_plan_id, v_item_id, v_weekday::smallint, (v_item ->> 'target')::integer
      );
    end loop;
  end loop;

  update public.profiles
  set locale = p_draft ->> 'language',
      timezone = p_draft ->> 'timezone',
      week_starts_on = (p_draft ->> 'weekStart')::smallint,
      onboarding_step = 3,
      onboarding_completed_at = now(),
      onboarding_draft = null
  where user_id = v_user_id;

  return true;
end;
$$;

revoke execute on function public.finalize_onboarding(jsonb, date) from public, anon;
grant execute on function public.finalize_onboarding(jsonb, date) to authenticated;
