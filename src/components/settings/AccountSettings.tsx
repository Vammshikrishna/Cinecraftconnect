
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Globe, MapPin, Briefcase } from 'lucide-react';

export const AccountSettings = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    craft: '',
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        craft: profile.craft || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update Failed",
        description: "There was an error updating your profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <User className="mr-2 h-5 w-5" />
          Account Settings
        </CardTitle>
        <CardDescription>
          Manage your account information and public profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              className="bg-white/5 border-white/10 min-h-[100px]"
              placeholder="Tell others about yourself..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center">
                <MapPin className="mr-1 h-4 w-4" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="bg-white/5 border-white/10"
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="craft" className="flex items-center">
                <Briefcase className="mr-1 h-4 w-4" />
                Primary Craft
              </Label>
              <Input
                id="craft"
                value={formData.craft}
                onChange={(e) => handleChange('craft', e.target.value)}
                className="bg-white/5 border-white/10"
                placeholder="e.g., Director, Cinematographer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center">
              <Globe className="mr-1 h-4 w-4" />
              Website
            </Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="bg-white/5 border-white/10"
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              <Mail className="mr-1 h-4 w-4" />
              Email Address
            </Label>
            <Input
              value={user?.email || ''}
              disabled
              className="bg-gray-800 border-white/10 text-gray-400"
            />
            <p className="text-sm text-gray-500">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
