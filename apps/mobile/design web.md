# CineCraft Connect Web App - UI Design Specification

This document provides a comprehensive blueprint of the CineCraft Connect Web Application's UI design system, pages, layouts, and components. Use this document as the reference design sheet to implement matching user interfaces in your native mobile APK.

---

## 1. Core Web Design System (Styling System)

The web application is built on a clean, premium, single-color brand identity system inspired by modern apps (like Instagram) with glassmorphism overlays and micro-animations.

### A. Theme: Tangerine Dream
*   **Brand Primary Color:** `#FF4B33` (Tangerine Red-Orange - HSL `7 100% 60%`). Used for primary interactive components, active tabs, buttons, links, and accents.
*   **Secondary Color Accent:** `#FF6B3D` (Warm Orange - HSL `16 100% 66%`). Used for secondary buttons and accents.
*   **Borders & Outlines:** `#E5E7EB` (HSL `0 0% 90%` in Light Mode, `#262626` / HSL `0 0% 15%` in Dark Mode).
*   **Light Mode Background:** `#FFFFFF` (Pure white - HSL `0 0% 100%`).
*   **Dark Mode Background:** `#000000` (Pitch black - HSL `0 0% 0%`).
*   **Popover Surfaces:** `#FFFFFF` in Light Mode, `#0F0F0F` (HSL `0 0% 6%`) in Dark Mode.

### B. Typography & Fonts
*   **Primary Sans-Serif:** `'Work Sans'`, ui-sans-serif, system-ui (Instagram style).
    *   *Usage:* Body copy, form fields, subheaders, navigation labels.
    *   *Font Weights:* Regular (400), Medium (500), Semi-Bold (600), Bold (700).
*   **Serif Accent:** `'Lora'`, ui-serif, Georgia.
    *   *Usage:* Content headers, blog sections, quotes.
*   **Mono Space:** `'Inconsolata'`, monospace.
    *   *Usage:* Security settings, encryption key blocks, code snippets.

---

## 2. Reusable Layouts & Scaffolds

### A. Global Layout Structure
The web layout adapts between guest and authenticated states:
*   **Guest / Landing Navbar:** Thin, clean white header, brand logo on the left, links in the center, and dual `Login` / `Get Started` buttons on the right.
*   **Authenticated Navbar:**
    *   *Desktop:* Floating sticky header with search, notifications panel dropdown, and Profile/Settings menu.
    *   *Mobile Browser View:* Left/top branding menu with a floating bottom tab bar for primary pages and a "More" trigger overlay dropdown menu.

### B. Reusable UI Components
1.  **Cards (`Card`)**
    *   White background (dark mode uses pitch black), 1px solid light grey border, border-radius of `0.75rem` (`rounded-xl`), and very subtle shadow drop (`shadow-sm`).
2.  **Spinners (`LoadingSpinner` / `Spinner`)**
    *   Dual-ring circular layout colored in primary Tangerine (`#FF4B33`), with a pulsing text fallback.
3.  **Enhanced Skeletons (`EnhancedSkeleton`)**
    *   Shimmering placeholder cards mimicking text blocks, avatar circles, and media frames during async data loads.
4.  **Star Rating (`StarRating` & `MovieRating`)**
    *   Interactive rating widget using five star outlines that fill with brand color on selection. Allows decimal display for aggregated portfolio metrics.

---

## 3. Web Page Directory & Visual Layouts

The following pages are defined in the web app and must be replicated visually in the native APK:

### A. Authentication & Onboarding
1.  **Auth Page (`/auth` & `/register`)**
    *   *Visual Structure:* Centered auth card showing brand logo, inputs for email/password, and tabs for switching between Login and SignUp. Includes "Forgot Password" Magic Link triggers.
2.  **Complete Profile (`/complete-profile`)**
    *   *Visual Structure:* Multi-step onboarding setup wizard capturing profile picture, username choice, location, short bio, and craft options.

### B. Social Feed & Engagement
1.  **Home Feed (`/feed`)**
    *   *Visual Structure:* Infinite scroll stream of cards. Each card displays:
        *   User avatar, name, and timestamp.
        *   Text payload with optional formatted Markdown.
        *   Media attachment slider (image, video, carousel).
        *   Horizontal bar for Likes, Comments, Share, and Report.
