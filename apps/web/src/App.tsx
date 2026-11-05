import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { Toaster } from "@/components/ui/toaster";
import Navbar from "@/components/navbar/Navbar";
import LandingNavbar from "@/components/landing/LandingNavbar";
import PublicPage from "@/components/landing/PublicPage";
import { hasReturningHint } from "@/lib/auth/returningHint";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGuard from "@/components/RoleGuard";
import ErrorBoundary from "@/components/ui/error-boundary";
import GlobalFeatures from "@/components/GlobalFeatures";
import { MobileNavInset } from "@/components/layout/MobileNavInset";
import { RouteAccessibility } from "@/components/layout/RouteAccessibility";
import { ConfirmHost } from "@/components/common/ConfirmHost";
import { ScreenSkeleton } from "@/components/ui/enhanced-skeleton";
import { PremiumNotificationOverlay } from "@/components/notifications/PremiumNotificationOverlay";
import DesktopOnlyGuard from "@/components/DesktopOnlyGuard";
import { SystemStatusBanner } from "@/components/internal/shared/SystemStatusBanner";
import { FormErrorLinker } from "@/components/common/FormErrorLinker";
import LanguageSync from "@/components/common/LanguageSync";
import PageTranslator from "@/components/common/PageTranslator";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { CookieConsentBanner } from "@/components/gdpr/CookieConsentBanner";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { FeatureGuard } from "@/components/FeatureGuard";
import { StaffBlock } from "@/components/StaffBlock";
import { FanBlock } from "@/components/FanBlock";
import { RoomExistsGuard } from "@/components/discussions/RoomExistsGuard";
import { projectSpaceAliasTarget } from "@/components/routeGuardHelpers";
import { StaffMfaGate } from "@/components/internal/shared/StaffMfaGate";
import { PlatformFlagsProvider } from "@/contexts/PlatformFlagsContext";
import { SuspendedGuard } from "./components/SuspendedGuard";
import ScrollToTop from "@/components/ScrollToTop";
import { CallProvider } from "@/contexts/CallContext";
import { useEffect } from 'react';
import { KeyboardProvider } from "@/contexts/KeyboardContext";
import { useState } from 'react';
import { E2EEBackupProvider } from "@/contexts/E2EEBackupContext";
import { SettingsLayout, UserPreferencesEffect } from "@/components/settings/SettingsUI";
import { E2EEKeyBackupModal } from "@/components/security/E2EEKeyBackupModal";
import { useIsMobile } from "@/hooks/use-mobile";



