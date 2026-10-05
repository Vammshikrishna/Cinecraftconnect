-- PART E: run TOGETHER with deploying the new web + mobile builds (clients open the presence channel as private).
BEGIN;
-- The global presence channel was joinable with just the public anon key, which let anyone enumerate
-- which user ids are online. The clients now open it as a *private* channel; this policy only lets
-- signed-in users read/track presence on that one topic.
DROP POLICY IF EXISTS "authenticated can read global presence" ON realtime.messages;
CREATE POLICY "authenticated can read global presence" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.topic() = 'global-user-presence' AND extension = 'presence');

DROP POLICY IF EXISTS "authenticated can track global presence" ON realtime.messages;
CREATE POLICY "authenticated can track global presence" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (realtime.topic() = 'global-user-presence' AND extension = 'presence');
COMMIT;
