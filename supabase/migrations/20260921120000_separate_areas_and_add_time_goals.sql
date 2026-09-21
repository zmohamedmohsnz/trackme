create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  position integer not null default 0 check (position >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create temporary table area_migration_map (
  old_item_id uuid primary key,
  new_area_id uuid not null
) on commit drop;

insert into area_migration_map (old_item_id, new_area_id)
select id, gen_random_uuid()
from public.focus_items
where kind = 'area';

insert into public.areas (id, user_id, name, position, archived_at, created_at, updated_at)
select mapping.new_area_id, item.user_id, item.name, item.position, item.archived_at, item.created_at, item.updated_at
from area_migration_map as mapping
join public.focus_items as item on item.id = mapping.old_item_id;

alter table public.focus_items add column area_id uuid;

update public.focus_items as item
set area_id = mapping.new_area_id,
    name = 'General'
from area_migration_map as mapping
where item.id = mapping.old_item_id;

update public.focus_items as item
set area_id = mapping.new_area_id
from area_migration_map as mapping
where item.parent_id = mapping.old_item_id;

drop trigger focus_items_validate_hierarchy on public.focus_items;
drop function public.validate_focus_item_hierarchy();
alter table public.focus_items drop constraint focus_items_parent_same_owner_fkey;
alter table public.focus_items drop constraint focus_items_parent_shape_check;
alter table public.focus_items drop constraint focus_items_kind_check;
drop index public.focus_items_parent_owner_idx;
alter table public.focus_items drop column parent_id;
alter table public.focus_items drop column kind;
alter table public.focus_items
  add constraint focus_items_area_same_owner_fkey
  foreign key (area_id, user_id)
  references public.areas (id, user_id)
  on delete set null (area_id);

create table public.area_time_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id uuid not null,
  period text not null check (period in ('day', 'week', 'month', 'year')),
  target_minutes integer not null check (target_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, area_id, period),
  constraint area_time_goals_area_same_owner_fkey
    foreign key (area_id, user_id)
    references public.areas (id, user_id)
    on delete cascade
);

create index areas_user_id_idx on public.areas (user_id);
create index focus_items_area_owner_idx on public.focus_items (area_id, user_id) where area_id is not null;
create index area_time_goals_area_owner_idx on public.area_time_goals (area_id, user_id);
create index area_time_goals_user_period_idx on public.area_time_goals (user_id, period);

create trigger areas_set_updated_at before update on public.areas
for each row execute function public.set_updated_at();
create trigger area_time_goals_set_updated_at before update on public.area_time_goals
for each row execute function public.set_updated_at();

alter table public.areas enable row level security;
alter table public.area_time_goals enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['areas', 'area_time_goals']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', v_table || '_select_own', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', v_table || '_insert_own', v_table);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', v_table || '_update_own', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', v_table || '_delete_own', v_table);
  end loop;
end;
$$;

revoke all on table public.areas, public.area_time_goals from anon;
grant select, insert, update, delete on table public.areas, public.area_time_goals to authenticated;

update public.profiles as profile
set onboarding_draft = jsonb_build_object(
  'language', profile.onboarding_draft -> 'language',
  'timezone', profile.onboarding_draft -> 'timezone',
  'weekStart', profile.onboarding_draft -> 'weekStart',
  'areas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'clientId', item.value -> 'clientId',
      'name', item.value -> 'name'
    ) order by item.ordinality)
    from jsonb_array_elements(profile.onboarding_draft -> 'items') with ordinality as item(value, ordinality)
    where item.value ->> 'kind' = 'area'
  ), '[]'::jsonb),
  'tasks', coalesce((
    select jsonb_agg(
      case when item.value ->> 'kind' = 'area' then
        jsonb_build_object(
          'clientId', (item.value ->> 'clientId') || ':general',
          'areaClientId', item.value -> 'clientId',
          'name', 'General',
          'checklist', coalesce(item.value -> 'checklist', '[]'::jsonb),
          'weekdays', coalesce(item.value -> 'weekdays', '[]'::jsonb),
          'target', coalesce(item.value -> 'target', to_jsonb('60'::text))
        )
      else
        jsonb_strip_nulls(jsonb_build_object(
          'clientId', item.value -> 'clientId',
          'areaClientId', item.value -> 'parentClientId',
          'name', item.value -> 'name',
          'checklist', coalesce(item.value -> 'checklist', '[]'::jsonb),
          'weekdays', coalesce(item.value -> 'weekdays', '[]'::jsonb),
          'target', coalesce(item.value -> 'target', to_jsonb('60'::text))
        ))
      end order by item.ordinality
    )
    from jsonb_array_elements(profile.onboarding_draft -> 'items') with ordinality as item(value, ordinality)
  ), '[]'::jsonb)
)
where profile.onboarding_draft is not null
  and profile.onboarding_draft ? 'items'
  and not (profile.onboarding_draft ? 'tasks');

create or replace function public.complete_item(
  p_item_id uuid,
  p_local_date date,
  p_idempotency_key text
)
returns public.completion_actions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.focus_items%rowtype;
  v_override public.date_overrides%rowtype;
  v_action public.completion_actions%rowtype;
  v_plan_version_id uuid;
  v_target integer;
  v_progress integer;
  v_fill integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if p_local_date is null then raise exception using errcode = '22004', message = 'local date is required'; end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'idempotency key must contain 1 to 200 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_item_id::text || ':' || p_local_date::text, 0));
  select action.* into v_action from public.completion_actions as action
  where action.user_id = v_user_id and action.idempotency_key = p_idempotency_key;
  if found then return v_action; end if;

  select item.* into v_item from public.focus_items as item
  where item.id = p_item_id and item.user_id = v_user_id for update;
  if not found then raise exception using errcode = '42501', message = 'focus item not found or not owned by caller'; end if;
  if v_item.archived_at is not null then raise exception using errcode = '22023', message = 'archived focus items cannot be completed'; end if;

  select override_row.* into v_override from public.date_overrides as override_row
  where override_row.user_id = v_user_id and override_row.focus_item_id = p_item_id and override_row.local_date = p_local_date;
  if found then
    if v_override.action = 'skip' then raise exception using errcode = '22023', message = 'skipped focus items cannot be completed'; end if;
    v_target := v_override.target_minutes;
  else
    select version.id into v_plan_version_id from public.weekly_plan_versions as version
    where version.user_id = v_user_id and version.effective_from <= p_local_date
      and (version.effective_to is null or version.effective_to >= p_local_date)
    order by version.effective_from desc limit 1;
    select entry.target_minutes into v_target from public.weekly_plan_entries as entry
    where entry.user_id = v_user_id and entry.weekly_plan_version_id = v_plan_version_id
      and entry.focus_item_id = p_item_id and entry.weekday = extract(dow from p_local_date)::smallint;
  end if;
  if v_target is null then raise exception using errcode = '22023', message = 'focus item has no target for this date'; end if;

  select coalesce(sum(entry.minutes), 0)::integer into v_progress
  from public.time_entries as entry
  where entry.user_id = v_user_id and entry.focus_item_id = p_item_id and entry.local_date = p_local_date;
  v_fill := greatest(v_target - v_progress, 0);

  insert into public.completion_actions (user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes)
  values (v_user_id, p_item_id, p_local_date, p_idempotency_key, v_target, v_progress, v_fill)
  returning * into v_action;
  if v_fill > 0 then
    insert into public.time_entries (user_id, focus_item_id, local_date, minutes, source, completion_action_id)
    values (v_user_id, p_item_id, p_local_date, v_fill, 'completion_fill', v_action.id);
  end if;
  insert into public.daily_checklist_completions (user_id, checklist_template_id, local_date, source, completion_action_id)
  select v_user_id, template.id, p_local_date, 'completion_auto', v_action.id
  from public.checklist_templates as template
  where template.user_id = v_user_id and template.focus_item_id = p_item_id
    and template.effective_from <= p_local_date and (template.effective_to is null or template.effective_to >= p_local_date)
  on conflict (user_id, checklist_template_id, local_date) do nothing;
  return v_action;
