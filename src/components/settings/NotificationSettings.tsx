
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, MessageCircle, Heart, Users, Briefcase } from 'lucide-react';

export const NotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    post_likes: true,
    post_comments: true,
    new_followers: true,
    direct_messages: true,
    project_updates: true,
    collaboration_requests: true,
    discussion_room_activity: false,
    marketing_emails: false,
  });

  const handleToggle = (setting: string) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // In a real app, this would save to the database
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Settings Saved",
        description: "Your notification preferences have been updated.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "There was an error saving your preferences.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const notificationGroups = [
    {
      title: "General",
      icon: Bell,
      settings: [
        { key: 'email_notifications', label: 'Email Notifications', description: 'Receive notifications via email' },
        { key: 'push_notifications', label: 'Push Notifications', description: 'Receive browser push notifications' },
      ]
    },
    {
      title: "Social Activity",
      icon: Heart,
      settings: [
        { key: 'post_likes', label: 'Post Likes', description: 'When someone likes your posts' },
        { key: 'post_comments', label: 'Post Comments', description: 'When someone comments on your posts' },
        { key: 'new_followers', label: 'New Followers', description: 'When someone follows you' },
      ]
    },
    {
      title: "Messages",
      icon: MessageCircle,
      settings: [
        { key: 'direct_messages', label: 'Direct Messages', description: 'When you receive a direct message' },
        { key: 'discussion_room_activity', label: 'Discussion Room Activity', description: 'Activity in discussion rooms you\'ve joined' },
      ]
    },
    {
      title: "Projects & Collaborations",
      icon: Briefcase,
      settings: [
        { key: 'project_updates', label: 'Project Updates', description: 'Updates on projects you\'re involved with' },
        { key: 'collaboration_requests', label: 'Collaboration Requests', description: 'When someone wants to collaborate' },
      ]
    },
    {
      title: "Marketing",
      icon: Mail,
      settings: [
        { key: 'marketing_emails', label: 'Marketing Emails', description: 'Product updates and promotional content' },
      ]
    },
  ];

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Bell className="mr-2 h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage how you receive notifications and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationGroups.map((group, index) => (
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
            {index < notificationGroups.length - 1 && <Separator className="mt-6 bg-white/10" />}
          </div>
        ))}
        
        <div className="pt-6">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
