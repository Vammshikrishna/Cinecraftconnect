
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ui/error-boundary";

import GlobalFeatures from "@/components/GlobalFeatures";

// Page Imports
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Feed = lazy(() => import("./pages/Feed"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectSpacePage = lazy(() => import("./pages/ProjectSpacePage"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Network = lazy(() => import("./pages/Network"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Analytics = lazy(() => import("./pages/Analytics"));
const LearningPortal = lazy(() => import("./pages/LearningPortal"));
const CraftPage = lazy(() => import("./pages/CraftPage"));
const AllCraftsPage = lazy(() => import("./pages/AllCraftsPage"));
const DiscussionRooms = lazy(() => import("./pages/DiscussionRooms"));
const ChatsList = lazy(() => import("./pages/ChatsList"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const Settings = lazy(() => import("./pages/Settings"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Vendors = lazy(() => import("./pages/Vendors"));
const MyApplications = lazy(() => import("./pages/jobs/MyApplications"));
const ManageJobs = lazy(() => import("./pages/jobs/ManageJobs"));
const SearchPage = lazy(() => import("./pages/SearchPage"));

// Custom route for the landing page
const LandingRoute = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/feed" /> : <Index />;
};

const App = () => {
  const { user, profile } = useAuth();
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
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
            <Route path="/chats" element={<ProtectedRoute><ChatsList /></ProtectedRoute>} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/jobs/applications" element={<ProtectedRoute><MyApplications /></ProtectedRoute>} />
            <Route path="/jobs/manage" element={<ProtectedRoute><ManageJobs /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

export default App;
