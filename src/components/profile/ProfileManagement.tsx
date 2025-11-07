import { useState, useEffect } from 'react';
import { User, Camera, Globe, MapPin, Calendar, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  username: string;
  full_name: string;
  bio: string;
  craft: string;
  location: string;
  website: string;
  avatar_url: string;
}

const ProfileManagement = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    username: '',
    full_name: '',
    bio: '',
    craft: '',
    location: '',
    website: '',
    avatar_url: ''
  });

  const crafts = [
    'Director', 'Producer', 'Screenwriter', 'Cinematographer', 'Editor',
    'Actor', 'Composer', 'Sound Designer', 'Production Designer',
    'Costume Designer', 'Makeup Artist', 'VFX Artist', 'Gaffer',
    'Script Supervisor', 'Casting Director', 'Location Manager'
  ];

  useEffect(() => {
    if (profile) {
      setProfileData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        craft: profile.craft || '',
        location: profile.location || '',
        website: profile.website || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolios')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('portfolios')
      .getPublicUrl(fileName);

    setProfileData(prev => ({ ...prev, avatar_url: data.publicUrl }));
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: profileData.username || null,
          full_name: profileData.full_name || null,
          bio: profileData.bio || null,
          craft: profileData.craft || null,
          location: profileData.location || null,
          website: profileData.website || null,
          avatar_url: profileData.avatar_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Management
          </CardTitle>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  // Reset form
                  if (profile) {
                    setProfileData({
                      username: profile.username || '',
                      full_name: profile.full_name || '',
                      bio: profile.bio || '',
                      craft: profile.craft || '',
                      location: profile.location || '',
                      website: profile.website || '',
                      avatar_url: profile.avatar_url || ''
                    });
                  }
                }}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profileData.avatar_url} />
              <AvatarFallback className="text-lg">
                {getInitials(profileData.full_name || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          
          {isEditing && (
            <EnhancedFileUpload
              onFileUpload={handleAvatarUpload}
              accept="image/*"
              maxSize={5}
              className="w-full max-w-xs"
            >
              <div className="p-4">
                <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Upload Avatar</p>
              </div>
            </EnhancedFileUpload>
          )}
        </div>

        {/* Profile Fields */}
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              {isEditing ? (
                <Input
                  placeholder="Enter username"
                  value={profileData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {profileData.username || 'Not set'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              {isEditing ? (
                <Input
                  placeholder="Enter full name"
                  value={profileData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {profileData.full_name || 'Not set'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            {isEditing ? (
              <Textarea
                placeholder="Tell us about yourself..."
                value={profileData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {profileData.bio || 'No bio provided'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Craft/Role</label>
              {isEditing ? (
                <Select 
                  value={profileData.craft} 
                  onValueChange={(value) => handleInputChange('craft', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your craft" />
                  </SelectTrigger>
                  <SelectContent>
                    {crafts.map((craft) => (
                      <SelectItem key={craft} value={craft}>
                        {craft}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {profileData.craft || 'Not specified'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </label>
              {isEditing ? (
                <Input
                  placeholder="Enter location"
                  value={profileData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {profileData.location || 'Not specified'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </label>
            {isEditing ? (
              <Input
                placeholder="https://yourwebsite.com"
                value={profileData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {profileData.website ? (
                  <a 
                    href={profileData.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {profileData.website}
                  </a>
                ) : (
                  'No website provided'
                )}
              </p>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-2">Account Information</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Email: {user?.email}</p>
            <p className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Joined: {new Date(user?.created_at || '').toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileManagement;