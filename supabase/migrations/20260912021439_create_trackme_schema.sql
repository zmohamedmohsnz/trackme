create schema if not exists private;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  timezone text not null default 'UTC' check (btrim(timezone) <> ''),
  week_starts_on smallint not null default 6 check (week_starts_on between 0 and 6),
  onboarding_step integer not null default 0 check (onboarding_step >= 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.focus_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  kind text not null check (kind in ('area', 'subtask')),
  name text not null check (btrim(name) <> ''),
  position integer not null default 0 check (position >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint focus_items_parent_shape_check check (
    (kind = 'area' and parent_id is null)
    or (kind = 'subtask' and parent_id is not null)
  ),
  constraint focus_items_parent_same_owner_fkey
    foreign key (parent_id, user_id)
    references public.focus_items (id, user_id)
    on delete restrict
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  focus_item_id uuid not null,
  label text not null check (btrim(label) <> ''),
  position integer not null default 0 check (position >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint checklist_templates_effective_range_check
    check (effective_to is null or effective_to >= effective_from),
  constraint checklist_templates_item_same_owner_fkey
    foreign key (focus_item_id, user_id)
    references public.focus_items (id, user_id)
    on delete cascade
);

create table public.weekly_plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, effective_from),
  constraint weekly_plan_versions_effective_range_check
    check (effective_to is null or effective_to >= effective_from)
);

create table public.weekly_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekly_plan_version_id uuid not null,
  focus_item_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  target_minutes integer not null check (target_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (weekly_plan_version_id, focus_item_id, weekday),
  constraint weekly_plan_entries_version_same_owner_fkey
    foreign key (weekly_plan_version_id, user_id)
    references public.weekly_plan_versions (id, user_id)
    on delete cascade,
  constraint weekly_plan_entries_item_same_owner_fkey
    foreign key (focus_item_id, user_id)
    references public.focus_items (id, user_id)
    on delete cascade
);

create table public.date_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  focus_item_id uuid not null,
  local_date date not null,
  action text not null check (action in ('add', 'resize', 'skip')),
  target_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, focus_item_id, local_date),
  constraint date_overrides_target_check check (
    (action in ('add', 'resize') and target_minutes between 1 and 1440)
    or (action = 'skip' and target_minutes is null)
  ),
  constraint date_overrides_item_same_owner_fkey
    foreign key (focus_item_id, user_id)
    references public.focus_items (id, user_id)
    on delete cascade
);

create table public.completion_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  focus_item_id uuid not null,
  local_date date not null,
  idempotency_key text not null check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 200),
  target_minutes integer not null check (target_minutes between 1 and 1440),
  progress_minutes_before integer not null check (progress_minutes_before >= 0),
  filled_minutes integer not null check (filled_minutes between 0 and 1440),
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  constraint completion_actions_item_same_owner_fkey
    foreign key (focus_item_id, user_id)
    references public.focus_items (id, user_id)
    on delete restrict
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  focus_item_id uuid not null,
  local_date date not null,
  minutes integer not null check (minutes between 1 and 1440),
  source text not null default 'manual' check (source in ('manual', 'completion_fill')),
  completion_action_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint time_entries_completion_source_check check (
    (source = 'manual' and completion_action_id is null)
    or (source = 'completion_fill' and completion_action_id is not null)
  ),
  constraint time_entries_item_same_owner_fkey
    foreign key (focus_item_id, user_id)
    references public.focus_items (id, user_id)
    on delete restrict,
  constraint time_entries_action_same_owner_fkey
    foreign key (completion_action_id, user_id)
    references public.completion_actions (id, user_id)
    on delete cascade
);

