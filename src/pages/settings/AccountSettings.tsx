import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, LogOut, Trash2, Zap, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountType } from '@/hooks/useAccountType';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AccountSettings = () => {
    const navigate = useNavigate();
    const { signOut, user } = useAuth();
    const { toast } = useToast();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { accountType } = useAccountType();
    const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);

    const handleSwitchAccountType = async (newType: 'fan' | 'creator' | 'studio') => {
        if (!user || newType === accountType) return;
        
        try {
            setIsUpdatingAccount(true);
            const { error } = await supabase
                .from('profiles')
                .update({ account_type: newType } as any)
                .eq('id', user.id);
                
            if (error) throw error;
            
            toast({
                title: "Account Updated",
                description: `Your account is now set to ${newType.charAt(0).toUpperCase() + newType.slice(1)}. Reloading...`,
            });
            
            setTimeout(() => {
                window.location.href = '/feed';
            }, 1500);
        } catch (error: any) {
            console.error('Error updating account:', error);
            toast({
                title: "Error",
                description: "Failed to update account type. Please try again.",
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingAccount(false);
        }
    };

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await signOut();
            toast({
                title: "Signed out successfully",
                description: "You have been signed out of your account.",
            });
            navigate('/auth');
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to sign out. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleDeleteAccount = () => {
        toast({
            title: "Account Deletion",
            description: "Please contact support to delete your account.",
            variant: "destructive"
        });
    };

    const handleClearAllMessages = async () => {
        if (!user) return;
        try {
            // Clear direct_messages where user is sender or receiver
            const { error: dmError } = await supabase
                .from('direct_messages' as any)
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
            
            // Clear general messages where user is sender
            const { error: msgError } = await supabase
                .from('messages')
                .delete()
                .eq('sender_id', user.id);
            
            if (dmError || msgError) throw (dmError || msgError);

            toast({
                title: "History Cleared",
                description: "All your direct messages and chat history have been erased locally.",
            });
        } catch (error: any) {
            console.error('Error clearing messages:', error);
            toast({
                title: "Error",
                description: "Failed to clear message history: " + error.message,
                variant: "destructive"
            });
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
                        <User className="h-8 w-8 text-primary" />
                        Account
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage your account settings</p>
                </div>

                <div className="space-y-6">
                    {/* Account Type Card */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle>Account Role</CardTitle>
                            <CardDescription>Switch between your roles on CineCraft Connect.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { 
                                    id: 'fan', 
                                    label: 'Fan / Audience', 
                                    description: 'Follow creators, rate movies, and join discussions.',
                                    icon: <User className="h-5 w-5" />
                                },
                                { 
                                    id: 'creator', 
                                    label: 'Creator Pro', 
                                    description: 'Showcase your portfolio, apply for jobs, and access analytics.',
                                    icon: <Zap className="h-5 w-5" />
                                },
                                { 
                                    id: 'studio', 
                                    label: 'Studio / Company', 
                                    description: 'Post jobs, search for vendors, and hire talent.',
                                    icon: <Building2 className="h-5 w-5" />
                                }
                            ].map((role) => (
                                <div 
                                    key={role.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                                        accountType === role.id 
                                        ? 'bg-background border-primary shadow-sm' 
                                        : 'bg-background/50 border-border hover:border-primary/30 hover:bg-background/80'
                                    }`}
                                >
                                    <div className="flex gap-4">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${accountType === role.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            {role.id === 'fan' ? <User className="h-5 w-5" /> : role.id === 'creator' ? <Zap className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <Label className={`text-base font-bold ${accountType === role.id ? 'text-primary' : 'text-foreground'}`}>{role.label}</Label>
                                            <p className="text-sm text-muted-foreground mt-0.5 max-w-sm">
                                                {role.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        {accountType === role.id ? (
                                            <div className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                                                Active
                                            </div>
                                        ) : (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                disabled={isUpdatingAccount}
                                                onClick={() => handleSwitchAccountType(role.id as any)}
                                            >
                                                Switch
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(accountType === 'fan') && (
                                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                                    <div className="h-5 w-5 text-amber-500 mt-0.5">⚠️</div>
                                    <p className="text-xs text-amber-500 leading-relaxed">
                                        Some Pro features require a subscription. Switching to Creator or Studio may prompt you to view our <Link to="/pricing" className="underline font-bold">Pricing Plans</Link>.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Session</CardTitle>
                            <CardDescription>Manage your current session</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Sign Out</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Sign out of your account on this device</p>
                                </div>
                                <Button variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            <CardDescription>Irreversible and destructive actions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="p-4 rounded-lg bg-background border border-destructive/20">
                                <div className="mb-3">
                                    <Label className="text-base font-medium text-destructive">Delete Account</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Once you delete your account, there is no going back. Please be certain.
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Account
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">
                                                Delete Account
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>

                            <div className="mt-4 p-4 rounded-lg bg-background border border-destructive/20">
                                <div className="mb-3">
                                    <Label className="text-base font-medium text-destructive">Clear All Message History</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently delete all your direct messages. This action is irreversible.
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Clear All Messages
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete all your private conversations and data in direct messages. This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearAllMessages} className="bg-destructive text-destructive-foreground">
                                                Clear Everything
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;
