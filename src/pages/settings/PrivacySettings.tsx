import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Lock } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

const PrivacySettings = () => {
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
                        <Lock className="h-8 w-8 text-primary" />
                        Privacy
                    </h1>
                    <p className="text-muted-foreground mt-2">Control your privacy and data visibility</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Visibility</CardTitle>
                            <CardDescription>Control who can see your profile and information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Profile Visibility</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Who can view your profile</p>
                                </div>
                                <Select
                                    value={settings?.profile_visibility ?? 'public'}
                                    onValueChange={(value: 'public' | 'connections' | 'private') => updateSetting('profile_visibility', value)}
                                >
                                    <SelectTrigger className="w-44">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public">Public</SelectItem>
                                        <SelectItem value="connections">Connections Only</SelectItem>
                                        <SelectItem value="private">Private</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="show-email" className="text-base font-medium">Show Email</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Display email on public profile</p>
                                </div>
                                <Switch
                                    id="show-email"
                                    checked={settings?.show_email ?? false}
                                    onCheckedChange={(checked) => updateSetting('show_email', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="show-location" className="text-base font-medium">Show Location</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Display location on public profile</p>
                                </div>
                                <Switch
                                    id="show-location"
                                    checked={settings?.show_location ?? true}
                                    onCheckedChange={(checked) => updateSetting('show_location', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="show-online" className="text-base font-medium">Show Online Status</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Let others see when you're online</p>
                                </div>
                                <Switch
                                    id="show-online"
                                    checked={settings?.show_online_status ?? true}
                                    onCheckedChange={(checked) => updateSetting('show_online_status', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Communication</CardTitle>
                            <CardDescription>Control who can contact you</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Allow Messages From</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Who can send you direct messages</p>
                                </div>
                                <Select
                                    value={settings?.allow_messages_from ?? 'everyone'}
                                    onValueChange={(value: 'everyone' | 'connections' | 'nobody') => updateSetting('allow_messages_from', value)}
                                >
                                    <SelectTrigger className="w-44">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="everyone">Everyone</SelectItem>
                                        <SelectItem value="connections">Connections Only</SelectItem>
                                        <SelectItem value="nobody">Nobody</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                            💡 <strong>Auto-save enabled:</strong> Your privacy preferences are saved automatically when you make changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacySettings;
