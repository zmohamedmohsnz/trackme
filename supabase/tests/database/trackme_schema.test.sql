begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'completion_actions', 'completion actions table exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.focus_items (id, user_id, kind, name, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'area', 'Area one', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'area', 'Area two', 0);
insert into public.focus_items (id, user_id, parent_id, kind, name, position) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'subtask', 'Child', 0);

select throws_like(
  $$insert into public.time_entries (user_id, focus_item_id, local_date, minutes) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 0)$$,
  '%violates check constraint%',
  'time entries reject zero minutes'
);

select throws_like(
  $$insert into public.focus_items (user_id, parent_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'subtask', 'Grandchild')$$,
  '%top-level area%',
  'focus items reject deeper nesting'
);

insert into public.weekly_plan_versions (id, user_id, effective_from)
values ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', date '2026-09-01');
insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes)
values ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0, 120);

insert into public.checklist_templates (id, user_id, focus_item_id, label, position, effective_from) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Area automatic', 0, date '2026-09-01'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Area manual', 1, date '2026-09-01'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Child untouched', 0, date '2026-09-01');

insert into public.time_entries (user_id, focus_item_id, local_date, minutes) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 20),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', date '2026-09-13', 30);
insert into public.daily_checklist_completions (user_id, checklist_template_id, local_date)
values ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', date '2026-09-13');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select is((select count(*)::integer from public.focus_items), 2, 'RLS exposes only the first user items');
select throws_like(
  $$insert into public.focus_items (user_id, kind, name) values ('22222222-2222-2222-2222-222222222222', 'area', 'Forbidden')$$,
  '%row-level security%',
  'RLS rejects writes for another user'
);

create temporary table completion_result as
select * from public.complete_item(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 'complete-area-once'
);

select is((select filled_minutes from completion_result), 70, 'area completion fills only missing rolled-up minutes');
select is(
  (select sum(entry.minutes)::integer
   from public.time_entries entry
   left join public.focus_items item on item.id = entry.focus_item_id
   where entry.local_date = date '2026-09-13'
     and (entry.focus_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' or item.parent_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')),
  120,
  'area progress includes direct and immediate child time'
);
select is((select count(*)::integer from public.daily_checklist_completions), 2, 'completion checks remaining selected-item steps');
select is((select count(*)::integer from public.daily_checklist_completions where completion_action_id is not null), 1, 'only newly checked steps are tied to the action');
select is((select count(*)::integer from public.daily_checklist_completions where checklist_template_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd3'), 0, 'completion does not touch descendant checklists');
select is(
  (select (public.complete_item('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 'complete-area-once')).id),
  (select id from completion_result),
  'reusing an idempotency key returns the original action'
);
select is((select count(*)::integer from public.completion_actions), 1, 'idempotency creates one action');
select ok(public.undo_completion((select id from completion_result)), 'undo succeeds once');
select is((select count(*)::integer from public.time_entries where completion_action_id is not null), 0, 'undo removes action-created time');
select is((select count(*)::integer from public.time_entries where source = 'manual'), 2, 'undo preserves manual time');
select is((select count(*)::integer from public.daily_checklist_completions), 1, 'undo preserves pre-existing manual checklist state');
select is(public.undo_completion((select id from completion_result)), false, 'undo is idempotent');

select has_index('public', 'time_entries', 'time_entries_user_date_idx', 'time entries have a date lookup index');
select has_index('public', 'focus_items', 'focus_items_parent_owner_idx', 'focus item parent foreign key is indexed');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::integer from public.focus_items), 1, 'second user sees only their own item');

select * from finish();
rollback;