create table public.daily_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_template_id uuid not null,
  local_date date not null,
  source text not null default 'manual' check (source in ('manual', 'completion_auto')),
  completion_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, checklist_template_id, local_date),
  constraint daily_checklist_completions_source_action_check check (
    (source = 'manual' and completion_action_id is null)
    or (source = 'completion_auto' and completion_action_id is not null)
  ),
  constraint daily_checklist_completions_template_same_owner_fkey
    foreign key (checklist_template_id, user_id)
    references public.checklist_templates (id, user_id)
    on delete restrict,
  constraint daily_checklist_completions_action_same_owner_fkey
    foreign key (completion_action_id, user_id)
    references public.completion_actions (id, user_id)
    on delete cascade
);

create index profiles_user_id_idx on public.profiles (user_id);
create index focus_items_user_id_idx on public.focus_items (user_id);
create index focus_items_parent_owner_idx on public.focus_items (parent_id, user_id) where parent_id is not null;
create index checklist_templates_user_item_dates_idx on public.checklist_templates (user_id, focus_item_id, effective_from, effective_to);
create index weekly_plan_versions_user_dates_idx on public.weekly_plan_versions (user_id, effective_from desc, effective_to);
create index weekly_plan_entries_version_owner_idx on public.weekly_plan_entries (weekly_plan_version_id, user_id);
create index weekly_plan_entries_item_owner_idx on public.weekly_plan_entries (focus_item_id, user_id);
create index weekly_plan_entries_user_weekday_idx on public.weekly_plan_entries (user_id, weekday);
create index date_overrides_item_owner_idx on public.date_overrides (focus_item_id, user_id);
create index date_overrides_user_date_idx on public.date_overrides (user_id, local_date);
create index completion_actions_item_owner_idx on public.completion_actions (focus_item_id, user_id);
create index completion_actions_user_date_idx on public.completion_actions (user_id, local_date);
create index time_entries_item_owner_date_idx on public.time_entries (focus_item_id, user_id, local_date);
create index time_entries_action_owner_idx on public.time_entries (completion_action_id, user_id) where completion_action_id is not null;
create index time_entries_user_date_idx on public.time_entries (user_id, local_date);
create index daily_checklist_template_owner_date_idx on public.daily_checklist_completions (checklist_template_id, user_id, local_date);
create index daily_checklist_action_owner_idx on public.daily_checklist_completions (completion_action_id, user_id) where completion_action_id is not null;
create index daily_checklist_user_date_idx on public.daily_checklist_completions (user_id, local_date);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.validate_focus_item_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent_kind text;
  v_parent_parent_id uuid;
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id) then
    raise exception using errcode = '23514', message = 'focus item identity and ownership are immutable';
  end if;

  if new.kind = 'subtask' then
    select item.kind, item.parent_id
      into v_parent_kind, v_parent_parent_id
    from public.focus_items as item
    where item.id = new.parent_id and item.user_id = new.user_id;

    if not found or v_parent_kind <> 'area' or v_parent_parent_id is not null then
      raise exception using errcode = '23514', message = 'a subtask parent must be a top-level area owned by the same user';
    end if;
  end if;

  if new.kind <> 'area' and exists (
    select 1 from public.focus_items as child
    where child.parent_id = new.id and child.user_id = new.user_id
  ) then
    raise exception using errcode = '23514', message = 'an item with children must remain an area';
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger focus_items_set_updated_at before update on public.focus_items
for each row execute function public.set_updated_at();
create trigger checklist_templates_set_updated_at before update on public.checklist_templates
for each row execute function public.set_updated_at();
create trigger weekly_plan_versions_set_updated_at before update on public.weekly_plan_versions
for each row execute function public.set_updated_at();
create trigger weekly_plan_entries_set_updated_at before update on public.weekly_plan_entries
for each row execute function public.set_updated_at();
create trigger date_overrides_set_updated_at before update on public.date_overrides
for each row execute function public.set_updated_at();
create trigger completion_actions_set_updated_at before update on public.completion_actions
for each row execute function public.set_updated_at();
create trigger time_entries_set_updated_at before update on public.time_entries
for each row execute function public.set_updated_at();
create trigger daily_checklist_completions_set_updated_at before update on public.daily_checklist_completions
for each row execute function public.set_updated_at();
create trigger focus_items_validate_hierarchy
before insert or update of id, user_id, parent_id, kind on public.focus_items
for each row execute function public.validate_focus_item_hierarchy();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.focus_items enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.weekly_plan_versions enable row level security;
alter table public.weekly_plan_entries enable row level security;
alter table public.date_overrides enable row level security;
alter table public.time_entries enable row level security;
alter table public.daily_checklist_completions enable row level security;
alter table public.completion_actions enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'focus_items', 'checklist_templates', 'weekly_plan_versions',
    'weekly_plan_entries', 'date_overrides', 'time_entries',
    'daily_checklist_completions', 'completion_actions'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      v_table || '_select_own', v_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      v_table || '_insert_own', v_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      v_table || '_update_own', v_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      v_table || '_delete_own', v_table
    );
  end loop;
