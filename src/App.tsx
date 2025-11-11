
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";

// Page Imports
const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Feed = lazy(() => import("./pages/Feed.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const PublicProfile = lazy(() => import("./pages/PublicProfile.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const ProjectDiscussionPage = lazy(() => import("./pages/ProjectDiscussionPage.tsx"));
const Jobs = lazy(() => import("./pages/Jobs.tsx"));
const Network = lazy(() => import("./pages/Network.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const LearningPortal = lazy(() => import("./pages/LearningPortal.tsx"));
const CraftPage = lazy(() => import("./pages/CraftPage.tsx"));
const AllCraftsPage = lazy(() => import("./pages/AllCraftsPage.tsx"));
const DiscussionRooms = lazy(() => import("./pages/DiscussionRooms.tsx"));
const ChatsList = lazy(() => import("./pages/ChatsList.tsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.tsx"));
const DirectMessagePage = lazy(() => import("./pages/DirectMessagePage.tsx"));

// Custom route for the landing page
const LandingRoute = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/feed" /> : <Index />;
};

const App = () => {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthProvider>
        <Navbar />
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
            <Route path="/projects/:projectId/discussion" element={<ProtectedRoute><ProjectDiscussionPage /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
            <Route path="/craft/:craftName" element={<CraftPage />} />
            <Route path="/craft/all" element={<AllCraftsPage />} />
            <Route path="/learn" element={<LearningPortal />} />
            <Route path="/discussion-rooms" element={<ProtectedRoute><DiscussionRooms /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><ChatsList /></ProtectedRoute>} />
            <Route path="/chats/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/messages/:userId" element={<ProtectedRoute><DirectMessagePage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
};

export default App;
