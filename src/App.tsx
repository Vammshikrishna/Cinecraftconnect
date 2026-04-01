
import { Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { Toaster } from "@/components/ui/toaster";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Navbar from "@/components/navbar/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ui/error-boundary";
import GlobalFeatures from "@/components/GlobalFeatures";

// Page Imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Projects from "./pages/Projects";
import ProjectSpacePage from "./pages/ProjectSpacePage";
import Jobs from "./pages/Jobs";
import Network from "./pages/Network";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import LearningPortal from "./pages/LearningPortal";
import CraftPage from "./pages/CraftPage";
import AllCraftsPage from "./pages/AllCraftsPage";
import DiscussionRooms from "./pages/DiscussionRooms";
import ChatsList from "./pages/ChatsList";
import ChatPage from "./pages/ChatPage";
import Settings from "./pages/Settings";
import AppearanceSettings from "./pages/settings/AppearanceSettings";
import NotificationsSettings from "./pages/settings/NotificationsSettings";
import PrivacySettings from "./pages/settings/PrivacySettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import AccessibilitySettings from "./pages/settings/AccessibilitySettings";
import SoundSettings from "./pages/settings/SoundSettings";
import DataSettings from "./pages/settings/DataSettings";
import AccountSettings from "./pages/settings/AccountSettings";
import CompleteProfile from "./pages/CompleteProfile";
import Marketplace from "./pages/Marketplace";
import MarketplaceListingDetail from "./pages/MarketplaceListingDetail";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import MyApplications from "./pages/jobs/MyApplications";
import ManageJobs from "./pages/jobs/ManageJobs";
import SearchPage from "./pages/SearchPage";
import ContentDetailPage from "./pages/ContentDetailPage";
import RatingsPage from "./pages/RatingsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import CompanyPages from "./pages/CompanyPages";
import CompanyPageDetail from "./pages/CompanyPageDetail";
import Notifications from "./pages/Notifications";
import JobDetail from "@/pages/JobDetail";
import PostDetailPage from "@/pages/PostDetailPage";

// Custom route for the landing page
const LandingRoute = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/feed" /> : <Index />;
};

import ScrollToTop from "@/components/ScrollToTop";

const App = () => {
  const { user, profile } = useAuth();
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <PresenceProvider>
        <ScrollToTop />
        <Toaster />
        <GlobalFeatures />
      {user && profile?.onboarding_completed && <Navbar />}
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="h-screen w-full flex items-center justify-center bg-background">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/post/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/:projectId/space" element={<ProtectedRoute><ProjectSpacePage /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
            <Route path="/craft/:craftName" element={<CraftPage />} />
            <Route path="/craft/all" element={<AllCraftsPage />} />
            <Route path="/learn" element={<LearningPortal />} />
            <Route path="/discussion-rooms" element={<ProtectedRoute><DiscussionRooms /></ProtectedRoute>} />
            <Route path="/discussion-rooms/:roomId" element={<ProtectedRoute><DiscussionRooms /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><ChatsList /></ProtectedRoute>} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/dm/:userId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
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
            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/marketplace/:listingId" element={<ProtectedRoute><MarketplaceListingDetail /></ProtectedRoute>} />
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      </PresenceProvider>
    </Router>
  );
};

export default App;
