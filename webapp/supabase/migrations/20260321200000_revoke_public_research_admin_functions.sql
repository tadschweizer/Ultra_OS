revoke execute on function public.admin_list_research_library_entries() from anon, authenticated;
revoke execute on function public.admin_upsert_research_library_entry(uuid, text, text, text, text, integer, date, text, text[], text, text, text, integer, integer, integer, boolean) from anon, authenticated;
revoke execute on function public.admin_delete_research_library_entry(uuid) from anon, authenticated;
