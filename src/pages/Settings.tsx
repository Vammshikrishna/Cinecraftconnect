
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  LogOut, 
  Settings as SettingsIcon
} from 'lucide-react';

const Settings = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <SettingsIcon className="mr-3 h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
              <TabsTrigger 
                value="account" 
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <User className="mr-2 h-4 w-4" />
                Account
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="privacy"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Shield className="mr-2 h-4 w-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger 
                value="appearance"
                className="flex items-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <Palette className="mr-2 h-5 w-5" />
                    Appearance Settings
                  </CardTitle>
                  <CardDescription>
                    Customize the look and feel of your CineCraft Connect experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
                    <div className="space-y-1">
                      <h3 className="text-foreground font-medium">Theme</h3>
                      <p className="text-sm text-muted-foreground">
                        Toggle between light and dark mode
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-foreground font-medium">Color Scheme</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {['Primary', 'Secondary', 'Accent'].map((color) => (
                        <div
                          key={color}
                          className="p-4 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors"
                        >
                          <div className={`w-full h-8 rounded mb-2 ${
                            color === 'Primary' ? 'bg-primary' :
                            color === 'Secondary' ? 'bg-secondary' :
                            'bg-accent'
                          }`}></div>
                          <p className="text-sm text-foreground text-center">{color}</p>
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
