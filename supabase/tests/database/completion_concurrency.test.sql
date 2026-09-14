create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

drop trigger if exists delay_concurrent_completion on public.completion_actions;
drop function if exists private.delay_concurrent_completion_test();
create function private.delay_concurrent_completion_test()
returns trigger language plpgsql as $$
begin
  if new.user_id = '34000000-0000-0000-0000-000000000001'::uuid then
    perform pg_sleep(1);
  end if;
  return new;
end;
$$;
create trigger delay_concurrent_completion before insert on public.completion_actions
for each row execute function private.delay_concurrent_completion_test();

select no_plan();
select lives_ok($query$select dblink_connect('race_one', 'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres')$query$, 'first concurrent database session connects');
select lives_ok($query$select dblink_connect('race_two', 'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres')$query$, 'second concurrent database session connects');

select lives_ok($setup$
select dblink_exec('race_one', $$
  reset role;
  delete from auth.users where id = '34000000-0000-0000-0000-000000000001';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', '34000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'race@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''
  );
  insert into public.focus_items (id, user_id, kind, name)
  values ('34000000-0000-0000-0000-000000000011', '34000000-0000-0000-0000-000000000001', 'area', 'Race area');
  insert into public.checklist_templates (id, user_id, focus_item_id, label, effective_from)
  values ('34000000-0000-0000-0000-000000000021', '34000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000011', 'Race step', date '2026-09-01');
  insert into public.weekly_plan_versions (id, user_id, effective_from)
  values ('34000000-0000-0000-0000-000000000031', '34000000-0000-0000-0000-000000000001', date '2026-09-01');
  insert into public.weekly_plan_entries (user_id, weekly_plan_version_id, focus_item_id, weekday, target_minutes)
  values ('34000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000031', '34000000-0000-0000-0000-000000000011', 0, 60);
  set session role authenticated;
  set request.jwt.claim.sub = '34000000-0000-0000-0000-000000000001';
$$)
$setup$, 'concurrency fixture is created');
select lives_ok($setup$
select dblink_exec('race_two', $$
  set session role authenticated;
  set request.jwt.claim.sub = '34000000-0000-0000-0000-000000000001';
$$)
$setup$, 'second session receives the same authenticated identity');

select ok(dblink_send_query('race_one', $$select (public.complete_item('34000000-0000-0000-0000-000000000011', date '2026-09-13', 'same-request')).id::text$$) = 1, 'first concurrent completion starts');
select ok(dblink_send_query('race_two', $$select (public.complete_item('34000000-0000-0000-0000-000000000011', date '2026-09-13', 'same-request')).id::text$$) = 1, 'second concurrent completion starts');

create temporary table race_result_one as
select * from dblink_get_result('race_one') as result(id text);
create temporary table race_result_two as
select * from dblink_get_result('race_two') as result(id text);
select is((select count(*)::integer from dblink_get_result('race_one') as result(id text)), 0, 'first concurrent result is fully consumed');
select is((select count(*)::integer from dblink_get_result('race_two') as result(id text)), 0, 'second concurrent result is fully consumed');

select is((select id from race_result_one), (select id from race_result_two), 'concurrent retries return the same completion action');
select is(
  (select action_count from dblink('race_one', $$select count(*)::integer from public.completion_actions where idempotency_key = 'same-request'$$) as result(action_count integer)),
  1,
  'concurrent completion creates one action'
);
select is(
  (select entry_count from dblink('race_one', $$select count(*)::integer from public.time_entries where completion_action_id is not null$$) as result(entry_count integer)),
  1,
  'concurrent completion creates one fill entry'
);
select is(
  (select completion_count from dblink('race_one', $$select count(*)::integer from public.daily_checklist_completions where completion_action_id is not null$$) as result(completion_count integer)),
  1,
  'concurrent completion creates one automatic checklist completion'
);

select lives_ok($cleanup$select dblink_exec('race_one', $$reset role; delete from auth.users where id = '34000000-0000-0000-0000-000000000001'$$)$cleanup$, 'concurrency fixture is removed');
select lives_ok($cleanup$select dblink_disconnect('race_one')$cleanup$, 'first concurrent database session disconnects');
select lives_ok($cleanup$select dblink_disconnect('race_two')$cleanup$, 'second concurrent database session disconnects');
drop trigger delay_concurrent_completion on public.completion_actions;
drop function private.delay_concurrent_completion_test();
drop extension dblink;

select * from finish();
