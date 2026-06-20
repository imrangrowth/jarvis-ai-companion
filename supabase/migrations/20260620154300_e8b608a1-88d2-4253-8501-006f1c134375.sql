
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('jarvis_conversations','jarvis_actions','jarvis_knowledge','jarvis_goals','jarvis_patterns','jarvis_mistakes','jarvis_decision_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

CREATE POLICY "service role only conversations" ON public.jarvis_conversations FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only actions" ON public.jarvis_actions FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only knowledge" ON public.jarvis_knowledge FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only goals" ON public.jarvis_goals FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only patterns" ON public.jarvis_patterns FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only mistakes" ON public.jarvis_mistakes FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service role only decisions" ON public.jarvis_decision_history FOR ALL USING (false) WITH CHECK (false);
