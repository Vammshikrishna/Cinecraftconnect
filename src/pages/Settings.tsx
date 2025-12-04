import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell, Shield, Eye, Download,
  User, Lock, Volume2, Palette,
  Settings as SettingsIcon, ChevronRight, ArrowLeft
} from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();

  const settingsSections = [
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Theme, font size, and language preferences',
      icon: Palette,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      path: '/settings/appearance'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Manage how you receive notifications',
      icon: Bell,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      path: '/settings/notifications'
    },
    {
      id: 'privacy',
      title: 'Privacy',
      description: 'Control your privacy and data visibility',
      icon: Lock,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      path: '/settings/privacy'
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Password, 2FA, and active sessions',
      icon: Shield,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      path: '/settings/security'
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      description: 'High contrast mode and motion settings',
      icon: Eye,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      path: '/settings/accessibility'
    },
    {
      id: 'sound',
      title: 'Sound',
      description: 'Sound effects and notification sounds',
      icon: Volume2,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      path: '/settings/sound'
    },
    {
      id: 'data',
      title: 'Data & Privacy',
      description: 'Export data and manage retention',
      icon: Download,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      path: '/settings/data'
    },
    {
      id: 'account',
      title: 'Account',
      description: 'Sign out and account management',
      icon: User,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      path: '/settings/account'
    }
  ];

  return (
    <div className="min-h-screen bg-background pt-20 pb-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="h-9 w-9 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your account preferences and application settings
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 group"
                onClick={() => navigate(section.path)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${section.bgColor}`}>
                      <Icon className={`h-6 w-6 ${section.color}`} />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Info */}
        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">💡 Quick Tip</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click on any card above to customize your settings. Changes are saved automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
