
CREATE TABLE public.knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge TO anon;
GRANT SELECT, INSERT ON public.knowledge TO authenticated;
GRANT ALL ON public.knowledge TO service_role;

ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read knowledge"
  ON public.knowledge FOR SELECT
  TO anon, authenticated
  USING (true);

-- Inserts only via server functions using service role; no anon/authenticated insert policy.

CREATE INDEX knowledge_topic_idx ON public.knowledge USING gin (to_tsvector('english', topic || ' ' || content));
CREATE INDEX knowledge_created_idx ON public.knowledge (created_at DESC);
