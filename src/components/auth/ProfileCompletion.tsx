import { useEffect, useState } from 'react';
import { useAppNavigation } from '@/contexts/NavigationContext';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronRight, ChevronLeft, Star, Clapperboard, Building2 } from 'lucide-react';

const CRAFT_OPTIONS = [
    'Director', 'Producer', 'Actor', 'Cinematographer', 'Editor', 'Writer',
    'Sound Designer', 'Production Designer', 'Costume Designer', 'Makeup Artist',
    'VFX Artist', 'Composer', 'Gaffer', 'Grip', 'Other'
];

type AccountType = 'fan' | 'creator' | 'studio';

export const ProfileCompletion = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const { push } = useAppNavigation();

    // Step 0 = choose account type, 1 = basic info, 2 = optional details
    const [step, setStep] = useState(0);

    // Redirect internal users who shouldn't be here
    useEffect(() => {
        const isInternal = profile?.is_internal || (profile?.role && ['admin', 'moderator', 'super_admin'].includes(profile.role));
        if (isInternal) {
            const destination = profile?.role === 'super_admin' ? '/super-admin' : 
                               profile?.role === 'admin' ? '/admin' : 
                               profile?.role === 'moderator' ? '/moderation' : '/feed';
            push(destination, { noScroll: true });
        }
    }, [profile, push]);
    const [loading, setLoading] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

    const [accountType, setAccountType] = useState<AccountType | null>(null);
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [craft, setCraft] = useState('');
    const [location, setLocation] = useState('');
    const [website, setWebsite] = useState('');
    const [phone, setPhone] = useState('');

    const checkUsernameAvailability = async (value: string) => {
        if (value.length < 3) { setUsernameAvailable(null); return; }
        if (!/^[a-z0-9_]{3,20}$/.test(value)) { setUsernameAvailable(false); return; }
        setCheckingUsername(true);
        try {
            const { data, error } = await supabase.from('profiles').select('username').eq('username', value.toLowerCase()).maybeSingle();
            if (error) throw error;
            setUsernameAvailable(!data);
        } catch { setUsernameAvailable(null); } finally { setCheckingUsername(false); }
    };

    const handleUsernameChange = (value: string) => {
        const lowercase = value.toLowerCase();
        setUsername(lowercase);
        const timer = setTimeout(() => checkUsernameAvailability(lowercase), 500);
        return () => clearTimeout(timer);
    };

    const handleNextStep = () => {
        if (!username || !fullName) {
            toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
            return;
        }
        if (!usernameAvailable) {
            toast({ title: 'Error', description: 'Please choose an available username', variant: 'destructive' });
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
                onboarding_completed: true,
                account_type: accountType || 'fan',
            };
            if (bio) updateData.bio = bio;
            if (craft) updateData.craft = craft;
            if (location) updateData.location = location;
            if (website) updateData.website = website;
            if (phone) updateData.phone = phone;

            const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Profile completed successfully!' });
            window.location.href = '/feed';
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to complete profile', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const totalSteps = 3; // Step 0, 1, 2 → display as 1, 2, 3

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
                    <p className="text-muted-foreground">Step {step + 1} of {totalSteps}</p>
                    {/* Progress bar */}
                    <div className="mt-4 flex gap-1.5 justify-center">
                        {[0, 1, 2].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'bg-primary w-10' : 'bg-border w-6'}`} />
                        ))}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 shadow-lg">

                    {/* ── STEP 0: Account Type ── */}
                    {step === 0 && (
                        <div className="space-y-6">
                            <div className="text-center mb-2">
                                <h2 className="text-xl font-bold mb-1">How will you use CineCraft?</h2>
                                <p className="text-sm text-muted-foreground">Choose your account type — you can't change this later.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Fan Card */}
                                <button
                                    type="button"
                                    onClick={() => setAccountType('fan')}
                                    className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 text-center
                                        ${accountType === 'fan'
                                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'}`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${accountType === 'fan' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <Star className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">Fan</p>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Follow creators, rate content, join public discussions</p>
                                    </div>
                                    {accountType === 'fan' && (
                                        <span className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                        </span>
                                    )}
                                </button>

                                {/* Creator Card */}
                                <button
                                    type="button"
                                    onClick={() => setAccountType('creator')}
                                    className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 text-center
                                        ${accountType === 'creator'
                                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'}`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${accountType === 'creator' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <Clapperboard className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">Creator</p>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Publish posts, host rooms, access analytics</p>
                                    </div>
                                    {accountType === 'creator' && (
                                        <span className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                        </span>
                                    )}
                                </button>

                                {/* Studio Card */}
                                <button
                                    type="button"
                                    onClick={() => setAccountType('studio')}
                                    className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 text-center
                                        ${accountType === 'studio'
                                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'}`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${accountType === 'studio' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">Studio / Company</p>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Post jobs, manage teams, hire talent, and scale production</p>
                                    </div>
                                    {accountType === 'studio' && (
                                        <span className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                        </span>
                                    )}
                                </button>
                            </div>

                            {accountType && (
                                <div className={`rounded-lg p-3 text-xs border ${accountType === 'fan' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : accountType === 'studio' ? 'bg-primary/10 border-primary/30 text-primary/80' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                    {accountType === 'fan'
                                        ? '🎬 As a Fan you can like, comment, follow creators, rate content, and join public discussion spaces anonymously.'
                                        : accountType === 'studio'
                                        ? '🏢 As a Studio/Company Admin, you are registering your individual profile. You will create public Company Pages representing your corporate brands after onboarding is complete.'
                                        : '🎥 As a Creator you get full access — posts, projects, analytics, private rooms, DMs to anyone, and a verified badge.'}
                                </div>
                            )}

                            <Button
                                onClick={() => setStep(1)}
                                className="w-full"
                                disabled={!accountType}
                            >
                                Continue <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* ── STEP 1: Basic Info ── */}
                    {step === 1 && (
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
                                    {checkingUsername && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                                    {!checkingUsername && usernameAvailable === true && <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />}
                                </div>
                                {username.length > 0 && (
                                    <p className={`text-sm mt-1 ${usernameAvailable === true ? 'text-green-500' : usernameAvailable === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {usernameAvailable === true ? '✓ Available' : usernameAvailable === false ? '✗ Not available or invalid format' : 'Use 3-20 lowercase letters, numbers, or underscores'}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="fullName">Full Name *</Label>
                                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
                                {accountType === 'studio' && (
                                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                                        Please enter your individual name (e.g., Jane Doe), not your company name. You will create your company page later.
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button onClick={handleNextStep} className="flex-1" disabled={!username || !fullName || !usernameAvailable}>
                                    Next <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Optional Details ── */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." maxLength={150} rows={3} />
                                <p className="text-xs text-muted-foreground mt-1">{bio.length}/150 characters</p>
                            </div>

                            {/* Show Craft only for creators */}
                            {accountType === 'creator' && (
                                <div>
                                    <Label htmlFor="craft">Craft/Role</Label>
                                    <Select value={craft} onValueChange={setCraft}>
                                        <SelectTrigger id="craft"><SelectValue placeholder="Select your craft..." /></SelectTrigger>
                                        <SelectContent>
                                            {CRAFT_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="location">Location</Label>
                                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Los Angeles, CA" />
                            </div>

                            <div>
                                <Label htmlFor="website">Website</Label>
                                <Input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" />
                            </div>

                            <div>
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button variant="ghost" onClick={handleComplete} disabled={loading} className="flex-1">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Skip'}
                                </Button>
                                <Button onClick={handleComplete} disabled={loading} className="flex-1">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-4">
                    {step === 0 ? 'This determines your platform access level' : step === 1 ? 'Required fields are marked with *' : 'You can always update these later in settings'}
                </p>
            </div>
        </div>
    );
};

