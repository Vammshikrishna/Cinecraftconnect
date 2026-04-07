# <img src="https://storage.googleapis.com/gpt-engineer-file-uploads/zdztktSz7DguBhd7OcwRyev7unL2/uploads/1762323700588-Playful Collage Logo - CineCraft Network (1).png" width="48" height="48" valign="middle"> CineCraft Connect

**A hybrid social and professional platform built for the entire entertainment ecosystem—including Movies, TV Series, YouTube, and Digital Content Creators.**

---

CineCraft Connect is a high-fidelity, all-in-one ecosystem designed to bridge the gap between social networking, professional collaboration, and industry-specific commerce. From independent filmmakers and YouTube creators to major TV production houses, CineCraft Connect provides the tools needed to discover talent, manage productions, and trade equipment in a premium, glassmorphic digital environment.

---

## ✨ Key Features

### 🎬 Cinematic Social Core
- **Craft-Specific Profiles**: Tailored profiles for 24+ industry crafts (Directing, Cinematography, Sound Design, etc.).
- **Interactive Feed**: Share updates, behind-the-scenes content, and industry news.
- **Rich Connections**: Build a professional network and manage industry relationships.
- **Enhanced Notifications**: Real-time updates for likes, comments, connections, and system alerts.

### 💼 Production Workspace & Collaboration
- **Production Wizard**: A structured environment for managing film projects from pre-pro to post.
- **Private Discussion Rooms**: Secure, real-time collaboration spaces for departments and production teams.
- **Budget & Resource Management**: Track project expenses and allocate resources efficiently.
- **Call Sheets & Legal Docs**: Integrated tools for generating call sheets and managing industry-standard legal documents.
- **File Management**: Secure cloud storage for scripts, storyboards, and production assets.

### 🛠️ Talent & Opportunity Marketplace
- **Job Board**: Post and apply for industry-specific opportunities with professional tracking.
- **Company Pages**: Official presence for studios, agencies, and production houses.
- **Candidate Discovery**: Search and filter talent by craft, experience level, and location.

### 🛒 Equipment & Service Exchange
- **Rental Marketplace**: List and rent professional equipment with a built-in booking system.
- **Vendor Discovery**: Connect with catering, logistics, and specialized service providers.
- **Booking & Availability**: Interactive calendars to manage equipment rentals and service schedules.
- **Trusted Reviews**: System-wide ratings and reviews for equipment and professional services.

### 📞 Premium Communication
- **Real-time Messaging**: Direct messaging with reactions, replies, and presence indicators.
- **Video & Audio Calls**: High-quality integrated calls powered by LiveKit and Daily.co.
- **Presence Tracking**: See when your collaborators are online and active.

---

## 🚀 Tech Stack

### Frontend
- **Framework**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/latest)

### Backend & Infrastructure
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + GoTrue)
- **Real-time**: Supabase Realtime + [LiveKit](https://livekit.io/)
- **Storage**: Supabase Storage
- **Functions**: Supabase Edge Functions

### Mobile & Cross-Platform
- **Bridge**: [Capacitor](https://capacitorjs.com/) for native Android and iOS support.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development)

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Vammshikrishna/Cinecraftconnect.git
    cd Cinecraftconnect
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Set up environment variables**:
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your-project-url
    VITE_SUPABASE_ANON_KEY=your-anon-key
    ```

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

---

## 📱 Mobile Support
CineCraft Connect is built to be mobile-first using Capacitor. To run on mobile:
```bash
# Add Android or iOS platform
npx cap add android
npx cap add ios

# Sync the web bundle
npm run build
npx cap copy

# Open in IDE (Android Studio or Xcode)
npx cap open android
```

---

## 🎨 Design Philosophy
The platform utilizes a **Premium Glassmorphic Design System**. This involves:
- **Depth & Translucency**: High-quality blur effects and subtle borders.
- **Dynamic Themes**: Carefully curated dark and light modes optimized for cinematic content.
- **Information Density**: Clean, professional layouts that present complex metadata without clutter.

---

## ⚖️ License
This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ for the cinematic community by [CineCraft Connect](https://cinecraftconnect.com).
