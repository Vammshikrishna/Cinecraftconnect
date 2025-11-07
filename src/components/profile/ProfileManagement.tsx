import { useState, useEffect } from 'react';
import { User, Camera, Globe, MapPin, Calendar, Edit, Save, X, Plus, Star, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  skills: string[];
}

const ProfileManagement = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [profileData, setProfileData] = useState<ProfileData>({
    username: '',
    full_name: '',
    bio: '',
    craft: '',
    location: '',
    website: '',
    avatar_url: '',
    skills: []
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
        avatar_url: profile.avatar_url || '',
        skills: Array.isArray(profile.skills) ? profile.skills : []
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof Omit<ProfileData, 'skills'>, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSkillAdd = () => {
    if (skillInput.trim() && !profileData.skills.includes(skillInput.trim())) {
      setProfileData(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
      setSkillInput('');
    }
  };

  const handleSkillRemove = (skillToRemove: string) => {
    setProfileData(prev => ({ ...prev, skills: prev.skills.filter(skill => skill !== skillToRemove) }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) throw new Error('User not authenticated');
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolios')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName);
    const newAvatarUrl = `${data.publicUrl}?t=${new Date().getTime()}`;
    setProfileData(prev => ({ ...prev, avatar_url: newAvatarUrl }));
    return newAvatarUrl;
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
          skills: profileData.skills,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: "Profile updated", description: "Your profile has been successfully updated." });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getInitials = (name: string): string => {
    if (!name || !name.trim()) {
      return '';
    }
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => Array.from(word)[0].toUpperCase())
      .join('')
      .slice(0, 2);
  };

  // View Mode Component
  const renderViewMode = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <Avatar className="h-28 w-28 border-4 border-primary/20">
          <AvatarImage src={profileData.avatar_url} />
          <AvatarFallback className="text-3xl">{getInitials(profileData.full_name || user?.email || 'U')}</AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-bold">{profileData.full_name}</h2>
          <p className="text-md text-muted-foreground">@{profileData.username}</p>
          {profileData.craft && <Badge variant="secondary" className="mt-2"><Award className="h-3 w-3 mr-1.5" />{profileData.craft}</Badge>}
        </div>
      </div>

      {profileData.bio && <p className="text-center md:text-left">{profileData.bio}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {profileData.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/><span>{profileData.location}</span></div>}
        {profileData.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground"/><a href={profileData.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{profileData.website}</a></div>}
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground"/><span>Joined: {new Date(user?.created_at || '').toLocaleDateString()}</span></div>
        <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/><span>Email: {user?.email}</span></div>
      </div>

      {profileData.skills.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2"><Star className="h-4 w-4"/>Skills & Expertise</h4>
          <div className="flex flex-wrap gap-2">
            {profileData.skills.map(skill => <Badge key={skill}>{skill}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );

  // Edit Mode Component
  const renderEditMode = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <EnhancedFileUpload onFileUpload={handleAvatarUpload} accept="image/*" maxSize={5}>
          <div className="relative cursor-pointer group">
            <Avatar className="h-28 w-28">
              <AvatarImage src={profileData.avatar_url} />
              <AvatarFallback className="text-3xl">{getInitials(profileData.full_name || user?.email || 'U')}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
        </EnhancedFileUpload>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Username" value={profileData.username} onChange={e => handleInputChange('username', e.target.value)} />
        <Input placeholder="Full Name" value={profileData.full_name} onChange={e => handleInputChange('full_name', e.target.value)} />
      </div>

      <Textarea placeholder="Tell us about yourself..." value={profileData.bio} onChange={e => handleInputChange('bio', e.target.value)} rows={4} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select value={profileData.craft} onValueChange={value => handleInputChange('craft', value)}>
          <SelectTrigger><SelectValue placeholder="Select your craft" /></SelectTrigger>
          <SelectContent>{crafts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Location" value={profileData.location} onChange={e => handleInputChange('location', e.target.value)} />
      </div>
      
      <Input placeholder="https://yourwebsite.com" value={profileData.website} onChange={e => handleInputChange('website', e.target.value)} />

      <div>
        <label className="text-sm font-medium">Skills & Expertise</label>
        <div className="flex items-center gap-2 mt-2">
          <Input placeholder="Add a skill (e.g., 'Directing')" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSkillAdd();
              }
            }} />
          <Button type="button" variant="outline" onClick={handleSkillAdd}><Plus className="h-4 w-4 mr-2"/>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {profileData.skills.map(skill => (
            <Badge key={skill} variant="secondary" className="flex items-center gap-1.5">
              {skill}
              <X className="h-3 w-3 cursor-pointer" onClick={() => handleSkillRemove(skill)} />
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              My Profile
            </CardTitle>
            <CardDescription>View and manage your professional presence.</CardDescription>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}><X className="h-4 w-4 mr-2"/>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}><Save className="h-4 w-4 mr-2"/>{isSubmitting ? 'Saving...' : 'Save'}</Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? renderEditMode() : renderViewMode()}
      </CardContent>
    </Card>
  );
};

export default ProfileManagement;
