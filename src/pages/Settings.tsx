
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  LogOut, 
  Settings as SettingsIcon,
  Moon,
  Sun
} from 'lucide-react';

const Settings = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Sign Out Failed",
        description: "There was an error signing out.",
        variant: "destructive",
      });
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Update CSS variables for theme switching
    const root = document.documentElement;
    if (newTheme === 'light') {
      root.style.setProperty('--background', '0 0% 100%');
      root.style.setProperty('--foreground', '224 71.4% 4.1%');
      root.style.setProperty('--card', '0 0% 100%');
      root.style.setProperty('--card-foreground', '224 71.4% 4.1%');
      root.style.setProperty('--primary', '220.9 39.3% 11%');
      root.style.setProperty('--primary-foreground', '210 20% 98%');
    } else {
      root.style.setProperty('--background', '20 14.3% 4.1%');
      root.style.setProperty('--foreground', '0 0% 95%');
      root.style.setProperty('--card', '24 9.8% 10%');
      root.style.setProperty('--card-foreground', '0 0% 95%');
      root.style.setProperty('--primary', '263.4 70% 50.4%');
      root.style.setProperty('--primary-foreground', '210 20% 98%');
    }
    
    toast({
      title: "Theme Updated",
      description: `Switched to ${newTheme} theme.`,
    });
  };

  return (
    <div className="min-h-screen bg-cinesphere-dark pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <SettingsIcon className="mr-3 h-8 w-8" />
              Settings
            </h1>
            <p className="text-gray-400">
              Manage your account settings and preferences
            </p>
          </div>

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-cinesphere-dark/50 border border-white/10">
              <TabsTrigger 
                value="account" 
                className="flex items-center data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                <User className="mr-2 h-4 w-4" />
                Account
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="flex items-center data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="privacy"
                className="flex items-center data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                <Shield className="mr-2 h-4 w-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger 
                value="appearance"
                className="flex items-center data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                <Palette className="mr-2 h-4 w-4" />
                Appearance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <AccountSettings />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="privacy">
              <PrivacySettings />
            </TabsContent>

            <TabsContent value="appearance">
              <Card className="border-white/10 bg-cinesphere-dark/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Palette className="mr-2 h-5 w-5" />
                    Appearance Settings
                  </CardTitle>
                  <CardDescription>
                    Customize the look and feel of your CineSphere experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-white font-medium">Theme</h3>
                      <p className="text-sm text-gray-400">
                        Choose between light and dark themes
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleTheme}
                      className="border-white/20 hover:bg-white/10"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="mr-2 h-4 w-4" />
                          Light Theme
                        </>
                      ) : (
                        <>
                          <Moon className="mr-2 h-4 w-4" />
                          Dark Theme
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-medium">Color Scheme</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {['Purple', 'Blue', 'Green'].map((color) => (
                        <div
                          key={color}
                          className="p-4 rounded-lg border border-white/10 cursor-pointer hover:border-cinesphere-purple/50 transition-colors"
                        >
                          <div className={`w-full h-8 rounded mb-2 ${
                            color === 'Purple' ? 'bg-cinesphere-purple' :
                            color === 'Blue' ? 'bg-cinesphere-blue' :
                            'bg-green-500'
                          }`}></div>
                          <p className="text-sm text-white text-center">{color}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="mt-8 border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-red-400">Account Actions</CardTitle>
              <CardDescription>
                Manage your account and session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
