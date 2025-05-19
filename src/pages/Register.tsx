
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, ArrowLeft, Mail, Lock, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp, user } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect them
  if (user) {
    navigate("/feed");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName || !email || !password) return;
    
    try {
      setIsSubmitting(true);
      await signUp(email, password, fullName);
      // After successful registration, navigate to feed
      navigate("/feed");
    } catch (error) {
      console.error("Registration error:", error);
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
            <h1 className="text-3xl font-bold mb-2">Create your account</h1>
            <p className="text-gray-400">Join the professional network for film industry</p>
          </div>
          
          <div className="glass-card rounded-xl p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label htmlFor="fullName" className="text-sm font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="fullName"
                    placeholder="Enter your name" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
              
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
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="Create a password" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Already have an account? {" "}
                <Link to="/login" className="text-cinesphere-purple hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
