
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_support_ticket_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_ticket_message_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_waitlist_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_incident_opened() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_incident_resolved() FROM PUBLIC, anon, authenticated;
