# Complete Chat & Messaging System Map

## 📍 All Chat Locations in ReelSphere Connect

### 1. 💬 **Direct Messages** (1-on-1 Chat)
**Route:** `/chats` or `/messages`  
**Database Table:** `direct_messages`  
**Component:** `src/pages/ChatsList.tsx`  
**Features:**
- Private 1-on-1 conversations between users
- Accessed from user profiles
- Real-time messaging
- Message history

**How to Access:**
- Click the MessageSquare icon in navbar → "View all messages"
- Navigate to `/chats` directly
- Click "Message" button on a user's profile

---

### 2. 🗨️ **Discussion Room Chat**
**Route:** `/discussion-rooms/:roomId`  
**Database Table:** `room_messages`  
**Component:** `src/components/discussions/DiscussionChatInterface.tsx`  
**Features:**
- Group chat for discussion room members
- Public or private rooms
- Multiple members can chat
- Real-time updates

**How to Access:**
- Go to `/discussion-rooms`
- Click on any room card → "Join Chat" button
- Opens the discussion room with chat interface on the right

---

### 3. 🎬 **Project Space Chat**
**Route:** `/projects/:projectId/space`  
**Database Table:** `project_messages`  
**Component:** `src/components/calls/CallChatSidebar.tsx` (used in project space)  
**Features:**
- Team chat for project members
- Collaboration and coordination
- Real-time messaging
- Project-specific conversations

**How to Access:**
- Go to `/projects`
- Click on a project card
- Navigate to project space
- Chat sidebar appears on the right

---

### 4. 📞 **Video Call Chat** (During Calls)
**Route:** During active video calls  
**Database Table:** `project_messages` or `room_messages` (depending on call type)  
**Component:** `src/components/calls/CallChatSidebar.tsx`  
**Features:**
- Chat during video calls
- Side-by-side with video
- Share links and notes during calls

**How to Access:**
- Start a video call from discussion room or project
- Chat sidebar appears during the call

---

## 📊 Database Tables Summary

| Table | Purpose | Columns |
|-------|---------|---------|
| `direct_messages` | 1-on-1 chats | sender_id, receiver_id, content, created_at |
| `room_messages` | Discussion room chats | user_id, room_id, content, created_at |
| `project_messages` | Project space chats | sender_id, project_id, content, created_at |

---

## 🔗 Navigation Paths

### From Navbar:
```
Navbar → MessageSquare Icon → Dropdown → "View all messages" → /chats
```

### From Discussion Rooms:
```
Navbar → "Discussions" → /discussion-rooms → Select Room → Chat Interface
```

### From Projects:
```
Navbar → "Projects" → /projects → Select Project → /projects/:id/space → Chat Sidebar
```

### From User Profile:
```
Network/Profile → User Card → "Message" Button → /chats (filtered to that user)
```

---

## 🎯 Chat Components Breakdown

### Main Chat Components:

1. **`ChatsList.tsx`** (`/chats`)
   - Lists all direct message conversations
   - Shows recent messages
   - Click to open conversation

2. **`DiscussionChatInterface.tsx`** (Discussion Rooms)
   - Full chat interface for rooms
   - Message input
   - Message history
   - Member list

3. **`CallChatSidebar.tsx`** (Projects & Calls)
   - Sidebar chat during calls
   - Also used in project spaces
   - Compact design

---

## 🔔 Notification Integration

### Chat Icon (MessageSquare) Shows Unread For:
- ✅ Direct messages (`direct_messages`)
- ✅ Discussion room messages (`room_messages`)
- ⚠️ Project messages (needs to be added to `useUnreadMessages` hook)

### Bell Icon (Notifications) Will Show:
- ✅ New message notifications (after migration)
- ✅ Links directly to the chat location
- ✅ Shows sender name and preview

---

## 📱 Mobile Navigation

On mobile devices, chat is accessible via:
- Bottom navigation bar → MessageSquare icon → `/chats`
- Same routes as desktop

---

## 🔍 Quick Reference: Where to Find Each Chat Type

| Chat Type | URL Pattern | Example |
|-----------|-------------|---------|
| Direct Messages | `/chats` | `/chats` |
| Discussion Room | `/discussion-rooms/:roomId` | `/discussion-rooms/abc-123` |
| Project Chat | `/projects/:projectId/space` | `/projects/xyz-789/space` |
| Call Chat | During active call | N/A (overlay) |

---

## 🛠️ Related Hooks & Utilities

### Hooks:
- `useUnreadMessages()` - Tracks unread message status
- Real-time subscriptions in each chat component

### Services:
- Supabase real-time for live updates
- RLS policies for message privacy

---

## 🎨 UI Patterns

All chat interfaces follow similar patterns:
1. **Message List** - Scrollable history
2. **Input Area** - Text input + send button
3. **User Indicators** - Avatars, names, timestamps
4. **Real-time Updates** - New messages appear instantly

---

## 🔐 Privacy & Access Control

### Direct Messages:
- Only sender and receiver can see messages
- RLS policies enforce privacy

### Discussion Room Messages:
- Only room members can see messages
- Private rooms require invitation

### Project Messages:
- Only project members can see messages
- Private projects require invitation

---

## 📈 Future Enhancements

Potential additions:
- [ ] Message search across all chats
- [ ] Message reactions (emoji)
- [ ] File sharing in chats
- [ ] Voice messages
- [ ] Message threading
- [ ] @mentions with notifications
- [ ] Message editing/deletion
- [ ] Read receipts

---

## 🚀 Summary

**Total Chat Locations: 4**

1. **Direct Messages** - `/chats` - 1-on-1 private chats
2. **Discussion Rooms** - `/discussion-rooms/:id` - Group chats
3. **Project Spaces** - `/projects/:id/space` - Team collaboration
4. **Video Calls** - During calls - Real-time communication

All are accessible from the navbar and have real-time updates! 💬
