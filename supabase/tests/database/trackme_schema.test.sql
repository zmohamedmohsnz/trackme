begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'completion_actions', 'completion actions table exists');
select has_table('public', 'areas', 'areas table exists');
select has_table('public', 'area_time_goals', 'area time goals table exists');
select has_column('public', 'profiles', 'onboarding_draft', 'profiles persist the complete onboarding draft');
select has_function('public', 'finalize_onboarding', array['jsonb', 'date'], 'transactional onboarding finalizer exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'three@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

create function private.fail_onboarding_test_stage()
returns trigger
language plpgsql
as $$
begin
  if current_setting('trackme.test_fail_stage', true) = tg_argv[0] then
    raise exception 'induced onboarding % failure', tg_argv[0];
  end if;
  return new;
end;
$$;
create trigger fail_onboarding_checklist before insert on public.checklist_templates
for each row execute function private.fail_onboarding_test_stage('checklist');
create trigger fail_onboarding_plan before insert on public.weekly_plan_versions
for each row execute function private.fail_onboarding_test_stage('plan');
create trigger fail_onboarding_profile before update of onboarding_completed_at on public.profiles
for each row execute function private.fail_onboarding_test_stage('profile');

insert into public.areas (id, user_id, name, position) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '11111111-1111-1111-1111-111111111111', 'Area one', 0),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '22222222-2222-2222-2222-222222222222', 'Area two', 0);
insert into public.focus_items (id, user_id, area_id, name, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'Primary task', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'Other task', 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'Sibling task', 1);

select throws_like(
  $$insert into public.time_entries (user_id, focus_item_id, local_date, minutes) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 0)$$,
  '%violates check constraint%',
  'time entries reject zero minutes'
);

select throws_like(
  $$insert into public.focus_items (user_id, area_id, name) values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'Wrong owner')$$,
  '%focus_items_area_same_owner_fkey%',
  'tasks reject areas owned by another user'
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
  $$insert into public.focus_items (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'Forbidden')$$,
  '%row-level security%',
  'RLS rejects writes for another user'
);

create temporary table completion_result as
select * from public.complete_item(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 'complete-area-once'
);

