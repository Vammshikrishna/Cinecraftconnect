import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SecuritySettings = () => {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            // Re-authenticate with the current password (skipped for OAuth-only accounts that have no password).
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const hasPasswordLogin = (currentUser?.identities || []).some((i) => i.provider === 'email');
            if (hasPasswordLogin) {
                if (!currentPassword || !currentUser?.email) {
                    setError('Please enter your current password.');
                    setIsLoading(false);
                    return;
                }
                const { error: reauthError } = await supabase.auth.signInWithPassword({
                    email: currentUser.email,
                    password: currentPassword,
                });
                if (reauthError) {
                    setError('Current password is incorrect.');
                    setIsLoading(false);
                    return;
                }
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            toast({
                title: "Password updated",
                description: "Your password has been changed successfully.",
            });

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsDialogOpen(false);
        } catch (err: any) {
            console.error('Failed to change password:', err);
            setError(err.message || 'Failed to update password.');
            toast({
                title: "Error updating password",
                description: err.message || "Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-10">
            <div className="w-full">
                <div className="mb-6">
                    <BackButton label="BACK TO SETTINGS" to="/settings" className="mb-4 lg:hidden" />
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                        <Shield className="h-8 w-8 text-primary" />
                        Security
                    </h1>
                    <p className="text-muted-foreground mt-2">Protect your account</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Security</CardTitle>
                            <CardDescription>Protect your account with additional security measures</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Add an extra layer of security</p>
                                </div>
                                <Button variant="outline" disabled>Coming Soon</Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Change Password</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Update your password regularly</p>
                                </div>
                                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                                    setIsDialogOpen(open);
                                    if (!open) {
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setError('');
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">Change</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md w-[95vw] rounded-2xl bg-card border border-border shadow-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                                                <Lock className="h-5 w-5 text-primary" />
                                                Change Password
                                            </DialogTitle>
                                            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                                                Enter your new password below. It must be at least 6 characters long.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form onSubmit={handlePasswordChange} className="space-y-4 py-2">
                                            {error && (
                                                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-medium">
                                                    {error}
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <Label htmlFor="current-password">Current Password</Label>
                                                <Input
                                                    id="current-password"
                                                    type="password"
                                                    placeholder="Enter current password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    autoComplete="current-password"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="new-password">New Password</Label>
                                                <Input
                                                    id="new-password"
                                                    type="password"
                                                    placeholder="Enter new password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                                <Input
                                                    id="confirm-password"
                                                    type="password"
                                                    placeholder="Confirm new password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    required
                                                />
                                            </div>

                                            <DialogFooter className="pt-2 gap-2 flex-row sm:justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => setIsDialogOpen(false)}
                                                    disabled={isLoading}
                                                    className="rounded-xl"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isLoading || !newPassword || !confirmPassword}
                                                    className="rounded-xl font-bold"
                                                >
                                                    {isLoading ? 'Updating...' : 'Update Password'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Active Sessions</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Manage your trusted devices and logins</p>
                                </div>
                                <Button variant="outline" onClick={() => window.location.href = '/settings/sessions'}>View</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
