import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Bell, Check } from 'lucide-react';

const NotificationsSettings = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(false);
    const [projectNotifications, setProjectNotifications] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [commentNotifications, setCommentNotifications] = useState(true);
    const [jobAlerts, setJobAlerts] = useState(true);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast({
                title: "Settings Saved",
                description: "Your notification preferences have been updated.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pt-20 pb-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Settings
                    </Button>
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
                                <Switch id="email-notif" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="push-notif" className="text-base font-medium">Push Notifications</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Receive browser notifications</p>
                                </div>
                                <Switch id="push-notif" checked={pushNotifications} onCheckedChange={setPushNotifications} />
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
                                <Switch id="project-notif" checked={projectNotifications} onCheckedChange={setProjectNotifications} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="message-notif" className="text-base font-medium">Messages</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Direct messages and chats</p>
                                </div>
                                <Switch id="message-notif" checked={messageNotifications} onCheckedChange={setMessageNotifications} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="comment-notif" className="text-base font-medium">Comments & Mentions</Label>
                                    <p className="text-sm text-muted-foreground mt-1">When someone comments or mentions you</p>
                                </div>
                                <Switch id="comment-notif" checked={commentNotifications} onCheckedChange={setCommentNotifications} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="job-notif" className="text-base font-medium">Job Alerts</Label>
                                    <p className="text-sm text-muted-foreground mt-1">New job postings matching your profile</p>
                                </div>
                                <Switch id="job-notif" checked={jobAlerts} onCheckedChange={setJobAlerts} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving} size="lg">
                            {isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsSettings;