select is((select filled_minutes from completion_result), 100, 'task completion counts only the selected task minutes');
select is(
  (select sum(entry.minutes)::integer from public.time_entries entry
   where entry.local_date = date '2026-09-13' and entry.focus_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  120,
  'task progress excludes time from sibling tasks in the same area'
);
insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes)
values ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 0, 60);
select is(
  (public.complete_item('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', date '2026-09-13', 'complete-sibling')).filled_minutes,
  30,
  'a sibling task completes independently from the other scheduled task'
);
select is((select count(*)::integer from public.daily_checklist_completions), 3, 'both independent task completions check their own steps');
select is((select count(*)::integer from public.daily_checklist_completions where completion_action_id = (select id from completion_result)), 1, 'only newly checked selected-task steps are tied to its action');
select is((select count(*)::integer from public.daily_checklist_completions where checklist_template_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd3'), 1, 'sibling completion checks its own checklist');
select is(
  (select (public.complete_item('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', date '2026-09-13', 'complete-area-once')).id),
  (select id from completion_result),
  'reusing an idempotency key returns the original action'
);
select is((select count(*)::integer from public.completion_actions), 2, 'idempotency creates one action per task');
select ok(public.undo_completion((select id from completion_result)), 'undo succeeds once');
select is((select count(*)::integer from public.time_entries where completion_action_id = (select id from completion_result)), 0, 'undo removes only the selected action-created time');
select is((select count(*)::integer from public.time_entries where source = 'manual'), 2, 'undo preserves manual time');
select is((select count(*)::integer from public.daily_checklist_completions), 2, 'undo preserves manual and sibling checklist state');
select is(public.undo_completion((select id from completion_result)), false, 'undo is idempotent');

select has_function(
  'public',
  'maintain_focus_item_checklist',
  array['uuid', 'jsonb'],
  'effective-dated checklist maintenance function exists'
);
select lives_ok(
  $$select public.maintain_focus_item_checklist(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '[{"operation":"revise","id":"dddddddd-dddd-dddd-dddd-ddddddddddd2","label":"Area reviewed","position":3,"effectiveFrom":"2026-09-14"}]'::jsonb
  )$$,
  'a checklist step can be revised from an effective date'
);
select is(
  (select label || ':' || effective_to::text from public.checklist_templates where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2'),
  'Area manual:2026-09-13',
  'revision preserves the prior label and closes its historical range'
);
select is(
  (select label || ':' || position::text from public.checklist_templates where focus_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and effective_from = date '2026-09-14'),
  'Area reviewed:3',
  'revision creates the new label and order as a new version'
);
select is(
  (select checklist_template_id from public.daily_checklist_completions where local_date = date '2026-09-13' and checklist_template_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2'),
  'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid,
  'revision preserves the historical daily completion reference'
);
select lives_ok(
  $$select public.maintain_focus_item_checklist(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    jsonb_build_array(jsonb_build_object(
      'operation', 'retire',
      'id', (select id from public.checklist_templates where focus_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and effective_from = date '2026-09-14'),
      'effectiveFrom', '2026-09-20'
    ))
  )$$,
  'a checklist step can be retired from an effective date'
);
select is(
  (select effective_to from public.checklist_templates where focus_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and effective_from = date '2026-09-14'),
  date '2026-09-19',
  'retirement closes the active checklist version without deleting it'
);
select throws_like(
  $$select public.maintain_focus_item_checklist(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '[{"operation":"add","label":"Forbidden","position":0,"effectiveFrom":"2026-09-14"}]'::jsonb
  )$$,
  '%not owned by caller%',
  'checklist maintenance rejects cross-user items'
);
select throws_like(
  $$select public.maintain_focus_item_checklist(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '[{"operation":"add","label":"Must roll back","position":9,"effectiveFrom":"2026-09-14"},{"operation":"unsupported","effectiveFrom":"2026-09-14"}]'::jsonb
  )$$,
  '%unsupported checklist operation%',
  'invalid batches fail atomically'
);
select is(
  (select count(*)::integer from public.checklist_templates where label = 'Must roll back'),
  0,
  'a failed checklist batch leaves no partial inserts'
);

select has_index('public', 'time_entries', 'time_entries_user_date_idx', 'time entries have a date lookup index');
select has_index('public', 'focus_items', 'focus_items_area_owner_idx', 'task area foreign key is indexed');
select has_index('public', 'area_time_goals', 'area_time_goals_area_owner_idx', 'area goal foreign key is indexed');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::integer from public.focus_items), 1, 'second user sees only their own item');

select set_config('trackme.test_fail_stage', 'checklist', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"areas":[{"clientId":"area","name":"Onboard area"}],"tasks":[{"clientId":"primary","areaClientId":"area","name":"Onboard primary","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","areaClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding checklist failure%',
  'a checklist-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.focus_items where name like 'Onboard%'), 0, 'checklist-stage interruption rolls back focus items');

select set_config('trackme.test_fail_stage', 'plan', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"areas":[{"clientId":"area","name":"Onboard area"}],"tasks":[{"clientId":"primary","areaClientId":"area","name":"Onboard primary","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","areaClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding plan failure%',
  'a plan-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.checklist_templates where label in ('Review','Read')), 0, 'plan-stage interruption rolls back checklists and items');

select set_config('trackme.test_fail_stage', 'profile', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"areas":[{"clientId":"area","name":"Onboard area"}],"tasks":[{"clientId":"primary","areaClientId":"area","name":"Onboard primary","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","areaClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding profile failure%',
  'a final profile-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.weekly_plan_versions where effective_from = date '2026-09-13'), 0, 'profile-stage interruption rolls back the plan and all prior stages');

select set_config('trackme.test_fail_stage', '', true);
select lives_ok(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"areas":[{"clientId":"area","name":"Onboard area"}],"tasks":[{"clientId":"primary","areaClientId":"area","name":"Onboard primary","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","areaClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  'a valid onboarding draft finalizes after interrupted attempts'
);
select is((select count(*)::integer from public.areas), 1, 'finalization creates exactly one area category');
select is((select count(*)::integer from public.focus_items), 2, 'finalization creates exactly two tasks');
select is((select count(*)::integer from public.checklist_templates), 2, 'finalization creates exactly one checklist per item');
select is((select count(*)::integer from public.weekly_plan_entries), 4, 'finalization preserves every per-weekday target');
select ok((select onboarding_completed_at is not null from public.profiles), 'finalization marks onboarding complete');
select ok((select onboarding_draft is null from public.profiles), 'finalization clears the persisted draft');
create temporary table finalized_onboarding_ids as select id from public.focus_items order by id;
select is(
  public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"areas":[{"clientId":"area","name":"Onboard area"}],"tasks":[{"clientId":"primary","areaClientId":"area","name":"Onboard primary","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","areaClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  ),
  false,
  'retrying a completed finalization returns the existing setup'
);
select is((select count(*)::integer from public.focus_items), 2, 'retrying does not duplicate focus items');
select is(
  (select string_agg(id::text, ',' order by id) from public.focus_items),
  (select string_agg(id::text, ',' order by id) from finalized_onboarding_ids),
  'retrying preserves the canonical item identifiers'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select ok(public.finalize_onboarding(
  '{"language":"ar","timezone":"Africa/Cairo","weekStart":0,"areas":[],"tasks":[{"clientId":"solo","areaClientId":null,"name":"Solo task","checklist":[],"weekdays":[0],"target":"25"}]}'::jsonb,
  date '2026-09-13'
), 'onboarding allows a task without any area');
select is((select count(*)::integer from public.areas), 0, 'area-free onboarding creates no category');
select ok((select area_id is null from public.focus_items where name = 'Solo task'), 'area-free onboarding leaves its task unassigned');
select is((select count(*)::integer from public.weekly_plan_entries), 1, 'an unassigned onboarding task may be scheduled');

select * from finish();
rollback;
