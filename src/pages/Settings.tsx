
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Trash2, User, Mail, Bell, Shield, Eye, Globe, Save, Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SettingsPage = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [projectNotifications, setProjectNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  
  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showEmail, setShowEmail] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  
  // Accessibility settings
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  // Profile data
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, bio')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setFullName(data.full_name || '');
        setBio(data.bio || '');
      }
    };
    
    loadUserProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, bio: bio })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Simulate data export
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: "Export Complete",
        description: "Your data has been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    toast({ 
      title: "Account Deletion", 
      description: "Please contact support to delete your account.",
      variant: "destructive"
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8 pt-16 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">Manage your application preferences and account settings.</p>
        </header>

        <div className="grid gap-8">
          {/* Profile Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself"
                  rows={4}
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel of the application</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <Label htmlFor="theme-toggle" className="font-medium">Theme</Label>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          {/* Notifications Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Control how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="email-notifications" className="font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch 
                  id="email-notifications" 
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="push-notifications" className="font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive browser notifications</p>
                </div>
                <Switch 
                  id="push-notifications" 
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="project-notifications" className="font-medium">Project Updates</Label>
                  <p className="text-sm text-muted-foreground">New projects and opportunities</p>
                </div>
                <Switch 
                  id="project-notifications" 
                  checked={projectNotifications}
                  onCheckedChange={setProjectNotifications}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="message-notifications" className="font-medium">Messages</Label>
                  <p className="text-sm text-muted-foreground">Direct messages and chats</p>
                </div>
                <Switch 
                  id="message-notifications" 
                  checked={messageNotifications}
                  onCheckedChange={setMessageNotifications}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="comment-notifications" className="font-medium">Comments & Mentions</Label>
                  <p className="text-sm text-muted-foreground">When someone comments or mentions you</p>
                </div>
                <Switch 
                  id="comment-notifications" 
                  checked={commentNotifications}
                  onCheckedChange={setCommentNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Privacy
              </CardTitle>
              <CardDescription>Control your privacy and data visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="show-email" className="font-medium">Show Email</Label>
                  <p className="text-sm text-muted-foreground">Display email on public profile</p>
                </div>
                <Switch 
                  id="show-email" 
                  checked={showEmail}
                  onCheckedChange={setShowEmail}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="show-location" className="font-medium">Show Location</Label>
                  <p className="text-sm text-muted-foreground">Display location on public profile</p>
                </div>
                <Switch 
                  id="show-location" 
                  checked={showLocation}
                  onCheckedChange={setShowLocation}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Protect your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                    <div>
                        <Label className="font-medium">Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Button variant="outline" className="border-border">Enable</Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                    <div>
                        <Label className="font-medium">Change Password</Label>
                        <p className="text-sm text-muted-foreground">Update your password regularly</p>
                    </div>
                    <Button variant="outline" className="border-border">Change</Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                    <div>
                        <Label className="font-medium">Active Sessions</Label>
                        <p className="text-sm text-muted-foreground">Manage your login sessions</p>
                    </div>
                    <Button variant="outline" className="border-border">View</Button>
                </div>
            </CardContent>
          </Card>

          {/* Accessibility Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Accessibility
              </CardTitle>
              <CardDescription>Make the app easier to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="high-contrast" className="font-medium">High Contrast Mode</Label>
                  <p className="text-sm text-muted-foreground">Increase color contrast</p>
                </div>
                <Switch 
                  id="high-contrast" 
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                <div>
                  <Label htmlFor="reduce-motion" className="font-medium">Reduce Motion</Label>
                  <p className="text-sm text-muted-foreground">Minimize animations</p>
                </div>
                <Switch 
                  id="reduce-motion" 
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Data & Privacy Settings */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Data & Privacy
              </CardTitle>
              <CardDescription>Manage your data and privacy settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                  <div className="flex-grow pr-4">
                     <Label className="font-medium">Export Your Data</Label>
                     <p className="text-sm text-muted-foreground">Download a copy of your account data</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="border-border"
                  >
                    {isExporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </>
                    )}
                  </Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                  <div className="flex-grow pr-4">
                     <Label className="font-medium">Data Retention</Label>
                     <p className="text-sm text-muted-foreground">Control how long we keep your data</p>
                  </div>
                  <Button variant="outline" className="border-border">Manage</Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-foreground mb-2">Account Actions</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="border-border"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </Button>
                </div>
        
                <div className="pt-4 border-t border-border mt-4">
                  <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-modal border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">Continue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
