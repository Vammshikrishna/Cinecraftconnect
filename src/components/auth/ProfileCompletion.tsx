import { useState } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronRight, ChevronLeft } from 'lucide-react';

const CRAFT_OPTIONS = [
    'Director', 'Producer', 'Actor', 'Cinematographer', 'Editor', 'Writer',
    'Sound Designer', 'Production Designer', 'Costume Designer', 'Makeup Artist',
    'VFX Artist', 'Composer', 'Gaffer', 'Grip', 'Other'
];

export const ProfileCompletion = () => {
    const { user } = useAuth();

    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [craft, setCraft] = useState('');
    const [location, setLocation] = useState('');
    const [website, setWebsite] = useState('');
    const [phone, setPhone] = useState('');

    const checkUsernameAvailability = async (value: string) => {
        if (value.length < 3) {
            setUsernameAvailable(null);
            return;
        }

        if (!/^[a-z0-9_]{3,20}$/.test(value)) {
            setUsernameAvailable(false);
            return;
        }

        setCheckingUsername(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', value.toLowerCase())
                .maybeSingle();

            if (error) throw error;
            setUsernameAvailable(!data);
        } catch (err) {
            console.error('Error checking username:', err);
            setUsernameAvailable(null);
        } finally {
            setCheckingUsername(false);
        }
    };

    const handleUsernameChange = (value: string) => {
        const lowercase = value.toLowerCase();
        setUsername(lowercase);

        const timer = setTimeout(() => {
            checkUsernameAvailability(lowercase);
        }, 500);

        return () => clearTimeout(timer);
    };

    const handleNextStep = () => {
        if (!username || !fullName) {
            toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
            return;
        }

        if (!usernameAvailable) {
            toast({ title: "Error", description: "Please choose an available username", variant: "destructive" });
            return;
        }

        setStep(2);
    };

    const handleComplete = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const updateData: any = {
                username: username.toLowerCase(),
                full_name: fullName,
                onboarding_completed: true
            };

            // Add optional fields if filled
            if (bio) updateData.bio = bio;
            if (craft) updateData.craft = craft;
            if (location) updateData.location = location;
            if (website) updateData.website = website;
            if (phone) updateData.phone = phone;

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (error) throw error;

            toast({ title: "Success", description: "Profile completed successfully!" });

            // Force a full page reload to refresh the profile state
            window.location.href = '/feed';
        } catch (err: any) {
            console.error('Error completing profile:', err);
            toast({
                title: "Error",
                description: err.message || "Failed to complete profile",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
                    <p className="text-muted-foreground">Step {step} of 2</p>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div>
                                <Label htmlFor="username">Username *</Label>
                                <div className="relative">
                                    <Input
                                        id="username"
                                        value={username}
                                        onChange={(e) => handleUsernameChange(e.target.value)}
                                        placeholder="johndoe"
                                        className="pr-10"
                                    />
                                    {checkingUsername && (
                                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                    {!checkingUsername && usernameAvailable === true && (
                                        <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                                    )}
                                </div>
                                {username.length > 0 && (
                                    <p className={`text-sm mt-1 ${usernameAvailable === true ? 'text-green-500' :
                                        usernameAvailable === false ? 'text-destructive' :
                                            'text-muted-foreground'
                                        }`}>
                                        {usernameAvailable === true ? '✓ Available' :
                                            usernameAvailable === false ? '✗ Not available or invalid format' :
                                                'Use 3-20 lowercase letters, numbers, or underscores'}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="fullName">Full Name *</Label>
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>

                            <Button
                                onClick={handleNextStep}
                                className="w-full"
                                disabled={!username || !fullName || !usernameAvailable}
                            >
                                Next Step <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea
                                    id="bio"
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Tell us about yourself..."
                                    maxLength={150}
                                    rows={3}
                                />
                                <p className="text-xs text-muted-foreground mt-1">{bio.length}/150 characters</p>
                            </div>

                            <div>
                                <Label htmlFor="craft">Craft/Role</Label>
                                <Select value={craft} onValueChange={setCraft}>
                                    <SelectTrigger id="craft">
                                        <SelectValue placeholder="Select your craft..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CRAFT_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Los Angeles, CA"
                                />
                            </div>

                            <div>
                                <Label htmlFor="website">Website</Label>
                                <Input
                                    id="website"
                                    type="url"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="https://yourwebsite.com"
                                />
                            </div>

                            <div>
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(1)}
                                    className="flex-1"
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleComplete}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Skip'}
                                </Button>
                                <Button
                                    onClick={handleComplete}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-4">
                    {step === 1 ? 'Required fields are marked with *' : 'You can always update these later in settings'}
                </p>
            </div>
        </div>
    );
};
