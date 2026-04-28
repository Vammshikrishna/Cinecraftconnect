
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { useUserSettings } from '@/hooks/useUserSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Moon, Sun, Monitor } from 'lucide-react';

const ThemeSyncPrompt = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting, loading } = useUserSettings();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only run this if the user is logged in, settings are loaded, and we haven't prompted this session
    const hasPrompted = sessionStorage.getItem('theme_sync_prompted');
    
    if (user && !loading && settings && !hasPrompted) {
      // Check if local theme differs from saved setting
      // Local theme is what they chose on the landing page
      // settings.theme is what's in the DB (usually 'system' by default for new users)
      if (theme !== settings.theme) {
        setShowPrompt(true);
      }
    }
  }, [user, loading, settings, theme]);

  const handleKeepCurrent = async () => {
    // Update DB to match local choice
    await updateSetting('theme', theme);
    sessionStorage.setItem('theme_sync_prompted', 'true');
    setShowPrompt(false);
  };

  const handleSwitchToSaved = () => {
    // Update local to match DB
    if (settings?.theme) {
      setTheme(settings.theme);
    }
    sessionStorage.setItem('theme_sync_prompted', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AlertDialog open={showPrompt} onOpenChange={setShowPrompt}>
      <AlertDialogContent className="glass-card-premium border-white/10 max-w-md">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            {theme === 'dark' ? <Moon size={24} /> : theme === 'light' ? <Sun size={24} /> : <Monitor size={24} />}
          </div>
          <AlertDialogTitle className="text-2xl font-bold">Keep your appearance?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400 text-lg">
            We noticed you're using <span className="text-white font-bold">{theme} mode</span>. 
            Would you like to keep this as your default appearance for CineCraft Connect?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-8">
          <AlertDialogCancel 
            onClick={handleSwitchToSaved}
            className="rounded-xl border-white/10 hover:bg-white/5"
          >
            Switch to {settings?.theme || 'System'}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleKeepCurrent}
            className="rounded-xl bg-primary text-white font-bold hover:scale-105 transition-all"
          >
            Keep {theme} Mode
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ThemeSyncPrompt;
