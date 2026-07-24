import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { AlertCircle, WifiOff, ArrowRight, Eye, EyeOff } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/* ─── Design Tokens ─────────────────────────── */
const CREAM  = '#F8F5F0';
const INK    = '#0D0D0D';
const ORANGE = '#f97316';
const SERIF  = "'Lora', Georgia, serif";
const MONO   = "'Inconsolata', 'Courier New', monospace";
const SANS   = "'Work Sans', system-ui, sans-serif";

/* ─── Validation ────────────────────────────── */
const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
const signUpSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/* ─── Slug eyebrow ──────────────────────────── */
const Slug = ({ text }: { text: string }) => (
  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.35)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, display: 'inline-block' }} />
    {text}
  </div>
);

/* ─── Input field ───────────────────────────── */
const Field = ({
  type, placeholder, value, onChange, disabled, error,
}: { type: string; placeholder: string; value: string; onChange: (v: string) => void; disabled?: boolean; error?: string }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 4, position: 'relative' }}>
      <input
        type={inputType}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          fontFamily: MONO, width: '100%', background: 'transparent', border: 'none',
          borderBottom: `1px solid ${error ? '#ef4444' : 'rgba(13,13,13,0.18)'}`,
          padding: '12px 0', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: INK, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
          paddingRight: isPassword ? '40px' : '0'
        }}
        onFocus={e => { if (!error) e.currentTarget.style.borderBottomColor = ORANGE; }}
        onBlur={e => { if (!error) e.currentTarget.style.borderBottomColor = 'rgba(13,13,13,0.18)'; }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute', right: 0, top: '10px',
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.4)',
            padding: '4px'
          }}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
      {error && <p style={{ fontFamily: MONO, fontSize: 10, color: '#ef4444', marginTop: 6, fontWeight: 700, letterSpacing: '0.1em' }}>{error}</p>}
    </div>
  );
};

/* ─── Google SVG icon ───────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

/* ─── Apple SVG icon ────────────────────────── */
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.1-44.6-35.9-2.8-74.3 22.7-93.1 22.7-18.9 0-50-22.3-80.1-21.7-41.1 .5-79.6 24-100.8 61.2-43.2 76.5-11 189.6 30.6 249.7 20.6 29.5 45.4 62.7 77.2 61.7 30.6-1 41.7-19.6 78.4-19.6 36.6 0 46.7 19.6 78.9 19 33.3-.6 54.4-30.8 74.8-60.6 23.9-35.1 33.7-69.1 34.3-70.9-1-1-66-24.8-66.1-112.5zM263.8 89.2c20.3-24.5 34-58.4 30.3-92.2-28.5 1.1-64.4 19-85.3 43.6-16.7 19.4-32.9 54.1-28.4 87.1 31.9 2.5 63.2-13.9 83.4-38.5z"/>
  </svg>
);

/* ─── Divider ───────────────────────────────── */
const Divider = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
    <div style={{ flex: 1, height: 1, background: 'rgba(13,13,13,0.1)' }} />
    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.35)' }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: 'rgba(13,13,13,0.1)' }} />
  </div>
);

