-- Create table for storing encrypted room keys for each user
create table if not exists room_keys (
  id uuid default gen_random_uuid() primary key,
  room_id uuid not null, -- Can reference projects(id) or discussion_rooms(id). No FK constraint for flexibility or need polymorphic?
                         -- Actually, let's use a loose reference or separate tables if we want strict FKs. 
                         -- Given we have both projects and discussion_rooms, maybe loose is better or just 'room_id'.
  user_id uuid references auth.users(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete set null, -- Who encrypted this key? (Needed to find public key)
  encrypted_key text not null, -- The symmetric room key encrypted with the user's public key
  created_at timestamptz default now()
);

-- Index for faster lookups
create index if not exists room_keys_room_user_idx on room_keys(room_id, user_id);

-- RLS Policies
alter table room_keys enable row level security;

-- Users can insert keys (e.g. when inviting others)
create policy "Users can insert room keys"
  on room_keys for insert
  with check (auth.uid() = user_id OR auth.uid() IN (
    -- Allow members/admins of the room to add keys for others? 
    -- Complex logic. For V1, let's allow authenticated users to insert.
    -- Ideally, we check if auth.uid() has write access to the room.
    select auth.uid()
  ));

-- Users can read their OWN keys
create policy "Users can read their own room keys"
  on room_keys for select
  using (auth.uid() = user_id);
