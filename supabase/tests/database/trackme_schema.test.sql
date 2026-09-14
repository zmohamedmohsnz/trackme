begin;

create extension if not exists pgtap with schema extensions;
select plan(48);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'completion_actions', 'completion actions table exists');
select has_column('public', 'profiles', 'onboarding_draft', 'profiles persist the complete onboarding draft');
select has_function('public', 'finalize_onboarding', array['jsonb', 'date'], 'transactional onboarding finalizer exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

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
  (select checklist_template_id from public.daily_checklist_completions where local_date = date '2026-09-13'),
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
select has_index('public', 'focus_items', 'focus_items_parent_owner_idx', 'focus item parent foreign key is indexed');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::integer from public.focus_items), 1, 'second user sees only their own item');

select set_config('trackme.test_fail_stage', 'checklist', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"items":[{"clientId":"area","kind":"area","name":"Onboard area","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","kind":"subtask","parentClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding checklist failure%',
  'a checklist-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.focus_items where name like 'Onboard%'), 0, 'checklist-stage interruption rolls back focus items');

select set_config('trackme.test_fail_stage', 'plan', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"items":[{"clientId":"area","kind":"area","name":"Onboard area","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","kind":"subtask","parentClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding plan failure%',
  'a plan-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.checklist_templates where label in ('Review','Read')), 0, 'plan-stage interruption rolls back checklists and items');

select set_config('trackme.test_fail_stage', 'profile', true);
select throws_like(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"items":[{"clientId":"area","kind":"area","name":"Onboard area","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","kind":"subtask","parentClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  '%induced onboarding profile failure%',
  'a final profile-stage interruption aborts finalization'
);
select is((select count(*)::integer from public.weekly_plan_versions where effective_from = date '2026-09-13'), 0, 'profile-stage interruption rolls back the plan and all prior stages');

select set_config('trackme.test_fail_stage', '', true);
select lives_ok(
  $$select public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"items":[{"clientId":"area","kind":"area","name":"Onboard area","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","kind":"subtask","parentClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
    date '2026-09-13'
  )$$,
  'a valid onboarding draft finalizes after interrupted attempts'
);
select is((select count(*)::integer from public.focus_items), 2, 'finalization creates exactly one area and one subtask');
select is((select count(*)::integer from public.checklist_templates), 2, 'finalization creates exactly one checklist per item');
select is((select count(*)::integer from public.weekly_plan_entries), 4, 'finalization preserves every per-weekday target');
select ok((select onboarding_completed_at is not null from public.profiles), 'finalization marks onboarding complete');
select ok((select onboarding_draft is null from public.profiles), 'finalization clears the persisted draft');
create temporary table finalized_onboarding_ids as select id from public.focus_items order by id;
select is(
  public.finalize_onboarding(
    '{"language":"en","timezone":"Africa/Cairo","weekStart":6,"items":[{"clientId":"area","kind":"area","name":"Onboard area","checklist":["Review"],"weekdays":[1,3],"target":"120"},{"clientId":"child","kind":"subtask","parentClientId":"area","name":"Onboard child","checklist":["Read"],"weekdays":[1,3],"target":"15"}]}'::jsonb,
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

select * from finish();
rollback;
