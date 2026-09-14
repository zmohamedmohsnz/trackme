begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  (select count(*)::integer from information_schema.tables where table_schema = 'public' and table_name in ('profiles','focus_items','checklist_templates','weekly_plan_versions','weekly_plan_entries','date_overrides','completion_actions','time_entries','daily_checklist_completions')),
  9,
  'all nine domain tables exist'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('profiles','focus_items','checklist_templates','weekly_plan_versions','weekly_plan_entries','date_overrides','completion_actions','time_entries','daily_checklist_completions') and c.relrowsecurity),
  9,
  'RLS is enabled on every exposed domain table'
);

select is(
  (with expected(table_name, constraint_name) as (values
    ('profiles','profiles_locale_check'), ('profiles','profiles_timezone_check'),
    ('profiles','profiles_week_starts_on_check'), ('profiles','profiles_onboarding_step_check'),
    ('focus_items','focus_items_kind_check'), ('focus_items','focus_items_name_check'),
    ('focus_items','focus_items_position_check'), ('focus_items','focus_items_parent_shape_check'),
    ('checklist_templates','checklist_templates_label_check'), ('checklist_templates','checklist_templates_position_check'),
    ('checklist_templates','checklist_templates_effective_range_check'),
    ('weekly_plan_versions','weekly_plan_versions_effective_range_check'),
    ('weekly_plan_entries','weekly_plan_entries_weekday_check'), ('weekly_plan_entries','weekly_plan_entries_target_minutes_check'),
    ('date_overrides','date_overrides_action_check'), ('date_overrides','date_overrides_target_check'),
    ('completion_actions','completion_actions_idempotency_key_check'), ('completion_actions','completion_actions_target_minutes_check'),
    ('completion_actions','completion_actions_progress_minutes_before_check'), ('completion_actions','completion_actions_filled_minutes_check'),
    ('time_entries','time_entries_minutes_check'), ('time_entries','time_entries_source_check'), ('time_entries','time_entries_completion_source_check'),
    ('daily_checklist_completions','daily_checklist_completions_source_check'), ('daily_checklist_completions','daily_checklist_completions_source_action_check')
  ) select count(*)::integer from expected e where not exists (
    select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = e.table_name and c.conname = e.constraint_name and c.contype = 'c'
  )),
  0,
  'every important table check constraint is present'
);

select is(
  (with expected(table_name, constraint_name) as (values
    ('focus_items','focus_items_parent_same_owner_fkey'),
    ('checklist_templates','checklist_templates_item_same_owner_fkey'),
    ('weekly_plan_entries','weekly_plan_entries_version_same_owner_fkey'),
    ('weekly_plan_entries','weekly_plan_entries_item_same_owner_fkey'),
    ('date_overrides','date_overrides_item_same_owner_fkey'),
    ('completion_actions','completion_actions_item_same_owner_fkey'),
    ('time_entries','time_entries_item_same_owner_fkey'),
    ('time_entries','time_entries_action_same_owner_fkey'),
    ('daily_checklist_completions','daily_checklist_completions_template_same_owner_fkey'),
    ('daily_checklist_completions','daily_checklist_completions_action_same_owner_fkey')
  ) select count(*)::integer from expected e where not exists (
    select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = e.table_name and c.conname = e.constraint_name and c.contype = 'f'
  )),
  0,
  'every ownership-preserving composite foreign key is present'
);

select is(
  (with expected(table_name) as (values ('profiles'),('focus_items'),('checklist_templates'),('weekly_plan_versions'),('weekly_plan_entries'),('date_overrides'),('completion_actions'),('time_entries'),('daily_checklist_completions'))
   select count(*)::integer from expected e where not exists (
     select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
     where n.nspname = 'public' and r.relname = e.table_name and c.contype = 'f'
       and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (user_id) REFERENCES auth.users(id)%'
   )),
  0,
  'every domain table has a user ownership foreign key to auth.users'
);

