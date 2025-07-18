
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, ArrowLeft, Mail, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the location they were trying to access before being redirected to login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/feed";
  
  // If user is already logged in, redirect them
  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) return;
    
    try {
      setIsSubmitting(true);
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to sign in",
          variant: "destructive"
        });
        return;
      }
      
      // After successful login, navigate to the page they were trying to access
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cinesphere-dark flex flex-col">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft size={18} />
          <span>Back to home</span>
        </Link>
        
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center mb-6">
              <Film className="h-8 w-8 text-cinesphere-purple mr-2" />
              <span className="text-2xl font-bold text-gradient">CineSphere</span>
            </Link>
            <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
            <p className="text-gray-400">Sign in to your CineSphere account</p>
          </div>
          
          <div className="glass-card rounded-xl p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="you@example.com" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-xs text-cinesphere-purple hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="Enter your password" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Don't have an account? {" "}
                <Link to="/register" className="text-cinesphere-purple hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
