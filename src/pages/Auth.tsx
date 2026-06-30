import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, WifiOff } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext.tsx';
import { useToast } from '@/hooks/use-toast.ts';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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
  const { push } = useAppNavigation();
  const [isLogin, setIsLogin] = useState(location.pathname !== '/register');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const { signIn, signUp, signInWithProvider } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const emailParam = queryParams.get('email');
    const errorParam = queryParams.get('error');
    
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: decodeURIComponent(emailParam) }));
    }
    
    if (errorParam === 'session_expired') {
      setErrors(prev => ({ ...prev, form: 'Your session has expired. Please sign in again.' }));
    }
  }, [location.search]);

  const currentFields = isLogin ? FORM_FIELDS.LOGIN : FORM_FIELDS.SIGNUP;

  const handleAuthAction = async (action: 'signIn' | 'signUp') => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const waitSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setErrors({ form: `Too many attempts. Please try again in ${waitSeconds} seconds.` });
      return;
    }

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
        if (action === 'signIn') {
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          
          if (newAttempts >= 3) {
             const delaySeconds = 15 * Math.pow(2, newAttempts - 3);
             setLockoutUntil(Date.now() + delaySeconds * 1000);
             setErrors({ form: `Too many failed attempts. Account locked for ${delaySeconds} seconds for security.` });
             console.warn(`[SECURITY] Suspicious auth activity: ${newAttempts} failed logins for ${formData.email}`);
          } else {
             setErrors({ form: error.message });
          }
        } else {
          setErrors({ form: error.message });
        }
      } else {
        setFailedAttempts(0);
        setLockoutUntil(null);
        if (action === 'signIn') {
          toast({ title: "Welcome back!", description: "You have successfully signed in." });
          
          const queryParams = new URLSearchParams(location.search);
          const redirectUrl = queryParams.get('redirect') || (location.state as any)?.from?.pathname;
          
          if (redirectUrl) {
            const search = (location.state as any)?.from?.search || '';
            push(decodeURIComponent(redirectUrl) + search, { noScroll: true });
            return;
          }
          
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user) {
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userData.user.id)
                .maybeSingle();

              const roleStr = roleData?.role as string | undefined;

              if (roleStr === 'super_admin') {
                push('/super-admin', { noScroll: true });
                return;
              } else if (roleStr === 'admin') {
                push('/admin', { noScroll: true });
                return;
              } else if (roleStr === 'moderator') {
                push('/moderation', { noScroll: true });
                return;
              }
            }
          } catch (e) {
            console.error("Error checking role after sign in", e);
          }
          
          // Eagerly prefetch the initial feed micro-payload during the routing transition
          try {
             const { data: prefetchUserData } = await supabase.auth.getUser();
             if (prefetchUserData?.user?.id) {
                queryClient.prefetchInfiniteQuery({
                  queryKey: ['home-feed-posts', prefetchUserData.user.id],
                  queryFn: async () => {
                    const { data } = await supabase
                        .from('posts')
                        .select('*, profiles:author_id(id, full_name, username, avatar_url, craft, is_verified), company_pages:page_id(id, name, logo_url, slug, is_verified)')
                        .order('created_at', { ascending: false })
                        .limit(5);
                    return data || [];
                  },
                  initialPageParam: null as string | null
                });
             }
          } catch(e) {}

          push('/feed', { noScroll: true });
        } else {
          toast({ title: "Account created!", description: "Please complete your profile." });
          push('/complete-profile', { noScroll: true });
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

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    if (!isOnline) {
      setErrors({ form: 'You must be online to sign in.' });
      return;
    }
    setIsLoading(true);
    setErrors({});
    try {
      const { error } = await signInWithProvider(provider);
      if (error) {
        setErrors({ form: error.message });
      }
    } catch (err) {
      setErrors({ form: 'An unexpected error occurred with the provider. Please try again.' });
    } finally {
      setIsLoading(false);
    }
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
              {!isOnline && (
                <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                  <WifiOff className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-xs">
                    You are offline. Reconnect to sign in or create an account.
                  </AlertDescription>
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
                      disabled={isLoading || !isOnline}
                    />
                    {type === 'password' && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading || !isOnline}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {errors[name] && <p className="text-sm text-destructive">{errors[name]}</p>}
                </div>
              ))}
              <Button type="submit" className="w-full hover-glow" disabled={isLoading || !isOnline}>
                {isLoading ? 'Please wait...' : !isOnline ? 'Connection Required' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                type="button"
                disabled={isLoading || !isOnline}
                onClick={() => handleOAuthSignIn('google')}
                className="bg-card hover:bg-card/80 border-border/50 transition-all hover-glow"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
              <Button 
                variant="outline" 
                type="button"
                disabled={isLoading || !isOnline}
                onClick={() => handleOAuthSignIn('apple')}
                className="bg-card hover:bg-card/80 border-border/50 transition-all hover-glow"
              >
                <svg className="mr-2 h-4 w-4 fill-foreground" viewBox="0 0 24 24">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
                </svg>
                Apple
              </Button>
            </div>
            
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
