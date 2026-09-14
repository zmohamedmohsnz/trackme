begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-three@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');
delete from public.profiles where user_id = '32000000-0000-0000-0000-000000000003';

insert into public.focus_items (id, user_id, kind, name) values
  ('32000000-0000-0000-0000-000000000011', '32000000-0000-0000-0000-000000000001', 'area', 'RLS one'),
  ('32000000-0000-0000-0000-000000000012', '32000000-0000-0000-0000-000000000002', 'area', 'RLS two');
insert into public.checklist_templates (id, user_id, focus_item_id, label, effective_from) values
  ('32000000-0000-0000-0000-000000000021', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000011', 'RLS one step', date '2026-09-01'),
  ('32000000-0000-0000-0000-000000000022', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000012', 'RLS two step', date '2026-09-01');
insert into public.weekly_plan_versions (id, user_id, effective_from) values
  ('32000000-0000-0000-0000-000000000031', '32000000-0000-0000-0000-000000000001', date '2026-09-01'),
  ('32000000-0000-0000-0000-000000000032', '32000000-0000-0000-0000-000000000002', date '2026-09-01');
insert into public.weekly_plan_entries (id, user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes) values
  ('32000000-0000-0000-0000-000000000041', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000031', '32000000-0000-0000-0000-000000000011', 0, 60),
  ('32000000-0000-0000-0000-000000000042', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000032', '32000000-0000-0000-0000-000000000012', 0, 60);
insert into public.date_overrides (id, user_id, focus_item_id, local_date, action, target_minutes) values
  ('32000000-0000-0000-0000-000000000051', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000011', date '2026-09-14', 'resize', 45),
  ('32000000-0000-0000-0000-000000000052', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000012', date '2026-09-14', 'resize', 45);
insert into public.completion_actions (id, user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes) values
  ('32000000-0000-0000-0000-000000000061', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000011', date '2026-09-13', 'rls-one', 60, 0, 60),
  ('32000000-0000-0000-0000-000000000062', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000012', date '2026-09-13', 'rls-two', 60, 0, 60);
insert into public.time_entries (id, user_id, focus_item_id, local_date, minutes) values
  ('32000000-0000-0000-0000-000000000071', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000011', date '2026-09-13', 10),
  ('32000000-0000-0000-0000-000000000072', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000012', date '2026-09-13', 10);
insert into public.daily_checklist_completions (id, user_id, checklist_template_id, local_date) values
  ('32000000-0000-0000-0000-000000000081', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000021', date '2026-09-13'),
  ('32000000-0000-0000-0000-000000000082', '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000022', date '2026-09-13');

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename in ('profiles','focus_items','checklist_templates','weekly_plan_versions','weekly_plan_entries','date_overrides','completion_actions','time_entries','daily_checklist_completions')),
  36,
  'every exposed table has four operation-specific RLS policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and cmd = 'UPDATE' and with_check is not null and tablename in ('profiles','focus_items','checklist_templates','weekly_plan_versions','weekly_plan_entries','date_overrides','completion_actions','time_entries','daily_checklist_completions')),
  9,
  'every update policy has an ownership WITH CHECK expression'
);

select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is((select count(*)::integer from public.profiles), 1, 'profiles SELECT exposes only owned rows');
select is((select count(*)::integer from public.focus_items), 1, 'focus_items SELECT exposes only owned rows');
select is((select count(*)::integer from public.checklist_templates), 1, 'checklist_templates SELECT exposes only owned rows');
select is((select count(*)::integer from public.weekly_plan_versions), 1, 'weekly_plan_versions SELECT exposes only owned rows');
select is((select count(*)::integer from public.weekly_plan_entries), 1, 'weekly_plan_entries SELECT exposes only owned rows');
select is((select count(*)::integer from public.date_overrides), 1, 'date_overrides SELECT exposes only owned rows');
select is((select count(*)::integer from public.completion_actions), 1, 'completion_actions SELECT exposes only owned rows');
select is((select count(*)::integer from public.time_entries), 1, 'time_entries SELECT exposes only owned rows');
select is((select count(*)::integer from public.daily_checklist_completions), 1, 'daily_checklist_completions SELECT exposes only owned rows');

select throws_like($$insert into public.profiles (user_id) values ('32000000-0000-0000-0000-000000000003')$$, '%row-level security%', 'profiles INSERT rejects another owner');
select throws_like($$insert into public.focus_items (user_id, kind, name) values ('32000000-0000-0000-0000-000000000002','area','Forbidden')$$, '%row-level security%', 'focus_items INSERT rejects another owner');
select throws_like($$insert into public.checklist_templates (user_id, focus_item_id, label, effective_from) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000022','Forbidden',date '2026-09-01')$$, '%row-level security%', 'checklist_templates INSERT rejects another owner');
select throws_like($$insert into public.weekly_plan_versions (user_id, effective_from) values ('32000000-0000-0000-0000-000000000002',date '2026-10-01')$$, '%row-level security%', 'weekly_plan_versions INSERT rejects another owner');
select throws_like($$insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000032','32000000-0000-0000-0000-000000000012',1,60)$$, '%row-level security%', 'weekly_plan_entries INSERT rejects another owner');
select throws_like($$insert into public.date_overrides (user_id, focus_item_id, local_date, action, target_minutes) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000012',date '2026-09-15','resize',30)$$, '%row-level security%', 'date_overrides INSERT rejects another owner');
select throws_like($$insert into public.completion_actions (user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000012',date '2026-09-15','forbidden',60,0,60)$$, '%row-level security%', 'completion_actions INSERT rejects another owner');
select throws_like($$insert into public.time_entries (user_id, focus_item_id, local_date, minutes) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000012',date '2026-09-15',10)$$, '%row-level security%', 'time_entries INSERT rejects another owner');
select throws_like($$insert into public.daily_checklist_completions (user_id, checklist_template_id, local_date) values ('32000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000022',date '2026-09-15')$$, '%row-level security%', 'daily_checklist_completions INSERT rejects another owner');

select results_eq($$update public.profiles set locale = 'ar' where user_id = '32000000-0000-0000-0000-000000000002' returning 1$$, $$select 1 where false$$, 'profiles UPDATE cannot target another user');
select results_eq($$update public.focus_items set name = 'Hacked' where id = '32000000-0000-0000-0000-000000000012' returning 1$$, $$select 1 where false$$, 'focus_items UPDATE cannot target another user');
select results_eq($$update public.checklist_templates set label = 'Hacked' where id = '32000000-0000-0000-0000-000000000022' returning 1$$, $$select 1 where false$$, 'checklist_templates UPDATE cannot target another user');
select results_eq($$update public.weekly_plan_versions set effective_to = date '2026-09-30' where id = '32000000-0000-0000-0000-000000000032' returning 1$$, $$select 1 where false$$, 'weekly_plan_versions UPDATE cannot target another user');
select results_eq($$update public.weekly_plan_entries set target_minutes = 30 where id = '32000000-0000-0000-0000-000000000042' returning 1$$, $$select 1 where false$$, 'weekly_plan_entries UPDATE cannot target another user');
select results_eq($$update public.date_overrides set target_minutes = 30 where id = '32000000-0000-0000-0000-000000000052' returning 1$$, $$select 1 where false$$, 'date_overrides UPDATE cannot target another user');
select results_eq($$update public.completion_actions set undone_at = now() where id = '32000000-0000-0000-0000-000000000062' returning 1$$, $$select 1 where false$$, 'completion_actions UPDATE cannot target another user');
select results_eq($$update public.time_entries set minutes = 20 where id = '32000000-0000-0000-0000-000000000072' returning 1$$, $$select 1 where false$$, 'time_entries UPDATE cannot target another user');
select results_eq($$update public.daily_checklist_completions set local_date = date '2026-09-14' where id = '32000000-0000-0000-0000-000000000082' returning 1$$, $$select 1 where false$$, 'daily_checklist_completions UPDATE cannot target another user');

select throws_like($$update public.profiles set user_id = '32000000-0000-0000-0000-000000000002' where user_id = '32000000-0000-0000-0000-000000000001'$$, '%row-level security%', 'profiles deny ownership reassignment');
select throws_like($$update public.focus_items set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000011'$$, '%ownership are immutable%', 'focus_items deny ownership reassignment');
select throws_like($$update public.checklist_templates set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000021'$$, '%row-level security%', 'checklist_templates deny ownership reassignment');
select throws_like($$update public.weekly_plan_versions set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000031'$$, '%row-level security%', 'weekly_plan_versions deny ownership reassignment');
select throws_like($$update public.weekly_plan_entries set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000041'$$, '%row-level security%', 'weekly_plan_entries deny ownership reassignment');
select throws_like($$update public.date_overrides set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000051'$$, '%row-level security%', 'date_overrides deny ownership reassignment');
select throws_like($$update public.completion_actions set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000061'$$, '%row-level security%', 'completion_actions deny ownership reassignment');
select throws_like($$update public.time_entries set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000071'$$, '%row-level security%', 'time_entries deny ownership reassignment');
select throws_like($$update public.daily_checklist_completions set user_id = '32000000-0000-0000-0000-000000000002' where id = '32000000-0000-0000-0000-000000000081'$$, '%row-level security%', 'daily_checklist_completions deny ownership reassignment');

select results_eq($$delete from public.profiles where user_id = '32000000-0000-0000-0000-000000000002' returning 1$$, $$select 1 where false$$, 'profiles DELETE cannot target another user');
select results_eq($$delete from public.focus_items where id = '32000000-0000-0000-0000-000000000012' returning 1$$, $$select 1 where false$$, 'focus_items DELETE cannot target another user');
select results_eq($$delete from public.checklist_templates where id = '32000000-0000-0000-0000-000000000022' returning 1$$, $$select 1 where false$$, 'checklist_templates DELETE cannot target another user');
select results_eq($$delete from public.weekly_plan_versions where id = '32000000-0000-0000-0000-000000000032' returning 1$$, $$select 1 where false$$, 'weekly_plan_versions DELETE cannot target another user');
select results_eq($$delete from public.weekly_plan_entries where id = '32000000-0000-0000-0000-000000000042' returning 1$$, $$select 1 where false$$, 'weekly_plan_entries DELETE cannot target another user');
select results_eq($$delete from public.date_overrides where id = '32000000-0000-0000-0000-000000000052' returning 1$$, $$select 1 where false$$, 'date_overrides DELETE cannot target another user');
select results_eq($$delete from public.completion_actions where id = '32000000-0000-0000-0000-000000000062' returning 1$$, $$select 1 where false$$, 'completion_actions DELETE cannot target another user');
select results_eq($$delete from public.time_entries where id = '32000000-0000-0000-0000-000000000072' returning 1$$, $$select 1 where false$$, 'time_entries DELETE cannot target another user');
select results_eq($$delete from public.daily_checklist_completions where id = '32000000-0000-0000-0000-000000000082' returning 1$$, $$select 1 where false$$, 'daily_checklist_completions DELETE cannot target another user');

select * from finish();
rollback;
