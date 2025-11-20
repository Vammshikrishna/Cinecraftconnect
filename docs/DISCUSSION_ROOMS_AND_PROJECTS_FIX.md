# Discussion Rooms and Projects Features - Issue Analysis and Fix

## Issues Identified

### 1. **Discussion Rooms Feature - Missing Database Components**

#### Missing `room_messages` Table
- **Problem**: The `DiscussionChatInterface.tsx` component tries to query `room_messages` table which doesn't exist
- **Location**: Lines 55, 90, 106 in `src/components/discussions/DiscussionChatInterface.tsx`
- **Impact**: Users cannot send or view messages in discussion rooms
- **Error**: Database query fails with "relation 'room_messages' does not exist"

#### Missing `create_discussion_room_with_creator` RPC Function
- **Problem**: The `CreateRoomModal` component calls an RPC function that doesn't exist
- **Location**: Line 290 in `src/pages/DiscussionRooms.tsx`
- **Impact**: Users cannot create new discussion rooms
- **Error**: RPC call fails with "function does not exist"

#### Incomplete `discussion_rooms` Schema
- **Problem**: The table has `name` column but the app expects `title` column
- **Problem**: Missing `room_type` column that the app uses
- **Location**: Multiple files query for `title` and `room_type` fields
- **Impact**: Data mismatch between schema and application code

### 2. **Projects Feature - Schema Compatibility**

The projects feature uses `project_spaces` table which exists, but there are several integration issues:

#### Project-Linked Discussion Rooms
- **Problem**: Projects can have associated discussion rooms, but `discussion_rooms` table lacks `project_id` column
- **Location**: Line 49 in `src/pages/ProjectSpacePage.tsx`
- **Impact**: Project collaboration spaces cannot be linked to projects
- **Error**: Cannot query for discussion rooms by project_id

#### Missing `projects` Table Reference
- **Problem**: `ProjectSpacePage.tsx` queries a `projects` table that may not exist
- **Location**: Line 34 in `src/pages/ProjectSpacePage.tsx`
- **Note**: The app uses `project_spaces` table, but some components reference `projects`
- **Impact**: Project space pages may fail to load

#### Shared Messaging Infrastructure
- **Problem**: Both discussion rooms and project spaces use `room_messages` table
- **Design**: This is intentional - projects with discussion rooms share the messaging infrastructure
- **Requirement**: RLS policies must support both standalone rooms and project-linked rooms

## Solution Implemented

Created migration file: `20250120000004_fix_discussion_rooms_and_projects.sql`

### What the Migration Does:

1. **Adds Missing Columns to `discussion_rooms`**
   - Adds `title` column (required by the app)
   - Adds `room_type` column (required by the app)
   - Adds `project_id` column (links discussion rooms to projects)
   - Migrates existing `name` values to `title` for backward compatibility
   - Creates index on `project_id` for efficient lookups

2. **Creates `room_messages` Table**
   - Stores all chat messages for both discussion rooms and project spaces
   - Includes fields: `id`, `room_id`, `user_id`, `content`, `created_at`, `priority`, `visibility_role`
   - Properly references `discussion_rooms` and `auth.users` with CASCADE delete

3. **Implements Enhanced Row Level Security (RLS) for Messages**
   - Users can view messages in rooms they're members of
   - Users can view messages in public rooms
   - **NEW**: Users can view messages in project-linked rooms if they're project members
   - Users can only insert messages as themselves
   - **NEW**: Project members can send messages in project-linked rooms
   - Users can delete their own messages

4. **Creates `create_discussion_room_with_creator` Function**
   - Creates a new discussion room
   - Automatically adds the creator as the first member
   - Sets initial member count to 1
   - Returns the new room ID

5. **Adds Triggers for Member Count**
   - Automatically increments `member_count` when users join
   - Automatically decrements `member_count` when users leave
   - Ensures count never goes below 0

6. **Performance Optimizations**
   - Adds indexes on frequently queried columns
   - Indexes on `room_id`, `created_at`, `user_id`, `category_id`

7. **Seeds Default Categories**
   - Adds common film industry categories
   - Categories: General, Cinematography, Directing, Production, etc.

## How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)
```bash
# Reset the database and apply all migrations
npx supabase db reset

# Or push just the new migration
npx supabase db push
```

### Option 2: Manual Application
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/20250120000004_fix_discussion_rooms_and_projects.sql`
4. Paste and execute in the SQL Editor

## Verification Steps

After applying the migration, verify the fixes:

### 1. Test Discussion Rooms
- [ ] Navigate to Discussion Rooms page
- [ ] Click "Create Room" button
- [ ] Fill in room details and create a room
- [ ] Join the room and send a message
- [ ] Verify messages appear in real-time

### 2. Test Projects
- [ ] Navigate to Projects page
- [ ] Verify projects load correctly
- [ ] Create a new project
- [ ] Bookmark a project
- [ ] Filter projects by status, genre, or role

### 3. Check Database
```sql
-- Verify room_messages table exists
SELECT * FROM public.room_messages LIMIT 1;

-- Verify discussion_rooms has new columns
SELECT title, room_type FROM public.discussion_rooms LIMIT 1;

-- Verify the RPC function exists
SELECT proname FROM pg_proc WHERE proname = 'create_discussion_room_with_creator';
```

## Expected Behavior After Fix

### Discussion Rooms
✅ Users can create new discussion rooms
✅ Users can join public rooms
✅ Users can send and receive messages in real-time
✅ Member count updates automatically
✅ Room categories are available for selection

### Projects
✅ Projects load without errors
✅ Project creation works correctly
✅ Bookmarking functionality works
✅ Filtering and searching work properly

## Related Files

### Frontend Components
- `src/pages/DiscussionRooms.tsx` - Main discussion rooms page
- `src/components/discussions/DiscussionChatInterface.tsx` - Chat interface
- `src/pages/Projects.tsx` - Main projects page
- `src/components/projects/ProjectCreationModal.tsx` - Project creation

### Database Migrations
- `20240731000011_idempotent_discussion_feature.sql` - Initial discussion rooms setup
- `20240731000012_add_project_space_details.sql` - Project spaces enhancements
- `20250120000004_fix_discussion_rooms_and_projects.sql` - **This fix**

## Notes

- The migration is idempotent - it can be run multiple times safely
- All changes use `IF NOT EXISTS` or `DROP IF EXISTS` to prevent errors
- RLS policies ensure proper data security
- Indexes improve query performance for large datasets
