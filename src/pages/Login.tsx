
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, ArrowLeft, Mail, Lock } from "lucide-react";

const Login = () => {
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
            <form className="space-y-5">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="you@example.com" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10" 
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
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                Sign In
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
