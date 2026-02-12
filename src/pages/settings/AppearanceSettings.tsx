import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Palette } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

const AppearanceSettings = () => {
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
                        <Palette className="h-8 w-8 text-primary" />
                        Appearance
                    </h1>
                    <p className="text-muted-foreground mt-2">Customize how the app looks and feels</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Theme</CardTitle>
                            <CardDescription>Choose your preferred color scheme</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Color Theme</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Select light, dark, or system theme</p>
                                </div>
                                <ThemeToggle />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Typography</CardTitle>
                            <CardDescription>Adjust text size and readability</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Font Size</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Adjust text size for better readability</p>
                                </div>
                                <Select
                                    value={settings?.font_size ?? 'medium'}
                                    onValueChange={(value: 'small' | 'medium' | 'large') => updateSetting('font_size', value)}
                                >
                                    <SelectTrigger className="w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="large">Large</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Language</CardTitle>
                            <CardDescription>Set your language preferences</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Display Language</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Choose your preferred language</p>
                                </div>
                                <Select
                                    value={settings?.language ?? 'en'}
                                    onValueChange={(value) => updateSetting('language', value)}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="es">Español</SelectItem>
                                        <SelectItem value="fr">Français</SelectItem>
                                        <SelectItem value="de">Deutsch</SelectItem>
                                        <SelectItem value="hi">हिन्दी</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                            💡 <strong>Auto-save enabled:</strong> Your appearance preferences are saved automatically when you make changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;
