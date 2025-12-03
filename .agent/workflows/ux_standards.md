---
description: UX and UI Standards for CineCraft Connect
---

# UX/UI Standards

## Loading States
- **Always** use `EnhancedSkeleton` from `@/components/ui/enhanced-skeleton` instead of generic spinners for initial page loads.
- Use `CardSkeleton` for grid items.
- Maintain the shimmer effect (glassmorphism style) to match the dark theme.

## Mobile Optimization
- **Navigation**: Ensure `MobileNav` is visible on screens `< 1024px` (lg breakpoint).
- **Padding**: Add `pb-24` to the main container of any page that is accessible via mobile nav to prevent content overlap.
- **Grids**: Use `ResponsiveGrid` or explicit grid cols (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) to ensure cards stack vertically on mobile.
- **Touch Targets**: Ensure interactive elements have at least `44px` height/width or sufficient padding.

## Empty States
- Never leave a page blank.
- Use the `EmptyState` component (or similar custom UI) with:
  - An icon (lucide-react).
  - A clear title.
  - A helpful description or call to action.

## Global Features
- **Keyboard Shortcuts**: Maintain `useKeyboardShortcuts` for power users.
- **Back to Top**: Ensure `GlobalFeatures` is rendered in `App.tsx` to provide the scroll-to-top button.
