begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rpc-one@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rpc-two@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.focus_items (id, user_id, kind, name) values
  ('33000000-0000-0000-0000-000000000011', '33000000-0000-0000-0000-000000000001', 'area', 'RPC one'),
  ('33000000-0000-0000-0000-000000000012', '33000000-0000-0000-0000-000000000002', 'area', 'RPC two');
insert into public.checklist_templates (id, user_id, focus_item_id, label, effective_from) values
  ('33000000-0000-0000-0000-000000000021', '33000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000011', 'RPC one step', date '2026-09-01'),
  ('33000000-0000-0000-0000-000000000022', '33000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000012', 'RPC two step', date '2026-09-01');
insert into public.weekly_plan_versions (id, user_id, effective_from) values
  ('33000000-0000-0000-0000-000000000031', '33000000-0000-0000-0000-000000000001', date '2026-09-01'),
  ('33000000-0000-0000-0000-000000000032', '33000000-0000-0000-0000-000000000002', date '2026-09-01');
insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes) values
  ('33000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000031', '33000000-0000-0000-0000-000000000011', 0, 60),
  ('33000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000032', '33000000-0000-0000-0000-000000000012', 0, 60);
insert into public.completion_actions (id, user_id, focus_item_id, local_date, idempotency_key, target_minutes, progress_minutes_before, filled_minutes) values
  ('33000000-0000-0000-0000-000000000041', '33000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000012', date '2026-09-13', 'other-action', 60, 0, 60);

create function private.fail_completion_test_stage()
returns trigger language plpgsql as $$
begin
  if current_setting('trackme.test_fail_completion_stage', true) = tg_argv[0] then
    raise exception 'induced completion % failure', tg_argv[0];
  end if;
  return coalesce(new, old);
end;
$$;
create trigger fail_complete_checklist before insert on public.daily_checklist_completions
for each row execute function private.fail_completion_test_stage('complete-checklist');
create trigger fail_undo_time before delete on public.time_entries
for each row execute function private.fail_completion_test_stage('undo-time');

select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select throws_like(
  $$select public.complete_item('33000000-0000-0000-0000-000000000012', date '2026-09-13', 'cross-user')$$,
  '%not found or not owned by caller%',
  'complete_item denies a cross-user focus item'
);
select throws_like(
  $$select public.undo_completion('33000000-0000-0000-0000-000000000041')$$,
  '%not found or not owned by caller%',
  'undo_completion denies a cross-user action'
);
select throws_like(
  $$select public.maintain_focus_item_checklist('33000000-0000-0000-0000-000000000012', '[{"operation":"add","label":"Forbidden","position":0,"effectiveFrom":"2026-09-13"}]'::jsonb)$$,
  '%not found or not owned by caller%',
  'checklist maintenance denies a cross-user focus item'
);

select set_config('trackme.test_fail_completion_stage', 'complete-checklist', true);
select throws_like(
  $$select public.complete_item('33000000-0000-0000-0000-000000000011', date '2026-09-13', 'rollback-complete')$$,
  '%induced completion complete-checklist failure%',
  'completion surfaces an induced late-stage failure'
);
select is((select count(*)::integer from public.completion_actions where idempotency_key = 'rollback-complete'), 0, 'failed completion rolls back its action');
select is((select count(*)::integer from public.time_entries where focus_item_id = '33000000-0000-0000-0000-000000000011'), 0, 'failed completion rolls back its fill entry');
select is((select count(*)::integer from public.daily_checklist_completions where checklist_template_id = '33000000-0000-0000-0000-000000000021'), 0, 'failed completion leaves no partial checklist state');

select set_config('trackme.test_fail_completion_stage', '', true);
create temporary table safe_completion as
select * from public.complete_item('33000000-0000-0000-0000-000000000011', date '2026-09-13', 'undo-rollback');
select is((select filled_minutes from safe_completion), 60, 'successful completion creates the expected fill before undo testing');

select set_config('trackme.test_fail_completion_stage', 'undo-time', true);
select throws_like(
  $$select public.undo_completion((select id from safe_completion))$$,
  '%induced completion undo-time failure%',
  'undo surfaces an induced failure after beginning cleanup'
);
select ok((select undone_at is null from public.completion_actions where id = (select id from safe_completion)), 'failed undo leaves the action active');
select is((select count(*)::integer from public.time_entries where completion_action_id = (select id from safe_completion)), 1, 'failed undo restores its completion-fill entry');
select is((select count(*)::integer from public.daily_checklist_completions where completion_action_id = (select id from safe_completion)), 1, 'failed undo restores its automatic checklist state');

select set_config('trackme.test_fail_completion_stage', '', true);
select ok(public.undo_completion((select id from safe_completion)), 'undo succeeds after the induced failure is removed');
select is(public.undo_completion((select id from safe_completion)), false, 'a repeated undo is idempotent');

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_like($$select public.complete_item('33000000-0000-0000-0000-000000000011', date '2026-09-13', 'anonymous')$$, '%authentication required%', 'complete_item requires authentication');
select throws_like($$select public.undo_completion('33000000-0000-0000-0000-000000000041')$$, '%authentication required%', 'undo_completion requires authentication');
select throws_like($$select public.maintain_focus_item_checklist('33000000-0000-0000-0000-000000000011', '[]'::jsonb)$$, '%authentication required%', 'checklist maintenance requires authentication');
select throws_like($$select public.finalize_onboarding('{}'::jsonb, date '2026-09-13')$$, '%authentication required%', 'finalize_onboarding requires authentication');

select * from finish();
rollback;
