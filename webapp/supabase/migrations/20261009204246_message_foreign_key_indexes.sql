-- Cover the foreign keys identified by hosted advisors after the pilot repair.
-- These additive indexes preserve all messages and drafts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create index coach_messages_athlete_id_idx on public.coach_messages (athlete_id);
create index message_drafts_athlete_id_idx on public.message_drafts (athlete_id);
create index message_drafts_coach_id_idx on public.message_drafts (coach_id);
commit;
