-- Adds ChatMessage to the `supabase_realtime` publication so Postgres
-- change events (INSERT on ChatMessage) are actually pushed to Realtime
-- subscribers. Without this, supabase.channel(...).on("postgres_changes",
-- ...) connects fine and logs SUBSCRIBED, but no change events ever
-- arrive — this was the root cause behind the "SUBSCRIBED but no live
-- message" symptom referenced in ChatPanel.tsx.
--
-- Two guards, for two different reasons:
--   1. The publication itself may not exist at all — Prisma's shadow
--      database (used to validate migrations during `prisma migrate dev`)
--      is a plain, empty Postgres instance, not a real Supabase project,
--      so `supabase_realtime` was never created there. Same for any local
--      / non-Supabase Postgres. In that case this migration should just
--      be a clean no-op instead of erroring `migrate dev` out.
--   2. Even where the publication exists, ChatMessage may already be in
--      it (e.g. added by hand via Supabase Studio on an existing
--      environment) — ALTER PUBLICATION ... ADD TABLE has no IF NOT
--      EXISTS form, so re-adding it unguarded would error instead of
--      being a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ChatMessage'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "ChatMessage";
    END IF;
  END IF;
END $$;