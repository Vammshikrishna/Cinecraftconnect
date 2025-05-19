
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Feed from "./pages/Feed";
import Projects from "./pages/Projects";
import Jobs from "./pages/Jobs";
import Network from "./pages/Network";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Explore from "./pages/Explore";
import CraftPage from "./pages/CraftPage";
import AllCraftsPage from "./pages/AllCraftsPage";
import LearningPortal from "./pages/LearningPortal";
import NotFound from "./pages/NotFound";
import DiscussionRooms from "./pages/DiscussionRooms";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/explore" element={<Explore />} />
            {/* Protected Routes */}
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/my" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
            <Route path="/craft/:craftName" element={<ProtectedRoute><CraftPage /></ProtectedRoute>} />
            <Route path="/craft/all" element={<ProtectedRoute><AllCraftsPage /></ProtectedRoute>} />
            <Route path="/learn" element={<ProtectedRoute><LearningPortal /></ProtectedRoute>} />
            <Route path="/discussion-rooms" element={<ProtectedRoute><DiscussionRooms /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
