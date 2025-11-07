      CREATE TABLE conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
          participant_a UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          participant_b UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          CONSTRAINT unique_conversation UNIQUE (participant_a, participant_b),
          CONSTRAINT check_participant_order CHECK (participant_a < participant_b)
      );
      
      CREATE TABLE messages (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
         conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
         sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
         content TEXT NOT NULL,
         is_read BOOLEAN DEFAULT false
     );
     
     ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
     ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
     
     CREATE POLICY "Participants can view conversations" ON conversations
     FOR SELECT USING (
         auth.uid() = participant_a OR auth.uid() = participant_b
     );
     
     CREATE POLICY "Participants can create conversations" ON conversations
     FOR INSERT WITH CHECK (
         auth.uid() = participant_a OR auth.uid() = participant_b
     );
     
     CREATE POLICY "Participants can view messages" ON messages
     FOR SELECT USING (
         conversation_id IN (SELECT id FROM conversations WHERE auth.uid() = participant_a OR auth.uid() = participant_b)
     );
     
     CREATE POLICY "Participants can send messages" ON messages
     FOR INSERT WITH CHECK (
         sender_id = auth.uid() AND
         conversation_id IN (SELECT id FROM conversations WHERE auth.uid() = participant_a OR auth.uid() = participant_b)
     );
-- Function to get or create a conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_a UUID;
    v_participant_b UUID;
BEGIN
    -- Enforce a canonical order for participants to prevent duplicate conversations
    IF p_user_id_1 < p_user_id_2 THEN
        v_participant_a := p_user_id_1;
        v_participant_b := p_user_id_2;
    ELSE
        v_participant_a := p_user_id_2;
        v_participant_b := p_user_id_1;
    END IF;

    -- Try to find an existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE participant_a = v_participant_a AND participant_b = v_participant_b
    LIMIT 1;

    -- If not found, create a new one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (participant_a, participant_b)
        VALUES (v_participant_a, v_participant_b)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;