/* ─── Auth Page ─────────────────────────────── */
const Auth = () => {
  const location = useLocation();
  const { push } = useAppNavigation();
  const [isLogin, setIsLogin] = useState(location.pathname !== '/register');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const { signIn, signUp, signInWithProvider, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [previousEmail, setPreviousEmail] = useState<string | null>(null);
  const [previousUsername, setPreviousUsername] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const queryParams = new URLSearchParams(location.search);
      const redirectUrl = queryParams.get('redirect') || (location.state as any)?.from?.pathname;
      push(redirectUrl ? decodeURIComponent(redirectUrl) : '/feed', { noScroll: true });
    }
  }, [user]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const emailParam = queryParams.get('email');
    const errorParam = queryParams.get('error');
    const prevUserId = queryParams.get('previous_user_id');
    if (emailParam) setFormData(prev => ({ ...prev, email: decodeURIComponent(emailParam) }));
    if (errorParam === 'session_expired') setErrors(prev => ({ ...prev, form: 'Your session has expired. Please sign in again.' }));
    try {
      const saved = localStorage.getItem('cinecraft_saved_accounts');
      if (saved) {
        const accounts = JSON.parse(saved);
        const targetAcc = accounts.find((a: any) => a.userId === prevUserId) || accounts[0];
        if (targetAcc) { setPreviousEmail(targetAcc.email); setPreviousUsername(targetAcc.username); }
      }
    } catch (e) {}
  }, [location.search]);

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
      result.error.issues.forEach(err => { if (err.path) newErrors[err.path[0] as string] = err.message; });
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
            setErrors({ form: `Too many failed attempts. Account locked for ${delaySeconds} seconds.` });
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
          toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
          const queryParams = new URLSearchParams(location.search);
          const redirectUrl = queryParams.get('redirect') || (location.state as any)?.from?.pathname;
          if (redirectUrl) { push(decodeURIComponent(redirectUrl), { noScroll: true }); return; }
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user) {
              const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id).maybeSingle();
              const roleStr = roleData?.role as string | undefined;
              if (roleStr === 'super_admin') { push('/super-admin', { noScroll: true }); return; }
              else if (roleStr === 'admin') { push('/admin', { noScroll: true }); return; }
              else if (roleStr === 'moderator') { push('/moderation', { noScroll: true }); return; }
            }
          } catch (e) { console.error('Error checking role after sign in', e); }
          push('/feed', { noScroll: true });
        } else {
          toast({ title: 'Account created!', description: 'Please complete your profile.' });
          push('/complete-profile', { noScroll: true });
        }
      }
    } catch (err) {
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (!isOnline) return;
    setOauthLoading(provider);
    try {
      const { error } = await signInWithProvider(provider);
      if (error) setErrors({ form: `${provider === 'google' ? 'Google' : 'Apple'} sign-in failed. Please try again.` });
    } catch {
      setErrors({ form: 'Sign-in failed. Please try again.' });
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleAuthAction(isLogin ? 'signIn' : 'signUp'); };
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen" style={{ background: CREAM, color: INK, fontFamily: SANS }}>

      {/* ── LEFT BRAND PANEL ────────────────── */}
      <div
        className="hidden md:flex flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: INK, color: CREAM }}
      >
        {/* Dot grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none', backgroundImage: `radial-gradient(#F8F5F0 1px, transparent 0)`, backgroundSize: '28px 28px' }} />
        {/* Orange corner accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '40%', background: ORANGE }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppLogo size="lg" to="/" textColor="cream" />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 340 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: ORANGE, marginBottom: 20 }}>
            [ The Entertainment Industry Network ]
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 300, lineHeight: 1.35, color: CREAM }}>
            One platform for every creator in the industry — films, TV, YouTube, ads, music, and more.
          </h2>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Professional crew discovery across all formats',
              'End-to-end encrypted project spaces',
              'Job board spanning every entertainment format',
              'Verified equipment marketplace',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(248,245,240,0.6)' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: ORANGE, flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(248,245,240,0.2)' }}>
          © CineCraft Connect 2026 — All Pipelines Secured
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ────────────────── */}
      <div className="flex flex-col justify-center p-6 md:p-16 overflow-y-auto" style={{ background: CREAM }}>
        <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>

          {/* Mobile logo */}
          <div className="md:hidden" style={{ marginBottom: 40 }}>
            <AppLogo size="sm" to="/" textColor="ink" />
          </div>

          <Slug text={isLogin ? 'INT. Stage Gate — Sign In' : 'INT. Crew Entry — Create Account'} />
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 300, color: INK, marginBottom: 8 }}>
            {isLogin ? 'Welcome back.' : 'Join the network.'}
          </h1>
          <p style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(13,13,13,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 32 }}>
            {isLogin ? 'Sign in to your account' : 'Create your free account'}
          </p>

          {/* Offline warning */}
          {!isOnline && (
            <div style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', borderRadius: 2 }}>
              <WifiOff size={14} style={{ color: '#b45309', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#b45309' }}>Offline — authentication is disabled until network is restored.</span>
            </div>
          )}

          {/* Form error */}
          {errors.form && (
            <div style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)', padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 2 }}>
              <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#ef4444' }}>{errors.form}</span>
            </div>
          )}

          {/* Returning user */}
          {previousEmail && (
            <div style={{ border: '1px solid rgba(13,13,13,0.1)', background: 'rgba(13,13,13,0.03)', padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.4)', marginBottom: 2 }}>Returning User</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{previousUsername || previousEmail}</div>
              </div>
              <button type="button" onClick={() => handleInputChange('email', previousEmail)}
                style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ORANGE, background: 'none', border: 'none', cursor: 'pointer' }}>
                Auto Fill
              </button>
            </div>
          )}

          {/* ── OAuth Buttons ─────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
            {/* Google */}
            <button
              type="button"
              disabled={!isOnline || oauthLoading !== null}
              onClick={() => handleOAuth('google')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '13px 20px', border: '1px solid rgba(13,13,13,0.18)', background: '#fff',
                cursor: !isOnline || oauthLoading !== null ? 'not-allowed' : 'pointer',
                fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#3c4043', borderRadius: 2,
                transition: 'all 0.2s', opacity: !isOnline ? 0.5 : 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(13,13,13,0.35)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(13,13,13,0.18)'; }}
            >
              <GoogleIcon />
              {oauthLoading === 'google' ? 'Connecting...' : `Continue with Google`}
            </button>

            {/* Apple */}
            <button
              type="button"
              disabled={!isOnline || oauthLoading !== null}
              onClick={() => handleOAuth('apple')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '13px 20px', border: '1px solid rgba(13,13,13,0.18)', background: INK,
                cursor: !isOnline || oauthLoading !== null ? 'not-allowed' : 'pointer',
                fontFamily: SANS, fontSize: 13, fontWeight: 600, color: '#ffffff', borderRadius: 2,
                transition: 'all 0.2s', opacity: !isOnline ? 0.5 : 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
            >
              <AppleIcon />
              {oauthLoading === 'apple' ? 'Connecting...' : `Continue with Apple`}
            </button>
          </div>

          <Divider label="or continue with email" />

          {/* ── Email/Password Form ────────────── */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Field
              type="email" placeholder="Email address"
              value={formData.email} onChange={v => handleInputChange('email', v)}
              disabled={isLoading || !isOnline} error={errors.email}
            />
            <Field
              type="password" placeholder="Password"
              value={formData.password} onChange={v => handleInputChange('password', v)}
              disabled={isLoading || !isOnline} error={errors.password}
            />

            <button
              type="submit"
              disabled={isLoading || !isOnline}
              style={{
                width: '100%', padding: '14px 20px', background: isLoading ? 'rgba(13,13,13,0.5)' : INK,
                color: CREAM, border: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: isLoading || !isOnline ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'background 0.25s', borderRadius: 2,
              }}
              onMouseEnter={e => { if (!isLoading && isOnline) (e.currentTarget as HTMLButtonElement).style.background = ORANGE; }}
              onMouseLeave={e => { if (!isLoading && isOnline) (e.currentTarget as HTMLButtonElement).style.background = INK; }}
            >
              {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
              {!isLoading && <ArrowRight size={14} />}
            </button>
          </form>

          {/* Toggle */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
              disabled={isLoading}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.45)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = ORANGE; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(13,13,13,0.45)'; }}
            >
              {isLogin ? '→ Create a new account' : '← Back to sign in'}
            </button>
          </div>

          {/* Terms note */}
          <p style={{ marginTop: 28, fontSize: 11, color: 'rgba(13,13,13,0.35)', lineHeight: 1.6, textAlign: 'center' }}>
            By continuing, you agree to CineCraft Connect's{' '}
            <Link to="/terms" style={{ color: 'rgba(13,13,13,0.6)', textDecoration: 'underline' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: 'rgba(13,13,13,0.6)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>

          {/* Back to landing */}
          <div style={{ marginTop: 32, textAlign: 'center', paddingTop: 24, borderTop: '1px solid rgba(13,13,13,0.08)' }}>
            <Link to="/" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.35)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = ORANGE)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(13,13,13,0.35)')}
            >
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
