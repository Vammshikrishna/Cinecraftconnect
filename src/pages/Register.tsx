
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, ArrowLeft, Mail, Lock, User, Camera } from "lucide-react";

const Register = () => {
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
            <form className="space-y-5">
              <div className="space-y-1">
                <label htmlFor="fullName" className="text-sm font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    id="fullName"
                    placeholder="Enter your name" 
                    className="pl-10 bg-cinesphere-dark/50 border-white/10" 
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
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium">Profile Photo</label>
                <div className="border border-dashed border-white/20 rounded-lg p-4 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 mb-2">Upload a profile photo</p>
                    <Button variant="outline" size="sm" className="border-white/20">
                      Choose File
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button type="submit" className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                Create Account
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
