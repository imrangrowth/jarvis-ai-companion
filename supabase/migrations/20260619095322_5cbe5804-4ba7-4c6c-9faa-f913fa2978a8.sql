
-- jarvis_conversations
CREATE TABLE public.jarvis_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_input TEXT NOT NULL,
  jarvis_response TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_conv_user_time ON public.jarvis_conversations(user_id, timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_conversations TO anon, authenticated;
GRANT ALL ON public.jarvis_conversations TO service_role;
ALTER TABLE public.jarvis_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_conversations FOR ALL USING (true) WITH CHECK (true);

-- jarvis_patterns
CREATE TABLE public.jarvis_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  frequency INT DEFAULT 1,
  confidence NUMERIC DEFAULT 0,
  action_taken TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_pat_user ON public.jarvis_patterns(user_id, frequency DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_patterns TO anon, authenticated;
GRANT ALL ON public.jarvis_patterns TO service_role;
ALTER TABLE public.jarvis_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_patterns FOR ALL USING (true) WITH CHECK (true);

-- jarvis_mistakes
CREATE TABLE public.jarvis_mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  mistake_description TEXT NOT NULL,
  context TEXT,
  correction TEXT,
  lesson_learned TEXT,
  learned BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_mist_user ON public.jarvis_mistakes(user_id, timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_mistakes TO anon, authenticated;
GRANT ALL ON public.jarvis_mistakes TO service_role;
ALTER TABLE public.jarvis_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_mistakes FOR ALL USING (true) WITH CHECK (true);

-- jarvis_goals
CREATE TABLE public.jarvis_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_name TEXT NOT NULL,
  priority INT DEFAULT 1,
  progress NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_goals_user_status ON public.jarvis_goals(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_goals TO anon, authenticated;
GRANT ALL ON public.jarvis_goals TO service_role;
ALTER TABLE public.jarvis_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_goals FOR ALL USING (true) WITH CHECK (true);

-- jarvis_knowledge
CREATE TABLE public.jarvis_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  category TEXT,
  learned_from_query BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_know_user_time ON public.jarvis_knowledge(user_id, timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_knowledge TO anon, authenticated;
GRANT ALL ON public.jarvis_knowledge TO service_role;
ALTER TABLE public.jarvis_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_knowledge FOR ALL USING (true) WITH CHECK (true);

-- jarvis_actions
CREATE TABLE public.jarvis_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  result TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_act_user ON public.jarvis_actions(user_id, timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_actions TO anon, authenticated;
GRANT ALL ON public.jarvis_actions TO service_role;
ALTER TABLE public.jarvis_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_actions FOR ALL USING (true) WITH CHECK (true);

-- jarvis_decision_history
CREATE TABLE public.jarvis_decision_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_input TEXT NOT NULL,
  classification TEXT,
  agent_selected TEXT,
  decision_data JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_dec_user ON public.jarvis_decision_history(user_id, timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_decision_history TO anon, authenticated;
GRANT ALL ON public.jarvis_decision_history TO service_role;
ALTER TABLE public.jarvis_decision_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.jarvis_decision_history FOR ALL USING (true) WITH CHECK (true);
