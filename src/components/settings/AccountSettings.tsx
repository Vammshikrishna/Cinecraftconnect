import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User, Mail, LogOut, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AccountSettings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center">
          <User className="mr-2 h-5 w-5" />
          Account Settings
        </CardTitle>
        <CardDescription>
          Manage your account security and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="flex items-center">
            <Mail className="mr-1 h-4 w-4" />
            Email Address
          </Label>
          <Input
            value={user?.email || ''}
            disabled
            className="bg-muted border-border text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Email cannot be changed. Contact support if you need to update it.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">Password</h3>
          <Button variant="outline" size="sm" className="border-border">
            Change Password
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </h3>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50 mb-4">
            <div className="space-y-1">
              <h4 className="text-foreground font-medium">Theme</h4>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark mode
              </p>
            </div>
            <ThemeToggle />
          </div>
          <div className="space-y-3">
            <h4 className="text-foreground font-medium">Color Scheme</h4>
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
        </div>

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

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" size="sm">
            Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
