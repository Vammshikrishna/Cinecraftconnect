import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { Toaster } from "@/components/ui/toaster";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Navbar from "@/components/navbar/Navbar";
import LandingNavbar from "@/components/landing/LandingNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGuard from "@/components/RoleGuard";
import ErrorBoundary from "@/components/ui/error-boundary";
import GlobalFeatures from "@/components/GlobalFeatures";
import ThemeSyncPrompt from "@/components/theme/ThemeSyncPrompt";
import DesktopOnlyGuard from "@/components/DesktopOnlyGuard";
import { SystemStatusBanner } from "@/components/internal/shared/SystemStatusBanner";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { FeatureGuard } from "@/components/FeatureGuard";
import { PlatformFlagsProvider } from "@/contexts/PlatformFlagsContext";
import { SuspendedGuard } from "./components/SuspendedGuard";

// Lazy Loaded Pages
import { LegalPage } from "./pages/LegalPage";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Feed = lazy(() => import("./pages/Feed"));
const Profile = lazy(() => import("./pages/Profile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectSpacePage = lazy(() => import("./pages/ProjectSpacePage"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Network = lazy(() => import("./pages/Network"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LearningPortal = lazy(() => import("./pages/LearningPortal"));
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
const AccessibilitySettings = lazy(() => import("./pages/settings/AccessibilitySettings"));
const SoundSettings = lazy(() => import("./pages/settings/SoundSettings"));
const DataSettings = lazy(() => import("./pages/settings/DataSettings"));
const AccountSettings = lazy(() => import("./pages/settings/AccountSettings"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MarketplaceListingDetail = lazy(() => import("./pages/MarketplaceListingDetail"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const MyApplications = lazy(() => import("./pages/jobs/MyApplications"));
const ManageJobs = lazy(() => import("./pages/jobs/ManageJobs"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ContentDetailPage = lazy(() => import("./pages/ContentDetailPage"));
const RatingsPage = lazy(() => import("./pages/RatingsPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const CompanyPages = lazy(() => import("./pages/CompanyPages"));
const CompanyPageDetail = lazy(() => import("./pages/CompanyPageDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const Support = lazy(() => import("./pages/Support"));

// Legal Pages
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));

// Resource Pages
const Documentation = lazy(() => import("./pages/resources/Documentation"));
const CommunityGuidelines = lazy(() => import("./pages/resources/CommunityGuidelines"));
const SafetyCenter = lazy(() => import("./pages/resources/SafetyCenter"));

// Marketing Pages
const About = lazy(() => import("./pages/About"));
const Features = lazy(() => import("./pages/Features"));

// Internal Governance (role-gated)
const ModerationDashboard = lazy(() => import("./pages/admin/ModerationDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));

// Custom route for the landing page
const LandingRoute = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/feed" /> : <Index />;
};

import ScrollToTop from "@/components/ScrollToTop";
import { CallProvider } from "@/contexts/CallContext";

const App = () => {
  const { user, profile, isLoading } = useAuth();
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <PlatformFlagsProvider>
        <CallProvider>
        <PresenceProvider>
          <ScrollToTop />
          <SystemStatusBanner />
          <Toaster />
          <GlobalFeatures />
          <ThemeSyncPrompt />
        {!isLoading && (user && profile?.onboarding_completed ? <Navbar /> : <LandingNavbar />)}
        <MaintenanceGuard>
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="h-screen w-full flex items-center justify-center bg-background">
                  <LoadingSpinner size="lg" />
                </div>
              }
            >
              <SuspendedGuard>
              <Routes>
                <Route path="/" element={<LandingRoute />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route path="/about" element={<About />} />
                <Route path="/features" element={<Features />} />
                <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/post/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
                <Route path="/profile/:userId" element={<ProtectedRoute><FeatureGuard flag="talent_network_enabled" fallbackTitle="Network Restricted"><PublicProfile /></FeatureGuard></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><FeatureGuard flag="project_creation_enabled" fallbackTitle="Project Hub Restricted"><Projects /></FeatureGuard></ProtectedRoute>} />
                <Route path="/projects/:projectId" element={<ProtectedRoute><FeatureGuard flag="project_creation_enabled"><ProjectDetailPage /></FeatureGuard></ProtectedRoute>} />
                <Route path="/projects/:projectId/space" element={<ProtectedRoute><FeatureGuard flag="project_creation_enabled"><ProjectSpacePage /></FeatureGuard></ProtectedRoute>} />
                <Route path="/jobs" element={<ProtectedRoute><FeatureGuard flag="job_posting_enabled" fallbackTitle="Job Board Restricted"><Jobs /></FeatureGuard></ProtectedRoute>} />
                <Route path="/network" element={<ProtectedRoute><FeatureGuard flag="talent_network_enabled" fallbackTitle="Talent Search Restricted"><Network /></FeatureGuard></ProtectedRoute>} />
                <Route path="/craft/:craftName" element={<CraftPage />} />
                <Route path="/all-crafts" element={<AllCraftsPage />} />
                <Route path="/setup-admin" element={
                  <DesktopOnlyGuard>
                    <SetupAdmin />
                  </DesktopOnlyGuard>
                } />
                <Route path="/learn" element={<LearningPortal />} />
                <Route path="/discussion-rooms" element={<ProtectedRoute><FeatureGuard flag="discussion_rooms_enabled" fallbackTitle="Discussions Offline"><DiscussionRooms /></FeatureGuard></ProtectedRoute>} />
                <Route path="/discussion-rooms/:roomId" element={<ProtectedRoute><FeatureGuard flag="discussion_rooms_enabled"><DiscussionRooms /></FeatureGuard></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><FeatureGuard flag="messaging_enabled" fallbackTitle="Messaging Offline"><Messages /></FeatureGuard></ProtectedRoute>} />
                <Route path="/messages/:conversationId" element={<ProtectedRoute><FeatureGuard flag="messaging_enabled"><Messages /></FeatureGuard></ProtectedRoute>} />
                <Route path="/dm/:userId" element={<ProtectedRoute><FeatureGuard flag="messaging_enabled"><Messages /></FeatureGuard></ProtectedRoute>} />
                <Route path="/pricing" element={<ProtectedRoute><FeatureGuard flag="monetization_enabled"><Pricing /></FeatureGuard></ProtectedRoute>} />
                <Route path="/legal/:type" element={<LegalPage />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
                <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsSettings /></ProtectedRoute>} />
                <Route path="/settings/privacy" element={<ProtectedRoute><PrivacySettings /></ProtectedRoute>} />
                <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
                <Route path="/settings/accessibility" element={<ProtectedRoute><AccessibilitySettings /></ProtectedRoute>} />
                <Route path="/settings/sound" element={<ProtectedRoute><SoundSettings /></ProtectedRoute>} />
                <Route path="/settings/data" element={<ProtectedRoute><DataSettings /></ProtectedRoute>} />
                <Route path="/settings/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
                <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
                <Route path="/marketplace" element={<ProtectedRoute><FeatureGuard flag="marketplace_enabled" fallbackTitle="Marketplace Disabled"><Marketplace /></FeatureGuard></ProtectedRoute>} />
                <Route path="/marketplace/:listingId" element={<ProtectedRoute><FeatureGuard flag="marketplace_enabled"><MarketplaceListingDetail /></FeatureGuard></ProtectedRoute>} />
                <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                <Route path="/vendors/:id" element={<ProtectedRoute><VendorDetail /></ProtectedRoute>} />
                <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
                <Route path="/jobs/applications" element={<ProtectedRoute><MyApplications /></ProtectedRoute>} />
                <Route path="/jobs/manage" element={<ProtectedRoute><ManageJobs /></ProtectedRoute>} />
                <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
                <Route path="/content/:type/:id" element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>} />
                <Route path="/ratings" element={<ProtectedRoute><RatingsPage /></ProtectedRoute>} />
                <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/pages" element={<ProtectedRoute><CompanyPages /></ProtectedRoute>} />
                <Route path="/pages/:slug" element={<ProtectedRoute><CompanyPageDetail /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />

                {/* Public Legal Routes */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cookie" element={<CookiePolicy />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                <Route path="/safety-center" element={<SafetyCenter />} />

                {/* Internal Governance Routes — role-gated */}
                <Route path="/moderation" element={
                  <ProtectedRoute>
                    <RoleGuard requiredRole="moderator">
                      <DesktopOnlyGuard>
                        <ModerationDashboard />
                      </DesktopOnlyGuard>
                    </RoleGuard>
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <RoleGuard requiredRole="admin">
                      <DesktopOnlyGuard>
                        <AdminDashboard />
                      </DesktopOnlyGuard>
                    </RoleGuard>
                  </ProtectedRoute>
                } />
                <Route path="/super-admin" element={
                  <ProtectedRoute>
                    <RoleGuard requiredRole="super_admin">
                      <DesktopOnlyGuard>
                        <SuperAdminDashboard />
                      </DesktopOnlyGuard>
                    </RoleGuard>
                  </ProtectedRoute>
                } />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </SuspendedGuard>
            </Suspense>
          </ErrorBoundary>
        </MaintenanceGuard>
        </PresenceProvider>
      </CallProvider>
      </PlatformFlagsProvider>
    </Router>
  );
};

export default App;
