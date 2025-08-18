
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import SmartHome from "./components/SmartHome";
import Feed from "./pages/Feed";
import Analytics from "./pages/Analytics";
import Projects from "./pages/Projects";
import Jobs from "./pages/Jobs";
import Network from "./pages/Network";
import Explore from "./pages/Explore";
import CraftPage from "./pages/CraftPage";
import AllCraftsPage from "./pages/AllCraftsPage";
import LearningPortal from "./pages/LearningPortal";
import NotFound from "./pages/NotFound";
import DiscussionRooms from "./pages/DiscussionRooms";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import ChatPage from "./pages/ChatPage";
import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "@/components/Navbar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<SmartHome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/explore" element={<Explore />} />
            {/* All routes accessible without authentication */}
            <Route path="/feed" element={<Feed />} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/my" element={<Projects />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/network" element={<Network />} />
            <Route path="/craft/:craftName" element={<CraftPage />} />
            <Route path="/craft/all" element={<AllCraftsPage />} />
            <Route path="/learn" element={<LearningPortal />} />
            <Route path="/discussion-rooms" element={<DiscussionRooms />} />
            <Route path="/chats" element={<ChatPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
