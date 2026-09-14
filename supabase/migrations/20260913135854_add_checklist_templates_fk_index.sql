create index checklist_templates_item_owner_idx
  on public.checklist_templates (focus_item_id, user_id);
