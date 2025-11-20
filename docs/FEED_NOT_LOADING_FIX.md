# Feed Not Loading - Issue Analysis and Fix

## Problem

The feed page is not loading because the `FeedTab` component is trying to query a `craft` column from the `profiles` table that doesn't exist.

### Error Location
**File**: `src/components/feed/FeedTab.tsx`  
**Line**: 83

```typescript
.select(`
  *,
  profiles:author_id (
    id,
    full_name,
    username,
    avatar_url,
    craft  // ❌ This column doesn't exist
  )
`)
```

### Root Cause
The `profiles` table was created with these columns:
- `id`
- `updated_at`
- `username`
- `avatar_url`
- `website`
- `about_me`
- `experience`
- `instagram_url`
- `youtube_url`
- `full_name` (added in migration 20250120000003)

But it's **missing** the `craft` column that the feed expects.

## Solution

Created migration: `20250120000005_add_craft_to_profiles.sql`

### What It Does
1. Adds `craft` column to `profiles` table
2. Creates an index on `craft` for better query performance
3. Adds documentation comment

### How to Apply

**Via Supabase Dashboard:**
1. Go to SQL Editor
2. Copy and paste the contents of:
   ```
   supabase/migrations/20250120000005_add_craft_to_profiles.sql
   ```
3. Click Run

**SQL to Execute:**
```sql
-- Add craft column to profiles table for user's profession/role
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS craft text;

-- Add index for craft column for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_craft ON public.profiles(craft);

-- Add comment
COMMENT ON COLUMN public.profiles.craft IS 'User''s profession or role in the film industry (e.g., Director, Cinematographer, Editor)';
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check if craft column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'craft';

-- Should return:
-- column_name | data_type
-- craft       | text
```

## Expected Behavior After Fix

✅ Feed page loads without errors  
✅ Posts display with author information  
✅ Users can create new posts  
✅ Real-time updates work  
✅ Craft filtering works (if implemented)

## Additional Notes

The `craft` column stores the user's profession or role in the film industry, such as:
- Director
- Cinematographer
- Editor
- Producer
- Sound Designer
- Visual Effects Artist
- etc.

This allows the feed to display what role each person has, making it easier to connect with professionals in specific crafts.

## Related Files

- `src/components/feed/FeedTab.tsx` - Uses the craft column
- `src/components/feed/CraftFilters.tsx` - May use craft for filtering
- `supabase/migrations/20240101000000_init.sql` - Original profiles table creation
- `supabase/migrations/20250120000003_add_full_name_to_profiles.sql` - Previous profiles update
- `supabase/migrations/20250120000005_add_craft_to_profiles.sql` - **This fix**
