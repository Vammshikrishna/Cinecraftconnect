<div align="center">

<img src="assets/logo.png" width="96" height="96" alt="CineCraft Connect logo" />

# CineCraft Connect

**The unified workspace and professional network for film, TV, and creator productions.**

A centralized production ecosystem connecting creators, crews, and vendors across Web, iOS, and Android.

[![Access: Proprietary](https://img.shields.io/badge/Access-Proprietary-red.svg)](#intellectual-property)
[![Web](https://img.shields.io/badge/Web-React_18_%2B_Vite-61DAFB?logo=react&logoColor=black)](apps/web)
[![Mobile](https://img.shields.io/badge/Mobile-React_Native_%2B_Expo_52-black?logo=react&logoColor=61DAFB)](apps/mobile)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3FCF8E?logo=supabase&logoColor=white)](supabase)
[![Realtime](https://img.shields.io/badge/Realtime-LiveKit-FF4B33)](https://livekit.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

[Overview](#overview) • [Key Capabilities](#key-capabilities) • [Platform Architecture](#platform-architecture) • [Technology Stack](#technology-stack) • [Security & Privacy](#security--privacy)

</div>

---

## Overview

**CineCraft Connect** is an all-in-one platform built to streamline the entire lifecycle of creative media production. Designed for directors, cinematographers, editors, sound engineers, production houses, and digital creators, CineCraft consolidates talent discovery, production logistics, private real-time communication, and equipment commerce into a unified workspace.

---

## Key Capabilities

### 🎬 Production Workspaces
- **Department Spaces**: Dedicated collaborative hubs for directing, camera, lighting, sound, art, and post-production.
- **Pitch & Pre-Production**: Story pitch decks, script management, breakdown boards, and call sheet distribution.
- **Asset Hub**: Centralized, secure storage for footage, concept art, project documentation, and production notes.

### 👥 Talent & Creative Network
- **Craft-Specialized Profiles**: Portfolio showcases and verified credits tailored to specific industry roles (Directors, DPs, Editors, Sound Designers, etc.).
- **Discovery & Shortlists**: Searchable roster of talent with peer endorsements, ratings, and past production history.
- **Production Feeds & Media**: Departmental updates, project announcements, polls, and creative showreels.

### 💬 Private & Team Communications
- **Direct & Group Messaging**: Instant messaging with rich media previews, reactions, and threaded discussions.
- **Live Collaboration**: High-definition video conferencing, low-latency audio spaces, and screen sharing powered by LiveKit.
- **Confidentiality**: Client-side End-to-End Encryption (E2EE) ensuring sensitive discussions and scripts remain strictly confidential.

### 📦 Equipment & Marketplace
- **Gear Rental System**: Equipment listings with real-time availability calendars, insurance verification, and deposit management.
- **Job & Gig Board**: Production casting calls, crew openings, and direct hiring workflows.
- **Vendor Marketplace**: Directory of rental houses, post-production studios, catering, and equipment suppliers.

---

## Platform Architecture

CineCraft Connect is engineered as a modern, modular monorepo designed for high concurrency, cross-platform parity, and low-latency realtime synchronization:

```text
├── apps/
│   ├── web/               # Responsive web application (React 18, Vite, Tailwind CSS)
│   └── mobile/            # Native mobile client for iOS and Android (React Native, Expo)
│
├── packages/              # Core domain logic & shared services
│   ├── api/               # Data access abstraction & Supabase client bindings
│   ├── auth/              # Multi-factor authentication & session orchestration
│   ├── calling/           # WebRTC video/audio conferencing state machine
│   ├── core/              # Shared business rules & data models
│   ├── e2ee/              # Cryptographic key exchange & End-to-End Encryption
│   ├── messaging/         # Chat engine, socket sync, & cache layers
│   ├── notifications/     # Notification handlers & push payload helpers
│   ├── storage/           # Asset storage & signed URL handlers
│   └── validation/        # Schema validators & input sanitation (Zod)
│
└── supabase/
    ├── migrations/        # Relational schema, indexes & Row Level Security (RLS) policies
    └── functions/         # Distributed serverless Edge Functions
```

---

## Technology Stack

| Layer | Architecture & Technologies |
|---|---|
| **Web Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query |
| **Mobile Apps** | React Native 0.76, Expo 52, React Navigation, FlashList, Firebase Cloud Messaging |
| **Backend & Database** | PostgreSQL 15 via Supabase, Row Level Security (RLS), Realtime replication, Edge Functions |
| **Media & Realtime** | LiveKit WebRTC (low-latency audio/video streaming, screen sharing) |
| **Security & Cryptography** | Client-side E2EE, JWT authentication, zero-trust database policies |

---

## Security & Privacy

- **Row Level Security (RLS)**: Enforced across all PostgreSQL tables, ensuring zero unauthorized cross-tenant data access.
- **End-to-End Encryption**: Private production chats and sensitive room audio can be encrypted on-device.
- **Zero-Trust Access**: All edge operations require authenticated signatures; service-level secrets remain strictly server-side.

---

## Intellectual Property

**Copyright © CineCraft Connect. All rights reserved.**

This repository and its source code are proprietary and confidential. Unauthorized copying, cloning, distribution, modification, reverse engineering, or public deployment of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holders.
