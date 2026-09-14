create function public.maintain_focus_item_checklist(
  p_item_id uuid,
  p_operations jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_operation jsonb;
  v_kind text;
  v_step_id uuid;
  v_label text;
  v_position integer;
  v_effective_from date;
  v_existing public.checklist_templates%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_operations is null or jsonb_typeof(p_operations) <> 'array' or jsonb_array_length(p_operations) = 0 then
    raise exception using errcode = '22023', message = 'at least one checklist operation is required';
  end if;

  perform 1
  from public.focus_items as item
  where item.id = p_item_id and item.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'focus item not found or not owned by caller';
  end if;

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    v_kind := v_operation ->> 'operation';
    begin
      v_effective_from := (v_operation ->> 'effectiveFrom')::date;
    exception when others then
      raise exception using errcode = '22023', message = 'a valid effective date is required';
    end;

    if v_kind = 'add' then
      v_label := v_operation ->> 'label';
      v_position := (v_operation ->> 'position')::integer;
      if v_label is null or btrim(v_label) = '' or length(btrim(v_label)) > 200 or v_position < 0 then
        raise exception using errcode = '22023', message = 'invalid checklist step';
      end if;
      insert into public.checklist_templates (
        user_id, focus_item_id, label, position, effective_from
      ) values (
        v_user_id, p_item_id, v_label, v_position, v_effective_from
      );
      continue;
    end if;

    if v_kind not in ('revise', 'retire') then
      raise exception using errcode = '22023', message = 'unsupported checklist operation';
    end if;

    begin
      v_step_id := (v_operation ->> 'id')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'a valid checklist step id is required';
    end;

    select template.* into v_existing
    from public.checklist_templates as template
    where template.id = v_step_id
      and template.focus_item_id = p_item_id
      and template.user_id = v_user_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'checklist step not found or not owned by caller';
    end if;
    if v_effective_from < v_existing.effective_from
      or (v_existing.effective_to is not null and v_effective_from > v_existing.effective_to) then
      raise exception using errcode = '22023', message = 'effective date must fall within the checklist version';
    end if;
    if exists (
      select 1 from public.daily_checklist_completions as completion
      where completion.user_id = v_user_id
        and completion.checklist_template_id = v_step_id
        and completion.local_date >= v_effective_from
    ) then
      raise exception using errcode = '22023', message = 'effective date must be after existing checklist results';
    end if;

    if v_kind = 'retire' then
      if v_effective_from = v_existing.effective_from then
        delete from public.checklist_templates
        where id = v_step_id and user_id = v_user_id;
      else
        update public.checklist_templates
        set effective_to = v_effective_from - 1
        where id = v_step_id and user_id = v_user_id;
      end if;
      continue;
    end if;

    v_label := v_operation ->> 'label';
    v_position := (v_operation ->> 'position')::integer;
    if v_label is null or btrim(v_label) = '' or length(btrim(v_label)) > 200 or v_position < 0 then
      raise exception using errcode = '22023', message = 'invalid checklist revision';
    end if;

    if v_effective_from = v_existing.effective_from then
      update public.checklist_templates
      set label = v_label, position = v_position
      where id = v_step_id and user_id = v_user_id;
    else
      update public.checklist_templates
      set effective_to = v_effective_from - 1
      where id = v_step_id and user_id = v_user_id;
      insert into public.checklist_templates (
        user_id, focus_item_id, label, position, effective_from, effective_to
      ) values (
        v_user_id, p_item_id, v_label, v_position, v_effective_from, v_existing.effective_to
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.maintain_focus_item_checklist(uuid, jsonb) from public, anon;
grant execute on function public.maintain_focus_item_checklist(uuid, jsonb) to authenticated;