select is(
  (with expected(index_name) as (values
    ('profiles_user_id_idx'), ('focus_items_user_id_idx'), ('focus_items_parent_owner_idx'),
    ('checklist_templates_user_item_dates_idx'), ('weekly_plan_versions_user_dates_idx'),
    ('weekly_plan_entries_version_owner_idx'), ('weekly_plan_entries_item_owner_idx'), ('weekly_plan_entries_user_weekday_idx'),
    ('date_overrides_item_owner_idx'), ('date_overrides_user_date_idx'),
    ('completion_actions_item_owner_idx'), ('completion_actions_user_date_idx'),
    ('time_entries_item_owner_date_idx'), ('time_entries_action_owner_idx'), ('time_entries_user_date_idx'),
    ('daily_checklist_template_owner_date_idx'), ('daily_checklist_action_owner_idx'), ('daily_checklist_user_date_idx')
  ) select count(*)::integer from expected e where to_regclass('public.' || e.index_name) is null),
  0,
  'all required ownership, foreign-key, and query indexes exist'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'schema-one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'schema-two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.focus_items (id, user_id, kind, name) values
  ('31000000-0000-0000-0000-000000000011', '31000000-0000-0000-0000-000000000001', 'area', 'Schema area'),
  ('31000000-0000-0000-0000-000000000012', '31000000-0000-0000-0000-000000000002', 'area', 'Other area');
insert into public.weekly_plan_versions (id, user_id, effective_from) values
  ('31000000-0000-0000-0000-000000000021', '31000000-0000-0000-0000-000000000001', date '2026-09-01');
insert into public.checklist_templates (id, user_id, focus_item_id, label, effective_from) values
  ('31000000-0000-0000-0000-000000000031', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000011', 'Schema step', date '2026-09-01');
insert into public.completion_actions (id, user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes) values
  ('31000000-0000-0000-0000-000000000041', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000011', date '2026-09-13', 'schema-action', 60, 0, 60);

select throws_like($$update public.profiles set locale = 'fr' where user_id = '31000000-0000-0000-0000-000000000001'$$, '%profiles_locale_check%', 'profiles enforce locale choices');
select throws_like($$insert into public.focus_items (user_id, kind, name) values ('31000000-0000-0000-0000-000000000001','area','')$$, '%focus_items_name_check%', 'focus items require a nonblank name');
select throws_like($$insert into public.checklist_templates (user_id, focus_item_id, label, effective_from, effective_to) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000011','Bad range',date '2026-09-02',date '2026-09-01')$$, '%checklist_templates_effective_range_check%', 'checklist templates reject reversed effective ranges');
select throws_like($$insert into public.weekly_plan_versions (user_id, effective_from, effective_to) values ('31000000-0000-0000-0000-000000000001',date '2026-10-02',date '2026-10-01')$$, '%weekly_plan_versions_effective_range_check%', 'weekly plan versions reject reversed effective ranges');
select throws_like($$insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',7,60)$$, '%weekly_plan_entries_weekday_check%', 'weekly plan entries reject impossible weekdays');
select throws_like($$insert into public.date_overrides (user_id, focus_item_id, local_date, action, target_minutes) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000011',date '2026-09-13','skip',60)$$, '%date_overrides_target_check%', 'date overrides enforce action and target consistency');
select throws_like($$insert into public.completion_actions (user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000011',date '2026-09-14','bad-progress',60,-1,60)$$, '%completion_actions_progress_minutes_before_check%', 'completion actions reject negative prior progress');
select throws_like($$insert into public.time_entries (user_id, focus_item_id, local_date, minutes, source) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000011',date '2026-09-13',10,'completion_fill')$$, '%time_entries_completion_source_check%', 'time entries require an action for completion-fill source');
select throws_like($$insert into public.daily_checklist_completions (user_id, checklist_template_id, local_date, source) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000031',date '2026-09-13','completion_auto')$$, '%daily_checklist_completions_source_action_check%', 'checklist completions require an action for automatic source');
select throws_like($$insert into public.checklist_templates (user_id, focus_item_id, label, effective_from) values ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000012','Wrong owner',date '2026-09-01')$$, '%checklist_templates_item_same_owner_fkey%', 'ownership foreign keys reject cross-user relationships');

select * from finish();
rollback;
