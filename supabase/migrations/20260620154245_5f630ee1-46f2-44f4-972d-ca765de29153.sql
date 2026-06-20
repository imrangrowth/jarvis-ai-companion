
-- Pillar 1: Identity
CREATE TABLE IF NOT EXISTS public.jarvis_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.jarvis_identity TO service_role;
ALTER TABLE public.jarvis_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only identity" ON public.jarvis_identity FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_jarvis_identity_user ON public.jarvis_identity(user_id);

-- Pillar 3: Relationships
CREATE TABLE IF NOT EXISTS public.jarvis_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  relationship_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'contact',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  interaction_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, relationship_id)
);
GRANT ALL ON public.jarvis_relationships TO service_role;
ALTER TABLE public.jarvis_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only relationships" ON public.jarvis_relationships FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_jarvis_rel_user ON public.jarvis_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_rel_type ON public.jarvis_relationships(type);

-- Pillar 2: Goals — augment
ALTER TABLE public.jarvis_goals
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS secondary_goals jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS continuous_goals jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT now();
ALTER TABLE public.jarvis_goals ALTER COLUMN goal_name DROP NOT NULL;

-- Pillar 4: Knowledge — augment
ALTER TABLE public.jarvis_knowledge
  ADD COLUMN IF NOT EXISTS knowledge_id text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS last_accessed timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_jarvis_know_domain ON public.jarvis_knowledge(domain);
