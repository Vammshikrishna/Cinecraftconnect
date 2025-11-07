      CREATE TABLE shares (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          UNIQUE (post_id, user_id)
      );
      
      ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view shares" ON shares
      FOR SELECT USING (true);
      
      CREATE POLICY "Users can create shares" ON shares
      FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete their shares" ON shares
      FOR DELETE USING (auth.uid() = user_id);
