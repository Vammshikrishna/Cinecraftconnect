import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Volume2 } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

const SoundSettings = () => {
    const navigate = useNavigate();
    const { settings, loading, updateSetting } = useUserSettings();

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-20 pb-32">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <EnhancedSkeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-20 pb-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Settings
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Volume2 className="h-8 w-8 text-primary" />
                        Sound
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage sound effects and notification sounds</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sound Preferences</CardTitle>
                            <CardDescription>Control audio feedback in the app</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="sound-effects" className="text-base font-medium">Sound Effects</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Play sounds for interactions</p>
                                </div>
                                <Switch
                                    id="sound-effects"
                                    checked={settings?.sound_effects ?? true}
                                    onCheckedChange={(checked) => updateSetting('sound_effects', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="notification-sounds" className="text-base font-medium">Notification Sounds</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Play sounds for new notifications</p>
                                </div>
                                <Switch
                                    id="notification-sounds"
                                    checked={settings?.notification_sounds ?? true}
                                    onCheckedChange={(checked) => updateSetting('notification_sounds', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                            💡 <strong>Auto-save enabled:</strong> Your sound preferences are saved automatically when you make changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SoundSettings;
