
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Volume2 } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { BackButton } from '@/components/common/BackButton';

const SoundSettings = () => {

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
                                <div className="flex items-center gap-4">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                          try {
                                              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                                              const oscillator = audioContext.createOscillator();
                                              const gainNode = audioContext.createGain();

                                              oscillator.connect(gainNode);
                                              gainNode.connect(audioContext.destination);

                                              oscillator.type = 'sine';
                                              oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
                                              
                                              gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                                              gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
                                              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                                              oscillator.start(audioContext.currentTime);
                                              oscillator.stop(audioContext.currentTime + 0.5);
                                          } catch (e) {
                                              console.error("Web Audio failed:", e);
                                          }
                                      }}
                                      className="text-xs h-8"
                                    >
                                        Test Sound
                                    </Button>
                                    <Switch
                                        id="notification-sounds"
                                        checked={settings?.notification_sounds ?? true}
                                        onCheckedChange={(checked) => updateSetting('notification_sounds', checked)}
                                    />
                                </div>
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
