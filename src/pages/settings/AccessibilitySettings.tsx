
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { BackButton } from '@/components/common/BackButton';

const AccessibilitySettings = () => {

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
                        <Eye className="h-8 w-8 text-primary" />
                        Accessibility
                    </h1>
                    <p className="text-muted-foreground mt-2">Customize the app for better accessibility</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Visual Accessibility</CardTitle>
                            <CardDescription>Adjust visual settings for better readability</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="high-contrast" className="text-base font-medium">High Contrast Mode</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Increase contrast for better visibility</p>
                                </div>
                                <Switch
                                    id="high-contrast"
                                    checked={settings?.high_contrast ?? false}
                                    onCheckedChange={(checked) => updateSetting('high_contrast', checked)}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="reduce-motion" className="text-base font-medium">Reduce Motion</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Minimize animations and transitions</p>
                                </div>
                                <Switch
                                    id="reduce-motion"
                                    checked={settings?.reduce_motion ?? false}
                                    onCheckedChange={(checked) => updateSetting('reduce_motion', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                            💡 <strong>Auto-save enabled:</strong> Your accessibility preferences are saved automatically when you make changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessibilitySettings;
