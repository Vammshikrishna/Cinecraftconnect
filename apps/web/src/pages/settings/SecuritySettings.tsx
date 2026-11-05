import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from 'lucide-react';
import { SettingsPageHeader, SettingsSection, SettingsLinkRow } from '@/components/settings/SettingsUI';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from '@cinecraft/core';
import { validateNewPassword } from '@/components/settings/settingsLogic';

const SecuritySettings = () => {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // validateNewPassword mirrors this rule (minimum 8, must match) and is unit tested
        const invalid = newPassword.length < 8 ? 'Password must be at least 8 characters long.' : validateNewPassword(newPassword, confirmPassword);
        if (invalid) {
            setError(invalid);
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
            setError(friendlyError(err, 'Failed to update password.'));
            toast({
                title: "Error updating password",
                description: friendlyError(err, "Please try again later."),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <SettingsPageHeader title="Password and security" description="Protect your account." />
            <SettingsSection>
                <SettingsLinkRow icon={Lock} title="Change password" description="Update your password regularly" onClick={() => setIsDialogOpen(true)} />
                <SettingsLinkRow title="Where you are logged in" description="Manage your trusted devices and logins" to="/settings/sessions" />
                <div className="flex items-center gap-4 px-4 py-3.5" aria-disabled="true">
                    <div className="flex-1 min-w-0 opacity-60">
                        <p className="text-base">Two-factor authentication</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security</p>
                    </div>
                    <span className="text-xs font-medium rounded-full bg-muted text-muted-foreground px-2.5 py-1">Coming soon</span>
                </div>
            </SettingsSection>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                                    setIsDialogOpen(open);
                                    if (!open) {
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setError('');
                                    }
                                }}>
                                    <DialogContent className="max-w-md w-[95vw] rounded-2xl bg-card border border-border shadow-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                                                <Lock className="h-5 w-5 text-primary" />
                                                Change Password
                                            </DialogTitle>
                                            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                                                Enter your new password below. It must be at least 8 characters long.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form onSubmit={handlePasswordChange} className="space-y-4 py-2">
                                            {error && (
                                                <div role="alert" className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-medium">
                                                    {error}
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <Label htmlFor="current-password">Current Password</Label>
                                                <Input
                                                    id="current-password"
                                                    type={showPasswords ? "text" : "password"}
                                                    placeholder="Enter current password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    autoComplete="current-password"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="new-password">New Password</Label>
                                                <Input
                                                    id="new-password"
                                                    type={showPasswords ? "text" : "password"}
                                                    placeholder="Enter new password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    required
                                                    autoComplete="new-password"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                                <Input
                                                    id="confirm-password"
                                                    type={showPasswords ? "text" : "password"}
                                                    placeholder="Confirm new password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="rounded-xl focus-visible:ring-primary/30"
                                                    autoComplete="new-password"
                                                    required
                                                    aria-invalid={passwordMismatch}
                                                    aria-describedby="confirm-password-hint"
                                                />
                                                <p id="confirm-password-hint" role="status" className="min-h-4 text-xs text-destructive">
                                                    {passwordMismatch ? 'Passwords do not match' : ''}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(v => !v)}
                                                    aria-pressed={showPasswords}
                                                    className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    {showPasswords ? 'Hide passwords' : 'Show passwords'}
                                                </button>
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
        </>
    );
};

export default SecuritySettings;