// Lazy Loaded Pages
const LegalPage = lazy(() => import("./pages/LegalPage"));
const SupportHub = lazy(() => import("./pages/SupportHub").then((m) => ({ default: m.SupportHub })));
const SupportCategory = lazy(() => import("./pages/SupportHub").then((m) => ({ default: m.SupportCategory })));
const SupportArticle = lazy(() => import("./pages/SupportHub").then((m) => ({ default: m.SupportArticle })));
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectSpacePage = lazy(() => import("./pages/ProjectSpacePage"));
const CreateProject = lazy(() => import("./pages/CreateProject"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Network = lazy(() => import("./pages/Network"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CraftPage = lazy(() => import("./pages/CraftPage"));
const AllCraftsPage = lazy(() => import("./pages/AllCraftsPage"));
const SetupAdmin = lazy(() => import("./pages/admin/SetupAdmin"));
const DiscussionRooms = lazy(() => import("./pages/DiscussionRooms"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const AppearanceSettings = lazy(() => import("./pages/settings/AppearanceSettings"));
const NotificationsSettings = lazy(() => import("./pages/settings/NotificationsSettings"));
const PrivacySettings = lazy(() => import("./pages/settings/PrivacySettings"));
const SecuritySettings = lazy(() => import("./pages/settings/SecuritySettings"));
const SessionsSecurity = lazy(() => import("./pages/settings/SessionsSecurity"));
const AccessibilitySettings = lazy(() => import("./pages/settings/AccessibilitySettings"));
const SoundSettings = lazy(() => import("./pages/settings/SoundSettings"));
const DataSettings = lazy(() => import("./pages/settings/DataSettings"));
const HelpHome = lazy(() => import("./pages/settings/help/HelpHome"));
const HelpCategoryPage = lazy(() => import("./pages/settings/help/HelpCategoryPage"));
const HelpArticlePage = lazy(() => import("./pages/settings/help/HelpArticlePage"));
const HelpRequests = lazy(() => import("./pages/settings/help/HelpRequests"));
const HelpReports = lazy(() => import("./pages/settings/help/HelpReports"));
const HelpNewRequest = lazy(() => import("./pages/settings/help/HelpNewRequest"));
const HelpTicketPage = lazy(() => import("./pages/settings/help/HelpTicketPage"));
const LegalSettings = lazy(() => import("./pages/settings/LegalSettings"));
const AboutSettings = lazy(() => import("./pages/settings/AboutSettings"));
const CallsSettings = lazy(() => import("./pages/settings/CallsSettings"));
const ActivitySettings = lazy(() => import("./pages/settings/ActivitySettings"));
const MessagesSettings = lazy(() => import("./pages/settings/MessagesSettings"));
const RequestsSettings = lazy(() => import("./pages/settings/RequestsSettings"));
const QuietHoursSettings = lazy(() => import("./pages/settings/QuietHoursSettings"));
const LanguageSettings = lazy(() => import("./pages/settings/LanguageSettings"));
const BlockedSettings = lazy(() => import("./pages/settings/BlockedSettings"));
const AccountStandingSettings = lazy(() => import("./pages/settings/AccountStandingSettings"));
const AccountSettings = lazy(() => import("./pages/settings/AccountSettings"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const AvailabilityCalendar = lazy(() => import("./pages/profile/AvailabilityCalendar"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Plans = lazy(() => import("./pages/Plans"));
const Gifts = lazy(() => import("./pages/Gifts"));
const MyPayments = lazy(() => import("./pages/MyPayments"));
const MarketplaceListingDetail = lazy(() => import("./pages/MarketplaceListingDetail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const CompanyPageRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/pages/${slug}`} replace />;
};
// Old alias: /project-space/:projectId opens that project's space (feature flag and sign-in are checked by the route).
const ProjectSpaceAlias = () => {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={projectSpaceAliasTarget(projectId)} replace />;
};
const MyBookings = lazy(() => import("./pages/marketplace/MyBookings"));
const MyQuotes = lazy(() => import("./pages/marketplace/MyQuotes"));
const MarketplaceDisputes = lazy(() => import("./pages/marketplace/MarketplaceDisputes"));
const SellerHub = lazy(() => import("./pages/marketplace/SellerHub"));
const SharedWishlist = lazy(() => import("./pages/SharedWishlist"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const VendorServiceDetail = lazy(() => import("./pages/VendorServiceDetail"));
const MyApplications = lazy(() => import("./pages/jobs/MyApplications"));
const ManageJobs = lazy(() => import("./pages/jobs/ManageJobs"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ContentDetailPage = lazy(() => import("./pages/ContentDetailPage"));
const RatingsPage = lazy(() => import("./pages/RatingsPage"));
const MyRatings = lazy(() => import("./pages/MyRatings"));
const UsernameRedirect = lazy(() => import("./pages/UsernameRedirect"));
const Shortlists = lazy(() => import("./pages/Shortlists"));
const FilmListDetail = lazy(() => import("./pages/FilmListDetail"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const CompanyPages = lazy(() => import("./pages/CompanyPages"));
const CompanyPageDetail = lazy(() => import("./pages/CompanyPageDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const JoinProjectByInvite = lazy(() => import("./pages/JoinProjectByInvite"));
const DiscussionRoomDetailPage = lazy(() => import("./pages/DiscussionRoomDetailPage"));
const Support = lazy(() => import("./pages/Support"));
const SupportTicketRedirect = lazy(() => import("./pages/SupportTicketRedirect"));
const Pitch = lazy(() => import("./pages/Pitch"));
const PitchDetail = lazy(() => import("./pages/PitchDetail"));
const SubmitPitch = lazy(() => import("./pages/SubmitPitch"));
const ReviewSubmission = lazy(() => import("./pages/ReviewSubmission"));


// Legal Pages
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));

// Resource Pages
const Documentation = lazy(() => import("./pages/resources/Documentation"));
const CommunityGuidelines = lazy(() => import("./pages/resources/CommunityGuidelines"));
const Transparency = lazy(() => import("./pages/Transparency"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const SafetyCenter = lazy(() => import("./pages/resources/SafetyCenter"));

// Marketing Pages
const About = lazy(() => import("./pages/About"));
const Features = lazy(() => import("./pages/Features"));

// Internal Governance (role-gated)
const ModerationDashboard = lazy(() => import("./pages/admin/ModerationDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const FinanceDashboard = lazy(() => import("./pages/admin/FinanceDashboard"));

// Custom route for the landing page
const LandingRoute = () => {
  const { user, isLoading } = useAuth();
  // A returning user waits for the saved session, so they never see the landing page flash before the redirect. A first-time visitor
  // (no hint) sees the page straight away; if a session does turn up, they are sent to the feed as before.
  if (isLoading && hasReturningHint()) return null;
  return user ? <Navigate to="/feed" replace /> : <Index />;
};

// Clean navigation wrapper that selects and hides navbars based on auth state and current route
const NavigationWrapper = ({ isLoading, user, profile }: { isLoading: boolean; user: any; profile: any }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/register';
  const isMobileCreatePage = isMobile && location.pathname === '/create';
  
  if (isAuthPage || isMobileCreatePage) {
    return null;
  }

  // If we have no user yet AND we're still loading (initial boot), hide the navbar to avoid flicker.
  // But if user is already set (came from bootstrap or SIGNED_IN), show the navbar immediately —
  // don't wait for the profile DB fetch to complete, which causes a visible delay on the APK.
  if (isLoading && !user) {
    return null;
  }
  
  const isInternal = profile?.is_internal || (profile?.role && ['admin', 'moderator', 'super_admin', 'finance'].includes(profile.role));
  // Show the full authenticated Navbar as soon as user is set.
  // While profile is still loading (profile=null but user exists), show Navbar — it handles null profile gracefully.
  // Only fall back to LandingNavbar for unauthenticated users or users who haven't completed onboarding.
  const profileLoaded = profile !== null;
  const showFullNavbar = user && (!profileLoaded || profile?.onboarding_completed || isInternal);
  
  return showFullNavbar ? <Navbar /> : <LandingNavbar />;
};


import PageLoader from "@/components/common/PageLoader";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { useE2EEInit } from "@/hooks/useE2EEInit";

// Warm the most-visited lazy routes once the browser is idle after sign-in, so navigation feels instant
// without paying for those chunks on the first paint.
const prefetchLikelyRoutes = () => {
  const conn = (navigator as any).connection;
  if (conn?.saveData || /2g/.test(conn?.effectiveType || '')) return; // respect data saver / slow networks
  const run = () => {
    import('./pages/Messages');
    import('./pages/Projects');
    import('./pages/Jobs');
    import('./pages/Profile');
    import('./pages/DiscussionRooms');
    import('./pages/Network');
  };
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => void);
  if (ric) ric(run, { timeout: 4000 });
  else setTimeout(run, 2500);
};

const App = () => {
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (user) prefetchLikelyRoutes();
  }, [user?.id]);
  useE2EEInit(); // Automatically initializes keys for authenticated users

  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <KeyboardProvider>
        <NavigationProvider>
          <E2EEBackupProvider>
            <E2EEKeyBackupModal />
            <PageLoader />
            <PlatformFlagsProvider>
              <CallProvider>
                <PresenceProvider>
                <ScrollToTop />
                <RouteAccessibility />
                <ConfirmHost />
                <OfflineBanner />
                <SystemStatusBanner />
                <FormErrorLinker />
                <LanguageSync />
                <PageTranslator />
                <CookieConsentBanner />
                <Toaster />
                <UserPreferencesEffect />
                <PremiumNotificationOverlay />
                <GlobalFeatures />

                <NavigationWrapper isLoading={isLoading} user={user} profile={profile} />

                <MaintenanceGuard>
                  <ErrorBoundary>
                    <Suspense
                      fallback={<ScreenSkeleton variant="detail" className="min-h-[60vh]" />}
                    >
                      <SuspendedGuard>
                        <MobileNavInset>
                        <Routes>
                          <Route path="/" element={<LandingRoute />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/register" element={<Auth />} />
                          <Route path="/about" element={<PublicPage><About /></PublicPage>} />
                          <Route path="/features" element={<PublicPage><Features /></PublicPage>} />
                          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                          <Route path="/post/:postId" element={<PostDetailPage />} />
                          <Route path="/posts/:postId" element={<PostDetailPage />} />
                          <Route path="/create" element={<StaffBlock><ProtectedRoute><FanBlock><CreatePost /></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                          <Route path="/profile/availability" element={<ProtectedRoute><AvailabilityCalendar /></ProtectedRoute>} />
                          <Route path="/profile/availability/:userId" element={<ProtectedRoute><AvailabilityCalendar /></ProtectedRoute>} />
                          <Route path="/u/:identifier" element={<UsernameRedirect />} />
                          <Route path="/network/shortlists" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><Shortlists /></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/profile/:userId/availability" element={<ProtectedRoute><AvailabilityCalendar /></ProtectedRoute>} />
                          <Route path="/profile/:userId" element={<FeatureGuard flag="talent_network_enabled" fallbackTitle="Network Restricted"><PublicProfile /></FeatureGuard>} />
                          <Route path="/projects" element={<ProtectedRoute><FanBlock redirectTo="/404"><FeatureGuard flag="project_creation_enabled" fallbackTitle="Project Hub Restricted"><Projects /></FeatureGuard></FanBlock></ProtectedRoute>} />
                          <Route path="/projects/create" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="project_creation_enabled"><CreateProject /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/projects/join/:code" element={<ProtectedRoute><FanBlock redirectTo="/404"><JoinProjectByInvite /></FanBlock></ProtectedRoute>} />
                          <Route path="/projects/:projectId" element={<FeatureGuard flag="project_creation_enabled"><ProjectDetailPage /></FeatureGuard>} />
                          <Route path="/projects/:projectId/space" element={<FanBlock redirectTo="/404"><FeatureGuard flag="project_creation_enabled"><ProjectSpacePage /></FeatureGuard></FanBlock>} />
                          <Route path="/jobs" element={<ProtectedRoute><FeatureGuard flag="job_posting_enabled" fallbackTitle="Job Board Restricted"><Jobs /></FeatureGuard></ProtectedRoute>} />
                          <Route path="/network" element={<ProtectedRoute><FeatureGuard flag="talent_network_enabled" fallbackTitle="Talent Search Restricted"><Network /></FeatureGuard></ProtectedRoute>} />
                          <Route path="/craft/:craftName" element={<CraftPage />} />
                          <Route path="/all-crafts" element={<AllCraftsPage />} />
                          <Route path="/setup-admin" element={
                            <DesktopOnlyGuard>
                              <SetupAdmin />
                            </DesktopOnlyGuard>
                          } />
                          <Route path="/discussion-rooms" element={<ProtectedRoute><FeatureGuard flag="discussion_rooms_enabled" fallbackTitle="Discussions Offline"><DiscussionRooms /></FeatureGuard></ProtectedRoute>} />
                          <Route path="/discussion-rooms/:roomId" element={<FeatureGuard flag="discussion_rooms_enabled"><DiscussionRoomDetailPage /></FeatureGuard>} />
                          <Route path="/discussion-rooms/:roomId/chat" element={<ProtectedRoute><FeatureGuard flag="discussion_rooms_enabled"><RoomExistsGuard><DiscussionRooms /></RoomExistsGuard></FeatureGuard></ProtectedRoute>} />
                          <Route path="/discussions" element={<Navigate to="/discussion-rooms" replace />} />
                          <Route path="/discussions/:roomId" element={<FeatureGuard flag="discussion_rooms_enabled"><DiscussionRoomDetailPage /></FeatureGuard>} />
                          <Route path="/project-space/:projectId" element={<ProtectedRoute><FanBlock redirectTo="/404"><FeatureGuard flag="project_creation_enabled"><ProjectSpaceAlias /></FeatureGuard></FanBlock></ProtectedRoute>} />
                          <Route path="/messages" element={<StaffBlock><ProtectedRoute><FeatureGuard flag="messaging_enabled" fallbackTitle="Messaging Offline"><Messages /></FeatureGuard></ProtectedRoute></StaffBlock>} />
                          <Route path="/messages/:conversationId" element={<StaffBlock><ProtectedRoute><FeatureGuard flag="messaging_enabled"><Messages /></FeatureGuard></ProtectedRoute></StaffBlock>} />
                          <Route path="/dm/:userId" element={<StaffBlock><ProtectedRoute><FeatureGuard flag="messaging_enabled"><Messages /></FeatureGuard></ProtectedRoute></StaffBlock>} />
                          <Route path="/legal/:type" element={<PublicPage><LegalPage /></PublicPage>} />
                          <Route path="/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
                            <Route index element={<Settings />} />
                            <Route path="appearance" element={<AppearanceSettings />} />
                            <Route path="notifications" element={<NotificationsSettings />} />
                            <Route path="privacy" element={<PrivacySettings />} />
                            <Route path="blocked" element={<BlockedSettings />} />
                            <Route path="standing" element={<AccountStandingSettings />} />
                            <Route path="activity" element={<ActivitySettings />} />
                            <Route path="messages" element={<MessagesSettings />} />
                            <Route path="requests" element={<RequestsSettings />} />
                            <Route path="quiet-hours" element={<QuietHoursSettings />} />
                            <Route path="language" element={<LanguageSettings />} />
                            <Route path="calls" element={<CallsSettings />} />
                            <Route path="help" element={<HelpHome />} />
                            <Route path="help/category/:id" element={<HelpCategoryPage />} />
                            <Route path="help/article/:id" element={<HelpArticlePage />} />
                            <Route path="help/requests" element={<HelpRequests />} />
                            <Route path="help/reports" element={<HelpReports />} />
                            <Route path="help/requests/:id" element={<HelpTicketPage />} />
                            <Route path="help/new" element={<HelpNewRequest />} />
                            <Route path="legal/:type" element={<LegalSettings />} />
                            <Route path="about" element={<AboutSettings />} />
                            <Route path="security" element={<SecuritySettings />} />
                            <Route path="sessions" element={<SessionsSecurity />} />
                            <Route path="accessibility" element={<AccessibilitySettings />} />
                            <Route path="sound" element={<SoundSettings />} />
                            <Route path="availability" element={<AvailabilityCalendar embedded />} />
                            <Route path="data" element={<DataSettings />} />
                            <Route path="account" element={<AccountSettings />} />
                            <Route path="plans" element={<StaffBlock><Plans embedded /></StaffBlock>} />
                            <Route path="payments" element={<StaffBlock><MyPayments embedded /></StaffBlock>} />
                          </Route>
                          <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
                          <Route path="/payments" element={<ProtectedRoute><StaffBlock><MyPayments /></StaffBlock></ProtectedRoute>} />
                          <Route path="/gifts" element={<ProtectedRoute><StaffBlock><Gifts /></StaffBlock></ProtectedRoute>} />
                          <Route path="/plans" element={<ProtectedRoute><StaffBlock><Plans /></StaffBlock></ProtectedRoute>} />
                          <Route path="/marketplace" element={<ProtectedRoute><FeatureGuard flag="marketplace_enabled" fallbackTitle="Marketplace Disabled"><Marketplace /></FeatureGuard></ProtectedRoute>} />
                          <Route path="/marketplace/bookings" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="marketplace_enabled"><MyBookings /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/marketplace/disputes" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="marketplace_enabled"><MarketplaceDisputes /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/marketplace/quotes" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="marketplace_enabled"><MyQuotes /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/marketplace/hub" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="marketplace_enabled"><SellerHub /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/marketplace/wishlist" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="marketplace_enabled"><Wishlist /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/marketplace/wishlist/shared/:token" element={<FeatureGuard flag="marketplace_enabled"><SharedWishlist /></FeatureGuard>} />
                          <Route path="/marketplace/:listingId" element={<FeatureGuard flag="marketplace_enabled"><MarketplaceListingDetail /></FeatureGuard>} />
                          <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                          <Route path="/vendors/:id" element={<VendorDetail />} />
                          <Route path="/vendors/services/:id" element={<VendorServiceDetail />} />
                          <Route path="/jobs/:jobId" element={<FeatureGuard flag="job_posting_enabled" fallbackTitle="Job Board Restricted"><JobDetail /></FeatureGuard>} />
                          <Route path="/jobs/applications" element={<StaffBlock><ProtectedRoute><FeatureGuard flag="job_posting_enabled" fallbackTitle="Job Board Restricted"><MyApplications /></FeatureGuard></ProtectedRoute></StaffBlock>} />
                          <Route path="/jobs/manage" element={<StaffBlock><ProtectedRoute><FanBlock title="This area is for creators and studios" description="Fan accounts can follow people and react to posts, but cannot use this page."><FeatureGuard flag="job_posting_enabled" fallbackTitle="Job Board Restricted"><ManageJobs /></FeatureGuard></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
                          <Route path="/explore" element={<Navigate to="/search" replace />} />
                          <Route path="/content/:type/:id" element={<ContentDetailPage />} />
                          <Route path="/ratings" element={<ProtectedRoute><RatingsPage /></ProtectedRoute>} />
                          <Route path="/ratings/mine" element={<StaffBlock><ProtectedRoute><MyRatings /></ProtectedRoute></StaffBlock>} />
                          <Route path="/lists/:id" element={<ProtectedRoute><FilmListDetail /></ProtectedRoute>} />
                          <Route path="/category/:categoryId" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
                          <Route path="/pitch" element={<ProtectedRoute><FanBlock redirectTo="/404"><Pitch /></FanBlock></ProtectedRoute>} />
                          <Route path="/pitch/:pitchId" element={<FanBlock redirectTo="/404"><PitchDetail /></FanBlock>} />
                          <Route path="/pitch/:pitchId/submit" element={<StaffBlock><ProtectedRoute><FanBlock redirectTo="/404"><SubmitPitch /></FanBlock></ProtectedRoute></StaffBlock>} />
                          <Route path="/pitch/submission/:submissionId/review" element={<StaffBlock><ProtectedRoute><ReviewSubmission /></ProtectedRoute></StaffBlock>} />
                          <Route path="/announcements" element={<AnnouncementsPage />} />
                          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                          <Route path="/pages" element={<ProtectedRoute><CompanyPages /></ProtectedRoute>} />
                          <Route path="/pages/:slug" element={<CompanyPageDetail />} />
                          <Route path="/company/:slug" element={<CompanyPageRedirect />} />
                          <Route path="/support" element={<PublicPage><SupportHub /></PublicPage>} />
                          <Route path="/support/category/:id" element={<PublicPage><SupportCategory /></PublicPage>} />
                          <Route path="/support/article/:id" element={<PublicPage><SupportArticle /></PublicPage>} />
                          <Route path="/support/ticket/:ticketId" element={<SupportTicketRedirect />} />


                          {/* Public Legal Routes */}
                          <Route path="/privacy" element={<PublicPage><PrivacyPolicy /></PublicPage>} />
                          <Route path="/terms" element={<PublicPage><TermsOfService /></PublicPage>} />
                          <Route path="/cookie" element={<PublicPage><CookiePolicy /></PublicPage>} />
                          <Route path="/documentation" element={<PublicPage><Documentation /></PublicPage>} />
                          <Route path="/community-guidelines" element={<PublicPage><CommunityGuidelines /></PublicPage>} />
                          <Route path="/transparency" element={<Transparency />} />
                          <Route path="/status" element={<StatusPage />} />
                          <Route path="/safety-center" element={<PublicPage><SafetyCenter /></PublicPage>} />

                          {/* Internal Governance Routes — role-gated */}
                          <Route path="/moderation" element={
                            <ProtectedRoute>
                              <RoleGuard requiredRole="moderator">
                                <StaffMfaGate>
                                <DesktopOnlyGuard>
                                  <ModerationDashboard />
                                </DesktopOnlyGuard>
                                </StaffMfaGate>
                              </RoleGuard>
                            </ProtectedRoute>
                          } />
                          <Route path="/admin" element={
                            <ProtectedRoute>
                              <RoleGuard requiredRole="admin">
                                <StaffMfaGate>
                                <DesktopOnlyGuard>
                                  <AdminDashboard />
                                </DesktopOnlyGuard>
                                </StaffMfaGate>
                              </RoleGuard>
                            </ProtectedRoute>
                          } />
                          <Route path="/finance" element={
                            <ProtectedRoute>
                              <RoleGuard requiredRole="finance" onlyRoles={['finance', 'admin', 'super_admin']}>
                                <StaffMfaGate>
                                <DesktopOnlyGuard>
                                  <FinanceDashboard />
                                </DesktopOnlyGuard>
                                </StaffMfaGate>
                              </RoleGuard>
                            </ProtectedRoute>
                          } />
                          <Route path="/super-admin" element={
                            <ProtectedRoute>
                              <RoleGuard requiredRole="super_admin">
                                <StaffMfaGate>
                                <DesktopOnlyGuard>
                                  <SuperAdminDashboard />
                                </DesktopOnlyGuard>
                                </StaffMfaGate>
                              </RoleGuard>
                            </ProtectedRoute>
                          } />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        </MobileNavInset>
                      </SuspendedGuard>
                    </Suspense>
                  </ErrorBoundary>
                </MaintenanceGuard>
              </PresenceProvider>
            </CallProvider>
          </PlatformFlagsProvider>
          </E2EEBackupProvider>
        </NavigationProvider>
      </KeyboardProvider>
    </Router>
  );
};

export default App;
