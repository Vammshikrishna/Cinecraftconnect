import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext.tsx';
import { useToast } from '@/hooks/use-toast.ts';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// Schemas
const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
const signUpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

// Constants
const FORM_FIELDS = {
  LOGIN: [
    { name: 'email', placeholder: 'Email', type: 'email', icon: Mail },
    { name: 'password', placeholder: 'Password', type: 'password', icon: Lock },
  ],
  SIGNUP: [
    { name: 'email', placeholder: 'Email', type: 'email', icon: Mail },
    { name: 'password', placeholder: 'Password', type: 'password', icon: Lock },
  ]
};

const Auth = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(location.pathname !== '/register');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const currentFields = isLogin ? FORM_FIELDS.LOGIN : FORM_FIELDS.SIGNUP;

  const handleAuthAction = async (action: 'signIn' | 'signUp') => {
    const schema = action === 'signIn' ? loginSchema : signUpSchema;
    const result = schema.safeParse(formData);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(err => {
        if (err.path) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const { error } = action === 'signIn'
        ? await signIn(formData.email, formData.password)
        : await signUp(formData.email, formData.password);

      if (error) {
        setErrors({ form: error.message });
      } else {
        if (action === 'signIn') {
          toast({ title: "Welcome back!", description: "You have successfully signed in." });
          
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user) {
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userData.user.id)
                .single();

              const roleStr = roleData?.role as string | undefined;

              if (roleStr === 'super_admin') {
                navigate('/super-admin', { replace: true });
                return;
              } else if (roleStr === 'admin') {
                navigate('/admin', { replace: true });
                return;
              } else if (roleStr === 'moderator') {
                navigate('/moderation', { replace: true });
                return;
              }
            }
          } catch (e) {
            console.error("Error checking role after sign in", e);
          }
          
          navigate('/feed', { replace: true });
        } else {
          toast({ title: "Account created!", description: "Please complete your profile." });
          navigate('/complete-profile', { replace: true });
          setFormData({ email: '', password: '' });
        }
      }
    } catch (err) {
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuthAction(isLogin ? 'signIn' : 'signUp');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const toggleFormType = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFormData({ email: '', password: '' });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center flex justify-center mb-6">
            <AppLogo size="lg" to="/" />
        </div>
        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{isLogin ? 'Welcome Back' : 'Join CineCraft Connect'}</CardTitle>
            <CardDescription>{isLogin ? 'Sign in to your account to continue' : 'Create an account to start collaborating'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.form && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.form}</AlertDescription>
                </Alert>
              )}
              {currentFields.map(({ name, placeholder, type, icon: Icon }) => (
                <div key={name} className="space-y-2">
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
                      placeholder={placeholder}
                      value={formData[name as keyof typeof formData]}
                      onChange={e => handleInputChange(name, e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    {type === 'password' && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {errors[name] && <p className="text-sm text-destructive">{errors[name]}</p>}
                </div>
              ))}
              <Button type="submit" className="w-full hover-glow" disabled={isLoading}>
                {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleFormType}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={isLoading}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Back to home</Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