end;
$$;

create function public.complete_item(
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
  v_parent public.focus_items%rowtype;
  v_override public.date_overrides%rowtype;
  v_action public.completion_actions%rowtype;
  v_plan_version_id uuid;
  v_target integer;
  v_progress integer;
  v_fill integer;
  v_parent_override_action text;
  v_parent_is_scheduled boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_local_date is null then
    raise exception using errcode = '22004', message = 'local date is required';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'idempotency key must contain 1 to 200 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_item_id::text || ':' || p_local_date::text, 0)
  );

  select action.* into v_action
  from public.completion_actions as action
  where action.user_id = v_user_id and action.idempotency_key = p_idempotency_key;
  if found then
    return v_action;
  end if;

  select item.* into v_item
  from public.focus_items as item
  where item.id = p_item_id and item.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'focus item not found or not owned by caller';
  end if;
  if v_item.archived_at is not null then
    raise exception using errcode = '22023', message = 'archived focus items cannot be completed';
  end if;

  if v_item.parent_id is not null then
    select parent.* into v_parent
    from public.focus_items as parent
    where parent.id = v_item.parent_id and parent.user_id = v_user_id;
    if not found or v_parent.archived_at is not null then
      raise exception using errcode = '22023', message = 'subtask is suppressed by its parent';
    end if;

    select parent_override.action into v_parent_override_action
    from public.date_overrides as parent_override
    where parent_override.user_id = v_user_id
      and parent_override.focus_item_id = v_parent.id
      and parent_override.local_date = p_local_date;

    if found then
      v_parent_is_scheduled := v_parent_override_action <> 'skip';
    else
      select exists (
        select 1
        from public.weekly_plan_versions as parent_version
        join public.weekly_plan_entries as parent_entry
          on parent_entry.weekly_plan_version_id = parent_version.id
          and parent_entry.user_id = parent_version.user_id
        where parent_version.user_id = v_user_id
          and parent_version.effective_from <= p_local_date
          and (parent_version.effective_to is null or parent_version.effective_to >= p_local_date)
          and parent_entry.focus_item_id = v_parent.id
          and parent_entry.weekday = extract(dow from p_local_date)::smallint
          and parent_version.id = (
            select latest_parent_version.id
            from public.weekly_plan_versions as latest_parent_version
            where latest_parent_version.user_id = v_user_id
              and latest_parent_version.effective_from <= p_local_date
              and (latest_parent_version.effective_to is null or latest_parent_version.effective_to >= p_local_date)
            order by latest_parent_version.effective_from desc
            limit 1
          )
      ) into v_parent_is_scheduled;
    end if;

    if not v_parent_is_scheduled then
      raise exception using errcode = '22023', message = 'subtask is suppressed by its parent';
    end if;
  end if;

  select override_row.* into v_override
  from public.date_overrides as override_row
  where override_row.user_id = v_user_id
    and override_row.focus_item_id = p_item_id
    and override_row.local_date = p_local_date;

  if found then
    if v_override.action = 'skip' then
      raise exception using errcode = '22023', message = 'skipped focus items cannot be completed';
    end if;
    v_target := v_override.target_minutes;
  else
    select version.id into v_plan_version_id
    from public.weekly_plan_versions as version
    where version.user_id = v_user_id
      and version.effective_from <= p_local_date
      and (version.effective_to is null or version.effective_to >= p_local_date)
    order by version.effective_from desc
    limit 1;

    select entry.target_minutes into v_target
    from public.weekly_plan_entries as entry
    where entry.user_id = v_user_id
      and entry.weekly_plan_version_id = v_plan_version_id
      and entry.focus_item_id = p_item_id
      and entry.weekday = extract(dow from p_local_date)::smallint;
  end if;

  if v_target is null then
    raise exception using errcode = '22023', message = 'focus item has no target for this date';
  end if;

  if v_item.kind = 'area' then
    select coalesce(sum(entry.minutes), 0)::integer into v_progress
    from public.time_entries as entry
    left join public.focus_items as logged_item
      on logged_item.id = entry.focus_item_id and logged_item.user_id = entry.user_id
    where entry.user_id = v_user_id
      and entry.local_date = p_local_date
      and (entry.focus_item_id = p_item_id or logged_item.parent_id = p_item_id);
  else
    select coalesce(sum(entry.minutes), 0)::integer into v_progress
    from public.time_entries as entry
    where entry.user_id = v_user_id
      and entry.focus_item_id = p_item_id
      and entry.local_date = p_local_date;
  end if;

  v_fill := greatest(v_target - v_progress, 0);

  insert into public.completion_actions (
    user_id, focus_item_id, local_date, idempotency_key,
    target_minutes, progress_minutes_before, filled_minutes
  ) values (
    v_user_id, p_item_id, p_local_date, p_idempotency_key,
    v_target, v_progress, v_fill
  ) returning * into v_action;

  if v_fill > 0 then
    insert into public.time_entries (
      user_id, focus_item_id, local_date, minutes, source, completion_action_id
    ) values (
      v_user_id, p_item_id, p_local_date, v_fill, 'completion_fill', v_action.id
    );
  end if;

  insert into public.daily_checklist_completions (
    user_id, checklist_template_id, local_date, source, completion_action_id
  )
  select v_user_id, template.id, p_local_date, 'completion_auto', v_action.id
  from public.checklist_templates as template
  where template.user_id = v_user_id
    and template.focus_item_id = p_item_id
    and template.effective_from <= p_local_date
    and (template.effective_to is null or template.effective_to >= p_local_date)
  on conflict (user_id, checklist_template_id, local_date) do nothing;

  return v_action;
