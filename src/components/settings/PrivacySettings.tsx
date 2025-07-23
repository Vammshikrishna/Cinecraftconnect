
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Shield, Eye, Users, Globe, Lock } from 'lucide-react';

export const PrivacySettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    profile_visibility: true,
    portfolio_visibility: true,
    contact_visibility: true,
    project_visibility: true,
    activity_visibility: false,
    search_visibility: true,
    analytics_tracking: true,
    data_collection: false,
  });

  const handleToggle = (setting: string) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Privacy Settings Updated",
        description: "Your privacy preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "There was an error saving your privacy settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const privacyGroups = [
    {
      title: "Profile Visibility",
      icon: Eye,
      settings: [
        { key: 'profile_visibility', label: 'Public Profile', description: 'Allow others to view your profile' },
        { key: 'portfolio_visibility', label: 'Portfolio Visibility', description: 'Show your portfolio to other users' },
        { key: 'contact_visibility', label: 'Contact Information', description: 'Display your contact details' },
      ]
    },
    {
      title: "Activity & Content",
      icon: Users,
      settings: [
        { key: 'project_visibility', label: 'Project Participation', description: 'Show projects you\'re involved in' },
        { key: 'activity_visibility', label: 'Activity Feed', description: 'Show your activity in public feeds' },
        { key: 'search_visibility', label: 'Search Visibility', description: 'Allow others to find you in search' },
      ]
    },
    {
      title: "Data & Analytics",
      icon: Shield,
      settings: [
        { key: 'analytics_tracking', label: 'Analytics Tracking', description: 'Help improve the platform with usage data' },
        { key: 'data_collection', label: 'Extended Data Collection', description: 'Additional data for personalization' },
      ]
    },
  ];

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control who can see your information and how it's used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {privacyGroups.map((group, index) => (
          <div key={group.title}>
            <div className="flex items-center mb-4">
              <group.icon className="mr-2 h-5 w-5 text-cinesphere-purple" />
              <h3 className="text-lg font-semibold text-white">{group.title}</h3>
            </div>
            <div className="space-y-4">
              {group.settings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor={setting.key} className="text-white">
                      {setting.label}
                    </Label>
                    <p className="text-sm text-gray-400">{setting.description}</p>
                  </div>
                  <Switch
                    id={setting.key}
                    checked={settings[setting.key]}
                    onCheckedChange={() => handleToggle(setting.key)}
                  />
                </div>
              ))}
            </div>
            {index < privacyGroups.length - 1 && <Separator className="mt-6 bg-white/10" />}
          </div>
        ))}
        
        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center space-x-2 mb-4">
            <Lock className="h-5 w-5 text-red-400" />
            <h3 className="text-lg font-semibold text-white">Data Management</h3>
          </div>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start border-white/10 hover:bg-white/5">
              Download My Data
            </Button>
            <Button variant="outline" className="w-full justify-start border-red-500/20 text-red-400 hover:bg-red-500/10">
              Delete My Account
            </Button>
          </div>
        </div>
        
        <div className="pt-6">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
          >
            {loading ? 'Saving...' : 'Save Privacy Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