end;
$$;

create or replace function public.finalize_onboarding(p_draft jsonb, p_effective_from date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_completed_at timestamptz;
  v_entry jsonb;
  v_area_id uuid;
  v_item_id uuid;
  v_plan_id uuid;
  v_area_ids jsonb := '{}'::jsonb;
  v_label text;
  v_label_position bigint;
  v_weekday text;
  v_position integer := 0;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select onboarding_completed_at into v_completed_at from public.profiles where user_id = v_user_id for update;
  if not found then raise exception using errcode = '42501', message = 'profile not found or not owned by caller'; end if;
  if v_completed_at is not null then return false; end if;
  if jsonb_typeof(p_draft) <> 'object' or jsonb_typeof(p_draft -> 'areas') <> 'array'
    or jsonb_typeof(p_draft -> 'tasks') <> 'array' or jsonb_array_length(p_draft -> 'tasks') = 0
    or nullif(btrim(p_draft ->> 'language'), '') is null or nullif(btrim(p_draft ->> 'timezone'), '') is null
    or p_effective_from is null then
    raise exception using errcode = '22023', message = 'invalid onboarding draft';
  end if;

  delete from public.weekly_plan_versions where user_id = v_user_id;
  delete from public.focus_items where user_id = v_user_id;
  delete from public.areas where user_id = v_user_id;

  for v_entry in select value from jsonb_array_elements(p_draft -> 'areas') loop
    if nullif(btrim(v_entry ->> 'name'), '') is null then continue; end if;
    insert into public.areas (user_id, name, position) values (v_user_id, v_entry ->> 'name', v_position) returning id into v_area_id;
    v_area_ids := v_area_ids || jsonb_build_object(v_entry ->> 'clientId', v_area_id::text);
    v_position := v_position + 1;
  end loop;

  v_position := 0;
  for v_entry in select value from jsonb_array_elements(p_draft -> 'tasks') loop
    if nullif(btrim(v_entry ->> 'name'), '') is null then continue; end if;
    v_area_id := nullif(v_area_ids ->> (v_entry ->> 'areaClientId'), '')::uuid;
    if nullif(v_entry ->> 'areaClientId', '') is not null and v_area_id is null then
      raise exception using errcode = '22023', message = 'task references an unknown area';
    end if;
    insert into public.focus_items (user_id, area_id, name, position)
    values (v_user_id, v_area_id, v_entry ->> 'name', v_position) returning id into v_item_id;
    for v_label, v_label_position in
      select label.value, label.ordinality - 1 from jsonb_array_elements_text(v_entry -> 'checklist') with ordinality as label(value, ordinality)
      where nullif(btrim(label.value), '') is not null
    loop
      insert into public.checklist_templates (user_id, focus_item_id, label, position, effective_from)
      values (v_user_id, v_item_id, v_label, v_label_position, p_effective_from);
    end loop;
    if v_plan_id is null then
      insert into public.weekly_plan_versions (user_id, effective_from) values (v_user_id, p_effective_from) returning id into v_plan_id;
    end if;
    for v_weekday in select value from jsonb_array_elements_text(v_entry -> 'weekdays') loop
      insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes)
      values (v_user_id, v_plan_id, v_item_id, v_weekday::smallint, (v_entry ->> 'target')::integer);
    end loop;
    v_position := v_position + 1;
  end loop;
  if v_position = 0 then raise exception using errcode = '22023', message = 'at least one named task is required'; end if;

  update public.profiles set locale = p_draft ->> 'language', timezone = p_draft ->> 'timezone',
    week_starts_on = (p_draft ->> 'weekStart')::smallint, onboarding_step = 3,
    onboarding_completed_at = now(), onboarding_draft = null
  where user_id = v_user_id;
  return true;
end;
$$;

revoke execute on function public.complete_item(uuid, date, text) from public, anon;
grant execute on function public.complete_item(uuid, date, text) to authenticated;
revoke execute on function public.finalize_onboarding(jsonb, date) from public, anon;
grant execute on function public.finalize_onboarding(jsonb, date) to authenticated;