2.  **Create Post (`/create`)**
    *   *Visual Structure:* Textarea overlay, media uploader container, location tags, category tags (e.g. Casting, Equipment, Blog), and a "Post" trigger.
3.  **Post Detail (`/post/:postId`)**
    *   *Visual Structure:* Expanded view of post details with scrollable comment hierarchy (nested comments) and input fields.

### C. Network & Talent
1.  **Talent Network (`/network`)**
    *   *Visual Structure:* Columns or grid cards of talent, segmented by:
        *   *Connections:* Mutual connection requests.
        *   *Follows:* User followers and following lists.
        *   *Suggestions:* AI suggestions based on shared craft types.
2.  **Profile & Public Profile (`/profile` & `/profile/:userId`)**
    *   *Visual Structure:* Background cover banner, profile photo card, username tag, verified user badge. Below:
        *   *Portfolio Grid:* Filterable showcase of photos, documents, and videos.
        *   *Availability Calendar:* Color-coded calendar showing available vs. booked dates.
        *   *Ratings & Reviews:* Production history scores.

### D. Discussion Rooms
1.  **Discussion Rooms (`/discussion-rooms`)**
    *   *Visual Structure:* Scrollable list of category tags. Below, a grid of cards showing room name, member count, description, and "Join" button.
2.  **Discussion Room Detail (`/discussion-rooms/:roomId`)**
    *   *Visual Structure:* Messaging console layout with room settings sidebar, participant list, and chat bubble logs.

### E. Collaborative Projects
1.  **Projects Directory (`/projects`)**
    *   *Visual Structure:* Cards showcasing project thumbnails, film loglines, active production statuses, and team vacancies.
2.  **Create Project (`/projects/create`)**
    *   *Visual Structure:* Multi-tab configuration forms capturing project timeline, crew requirements, and cover pictures.
3.  **Project Space (`/projects/:projectId/space`)**
    *   *Visual Structure:* A workspace containing:
        *   *Board (Tasks):* Kanban board displaying cards (To-Do, In-Progress, Done) representing tasks.
        *   *Files:* Asset manager showing list of screenplay draft uploads.
        *   *Call Sheets:* PDF schedule sheets for production shoot details.

### F. Job Board & Recruiter Portal
1.  **Jobs (`/jobs`)**
    *   *Visual Structure:* Dual list-detail view layout. Left: Scrollable job list. Right: Job description panel showing requirements, location, budget/payment status, and applicant count.
2.  **Recruiter Manage (`/jobs/manage`)**
    *   *Visual Structure:* Dashboard table containing job postings, listing applied crew, and giving status update triggers (e.g., Shortlisted, Auditioning, Declined).

### G. Equipment & Location Marketplace
1.  **Marketplace (`/marketplace`)**
    *   *Visual Structure:* Filter controls (Gear vs. Locations, distance radius, daily rental cost). Grid cards showing item imagery, specs, daily rate, and owner credentials.
2.  **Wishlist (`/marketplace/wishlist`)**
    *   *Visual Structure:* Grid view of saved listings, with buttons to share private links or copy shared wishlist tokens.

### H. Evaluating & Pitch Calls
1.  **Pitch Center (`/pitch`)**
    *   *Visual Structure:* Split views showing "Active Calls for Funding" and "My Pitch Submissions".
2.  **Submit Pitch (`/pitch/:pitchId/submit`)**
    *   *Visual Structure:* Multi-step wizard collecting film pitch decks, crew attachments, loglines, and budget breakdowns.
3.  **Evaluator Dashboard (`/pitch/submission/:id/review`)**
    *   *Visual Structure:* Split view. Left: Pitch Deck PDF renderer. Right: Evaluation form with rating sliders and comments.

### I. Messaging & Chat System
1.  **Messages inbox (`/messages`)**
    *   *Visual Structure:* Split screen layout. Left: Search bar and list of active chat threads. Right: Chat area showing scrollable text log, attachment options, and E2EE lock verification symbols.

### J. Settings Console (`/settings`)
*   *Visual Structure:* Left panel showing settings categories. Right panel displaying forms for:
    *   *Appearance:* Dark/Light/System theme toggles.
    *   *Security:* Password resets, MFA code configurations, active session tables.
    *   *Privacy:* Block lists, public search indexing options.
    *   *Notifications:* Email vs. Push preference checklists.
    *   *Accessibility:* Font sizing sliders and reader accessibility switches.
