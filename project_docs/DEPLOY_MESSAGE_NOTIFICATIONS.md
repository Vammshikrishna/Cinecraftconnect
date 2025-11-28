# Quick Deployment Guide - Message Notifications

## 🚀 Apply the Migration

Run this command to enable message notifications:

```bash
supabase db push
```

Or manually execute in Supabase Studio:
1. Go to SQL Editor
2. Open: `supabase/migrations/20251226000000_add_message_notifications.sql`
3. Click "Run"

## ✅ What This Does

1. **Creates notification triggers** for:
   - Discussion room messages (`room_messages`)
   - Project messages (`project_messages`)

2. **Adds database functions:**
   - `notify_new_room_message()` - Creates notifications for room members
   - `notify_new_project_message()` - Creates notifications for project members

3. **Adds database column:**
   - `trigger_user_id` to notifications table (who caused the notification)

4. **Adds indexes** for better performance

## 📋 After Migration

### Frontend (Already Updated):
- ✅ NotificationsDropdown filters out `new_message` type
- ✅ MessageSquare icon shows unread indicator
- ✅ Bell icon shows other notifications only

### Test It:
1. Have two users join a discussion room
2. User A sends a message
3. User B should see:
   - 💬 Red dot on MessageSquare icon
   - 🔔 No notification in Bell dropdown (correct!)

## 🎯 Expected Behavior

### When Message Sent:
- ✅ Notification created in database
- ✅ MessageSquare icon shows red dot
- ❌ Bell icon does NOT show it (filtered out)

### When Follower/Invite:
- ✅ Notification created in database
- ✅ Bell icon shows it
- ❌ MessageSquare icon does NOT show it

## 📊 Summary

**Migration:** `20251226000000_add_message_notifications.sql`
**Frontend:** `NotificationsDropdown.tsx` (already updated)
**Result:** Clean separation between message and other notifications

Ready to deploy! 🎉
