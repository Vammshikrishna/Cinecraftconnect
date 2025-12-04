import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, Check } from 'lucide-react';

const AccessibilitySettings = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const [highContrast, setHighContrast] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast({
                title: "Settings Saved",
                description: "Your accessibility preferences have been updated.",
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
                        <Eye className="h-8 w-8 text-primary" />
                        Accessibility
                    </h1>
                    <p className="text-muted-foreground mt-2">Make the app easier to use</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Visual Accessibility</CardTitle>
                            <CardDescription>Adjust visual settings for better accessibility</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="high-contrast" className="text-base font-medium">High Contrast Mode</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Increase color contrast</p>
                                </div>
                                <Switch id="high-contrast" checked={highContrast} onCheckedChange={setHighContrast} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="reduce-motion" className="text-base font-medium">Reduce Motion</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Minimize animations</p>
                                </div>
                                <Switch id="reduce-motion" checked={reduceMotion} onCheckedChange={setReduceMotion} />
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

export default AccessibilitySettings;