end;
$$;

create function public.undo_completion(p_action_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_action public.completion_actions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select action.* into v_action
  from public.completion_actions as action
  where action.id = p_action_id and action.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'completion action not found or not owned by caller';
  end if;
  if v_action.undone_at is not null then
    return false;
  end if;

  delete from public.daily_checklist_completions
  where user_id = v_user_id and completion_action_id = p_action_id;
  delete from public.time_entries
  where user_id = v_user_id and completion_action_id = p_action_id;
  update public.completion_actions
  set undone_at = now()
  where id = p_action_id and user_id = v_user_id;

  return true;
end;
$$;

grant usage on schema public to authenticated;
revoke all on table
  public.profiles,
  public.focus_items,
  public.checklist_templates,
  public.weekly_plan_versions,
  public.weekly_plan_entries,
  public.date_overrides,
  public.time_entries,
  public.daily_checklist_completions,
  public.completion_actions
from anon;
grant select, insert, update, delete on table
  public.profiles,
  public.focus_items,
  public.checklist_templates,
  public.weekly_plan_versions,
  public.weekly_plan_entries,
  public.date_overrides,
  public.time_entries,
  public.daily_checklist_completions,
  public.completion_actions
to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_focus_item_hierarchy() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function public.complete_item(uuid, date, text) from public, anon;
revoke execute on function public.undo_completion(uuid) from public, anon;
grant execute on function public.complete_item(uuid, date, text) to authenticated;
grant execute on function public.undo_completion(uuid) to authenticated;
