
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { BackButton } from '@/components/common/BackButton';

const NotificationsSettings = () => {

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
                    <BackButton label="BACK TO SETTINGS" to="/settings" className="mb-4" />
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Bell className="h-8 w-8 text-primary" />
                        Notifications
                    </h1>
                    <p className="text-muted-foreground mt-2">Control how you receive notifications</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Channels</CardTitle>
                            <CardDescription>Choose how you want to receive notifications</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="email-notif" className="text-base font-medium">Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Receive updates via email</p>
                                </div>
                                <Switch
                                    id="email-notif"
                                    checked={settings?.email_notifications ?? true}
                                    onCheckedChange={(checked) => updateSetting('email_notifications', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="push-notif" className="text-base font-medium">Push Notifications</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Receive browser notifications</p>
                                </div>
                                <Switch
                                    id="push-notif"
                                    checked={settings?.push_notifications ?? false}
                                    onCheckedChange={(checked) => updateSetting('push_notifications', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Activity Notifications</CardTitle>
                            <CardDescription>Get notified about important updates</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="project-notif" className="text-base font-medium">Project Updates</Label>
                                    <p className="text-sm text-muted-foreground mt-1">New projects and opportunities</p>
                                </div>
                                <Switch
                                    id="project-notif"
                                    checked={settings?.project_notifications ?? true}
                                    onCheckedChange={(checked) => updateSetting('project_notifications', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="message-notif" className="text-base font-medium">Messages</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Direct messages and chats</p>
                                </div>
                                <Switch
                                    id="message-notif"
                                    checked={settings?.message_notifications ?? true}
                                    onCheckedChange={(checked) => updateSetting('message_notifications', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="comment-notif" className="text-base font-medium">Comments & Mentions</Label>
                                    <p className="text-sm text-muted-foreground mt-1">When someone comments or mentions you</p>
                                </div>
                                <Switch
                                    id="comment-notif"
                                    checked={settings?.comment_notifications ?? true}
                                    onCheckedChange={(checked) => updateSetting('comment_notifications', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="job-notif" className="text-base font-medium">Job Alerts</Label>
                                    <p className="text-sm text-muted-foreground mt-1">New job postings matching your profile</p>
                                </div>
                                <Switch
                                    id="job-notif"
                                    checked={settings?.job_alerts ?? true}
                                    onCheckedChange={(checked) => updateSetting('job_alerts', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                            💡 <strong>Auto-save enabled:</strong> Your notification preferences are saved automatically when you toggle any switch.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsSettings;
