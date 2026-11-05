import { confirmDialog } from '@/lib/confirmDialog';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/contexts/AuthContext';
import { SavedSessionExpiredError, savedSessionExpiredUrl } from '@/lib/auth/savedSessionExpired';
import { useToast } from '@/hooks/use-toast';
import { User, LogOut, Trash2, Zap, Building2, BadgeCheck, Check, Clock, CheckCircle, XCircle, AlertTriangle, ShieldAlert, Plus, Loader2, Sparkles, Wallet, ChevronRight } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAccountType } from '@/hooks/useAccountType';
import { SettingsPageHeader, SettingsSection, SettingsNote } from '@/components/settings/SettingsUI';
import { useScrollToHash } from '@/components/settings/SettingsUI';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { friendlyError } from '@cinecraft/core';

const AccountSettings = () => {
    useScrollToHash();
    const { push, replace } = useAppNavigation();
    const queryClient = useQueryClient();
    const { signOut, refreshProfile, user, savedAccounts, switchAccount, addAccount, removeAccount } = useAuth();
    const { toast } = useToast();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { accountType } = useAccountType();
    const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
    const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
    const [switchingAccId, setSwitchingAccId] = useState<string | null>(null);

    const handleSwitchSavedAccount = async (targetUserId: string, username: string) => {
        if (switchingAccId) return;
        try {
            setSwitchingAccId(targetUserId);
            toast({
                title: "Switching account",
                description: `Switching to @${username}...`,
            });
            await switchAccount(targetUserId);
            toast({
                title: "Account Switched",
                description: `Now logged in as @${username}`,
            });
        } catch (e: any) {
            if (e instanceof SavedSessionExpiredError) {
                // show the message on the sign-in page, with the email filled in
                window.location.href = savedSessionExpiredUrl(e.email);
                return;
            }
            toast({
                title: "Switch Failed",
                description: "Failed to switch account: " + (e?.message || 'Unknown error'),
                variant: "destructive",
            });
        } finally {
            setSwitchingAccId(null);
        }
    };

    // Verification state
    const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'under_review' | 'approved' | 'verified' | 'rejected' | 'revoked'>('none');
    // Verified badge: only Creator accounts can apply (Fan and Studio accounts have no badge).
    const canApplyForBadge = accountType === 'creator';
    const [verifyForm, setVerifyForm] = useState({ full_legal_name: '', request_type: 'creator', reason: '' });
    const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [verificationLoaded, setVerificationLoaded] = useState(false);

    useEffect(() => {
        if (!user || !canApplyForBadge) return;
        const checkVerification = async () => {
            const { data: profile } = await (supabase as any).from('profiles').select('is_verified').eq('id', user.id).maybeSingle();
            if (profile?.is_verified) { setVerificationStatus('verified'); setVerificationLoaded(true); return; }
            const { data: req } = await (supabase as any).from('verification_requests')
                .select('status, rejection_reason').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (req) {
                setVerificationStatus(req.status as any);
                setRejectionReason(req.rejection_reason);
            }
            setVerificationLoaded(true);
        };
        checkVerification();
    }, [user, canApplyForBadge]);

    const handleSubmitVerification = async () => {
        if (!canApplyForBadge) return;
        if (!user ||!verifyForm.full_legal_name.trim() || !verifyForm.reason.trim()) {
            toast({ title: 'Fill all fields', variant: 'destructive' }); return;
        }
        setIsSubmittingVerification(true);
        try {
            const { error } = await (supabase as any).from('verification_requests').insert({
                user_id: user.id,
                full_legal_name: verifyForm.full_legal_name.trim(),
                request_type: verifyForm.request_type,
                reason: verifyForm.reason.trim(),
                status: 'pending',
            });
            if (error) throw error;
            setVerificationStatus('pending');
            toast({ title: '✅ Verification Request Submitted', description: 'Our team will review your application.' });
        } catch (e: any) {
            toast({ title: 'Error', description: friendlyError(e), variant: 'destructive' });
        } finally {
            setIsSubmittingVerification(false);
        }
    };

    const handleSwitchAccountType = async (newType: 'fan' | 'creator' | 'studio') => {
        if (!user || newType === accountType) return;

        const label = newType === 'fan' ? 'Fan / Audience' : newType === 'creator' ? 'Creator Pro' : 'Studio / Company';
        const effect = newType === 'fan'
            ? 'You will lose posting, jobs, projects and marketplace access, and can only message fans who follow you back.'
            : newType === 'creator'
                ? 'You get creator tools (portfolio, jobs, projects, marketplace). Your profile will show as a creator.'
                : 'You get studio tools (posting jobs, vendors, hiring). Your profile will show as a studio or company.';
        const ok = await confirmDialog(`Switch your account to ${label}? ${effect} You can switch again later.`, {
            title: `Switch to ${label}?`,
            confirmLabel: `Switch to ${label}`,
            destructive: false,
        });
        if (!ok) return;

        try {
            setIsUpdatingAccount(true);
            const { error } = await supabase
                .from('profiles')
                .update({ account_type: newType } as any)
                .eq('id', user.id);
                
            if (error) throw error;
            
            // update in place: re-read the profile into the context, refresh cached data that depends on the account type, then go to the feed
            await refreshProfile();
            queryClient.invalidateQueries();
            toast({
                title: "Account updated",
                description: `You are now on a ${label} account.`,
            });
            replace('/feed');
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
            push('/auth', { noScroll: true });
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

    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
    const [deleteUnderstood, setDeleteUnderstood] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

    const handleDeleteAccount = async () => {
        if (!user) return;
        if (deleteConfirmEmail.trim().toLowerCase() !== user.email?.toLowerCase()) return;

        try {
            setIsDeleting(true);

            // Server-side deletion: removes the auth user (cascading profile + owned data) and uploads.
            const { data: fnData, error: fnError } = await supabase.functions.invoke('delete-account', {
                body: { confirmEmail: deleteConfirmEmail.trim() },
            });
            if (fnError || (fnData as any)?.error) {
                throw new Error((fnData as any)?.error || fnError?.message || 'Server could not delete the account.');
            }

            toast({
                title: 'Account permanently deleted',
                description: 'Your data has been erased. Goodbye — we hope to see you again someday.',
            });

            try {
                await signOut();
            } catch {
                // The session no longer exists once the auth user is deleted; that's expected.
            }
            // Redirect to landing page
            window.location.href = '/';
        } catch (error: any) {
            console.error('Error deleting account:', error);
            toast({
                title: 'Deletion failed',
                description: friendlyError(error, 'Something went wrong. Please try again or contact support.'),
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const openDeleteDialog = () => {
        setDeleteStep(1);
        setDeleteUnderstood(false);
        setDeleteConfirmEmail('');
        setDeleteDialogOpen(true);
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
                description: "All your direct messages were deleted from our servers, for you and for the people you chatted with, along with the group-chat messages you sent. This cannot be undone.",
            });
        } catch (error: any) {
            console.error('Error clearing messages:', error);
            toast({
                title: "Error",
                description: friendlyError(error, "Failed to clear message history. Please try again."),
                variant: "destructive"
            });
        }
    };

    const roles = [
        { id: 'fan', label: 'Fan / Audience', description: 'Follow creators, rate movies, and join discussions.', icon: User },
        { id: 'creator', label: 'Creator Pro', description: 'Showcase your portfolio, apply for jobs, and access analytics.', icon: Zap },
        { id: 'studio', label: 'Studio / Company', description: 'Post jobs, search for vendors, and hire talent.', icon: Building2 },
    ] as const;

    const statusRow = (icon: React.ReactNode, tone: string, title: string, text: string) => (
        <div className="flex items-start gap-3.5 px-4 py-3.5">
            <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', tone)}>{icon}</span>
            <div className="min-w-0 pt-0.5">
                <p className="text-base font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
            </div>
        </div>
    );

    return (
        <>
            <SettingsPageHeader title="Account" description="Your role, your badge, the accounts on this device, and what happens when you leave." />

            {/* ── Account type ── */}
            <SettingsSection title="Account type" description="Switch between your roles on CineCraft Connect.">
                {roles.map((role) => {
                    const active = accountType === role.id;
                    const Icon = role.icon;
                    return (
                        <button
                            key={role.id}
                            type="button"
                            aria-pressed={active}
                            disabled={active || isUpdatingAccount}
                            onClick={() => { if (!active) handleSwitchAccountType(role.id); }}
                            className={cn('w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors disabled:cursor-default', active ? 'bg-primary/5' : 'hover:bg-muted/40')}
                        >
                            <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-base font-medium">{role.label}</span>
                                <span className="block text-xs text-muted-foreground mt-0.5">{role.description}</span>
                            </span>
                            {active ? (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0"><Check className="h-4 w-4" /> Current</span>
                            ) : (
                                <span className="text-xs font-semibold text-muted-foreground shrink-0">{isUpdatingAccount ? '…' : 'Switch'}</span>
                            )}
                        </button>
                    );
                })}
            </SettingsSection>
            {accountType === 'fan' && (
                <SettingsNote>Some Pro features may need a subscription in the future. Switching to Creator or Studio can ask you to subscribe then.</SettingsNote>
            )}

            {/* ── Plans and payments (staff accounts do not buy plans) ── */}
            {!(isModerator || isAdmin || isSuperAdmin) && (
                <SettingsSection title="Plans and payments" description="See what each plan includes and what you have paid.">
                    {[
                        { to: '/settings/plans', icon: Sparkles, title: 'Plans', text: 'See what each plan includes' },
                        { to: '/settings/payments', icon: Wallet, title: 'My payments', text: 'Your plan, gifts and receipts' },
                    ].map(({ to, icon: RowIcon, title, text }) => (
                        <Link key={to} to={to} className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors">
                            <span className="h-10 w-10 rounded-full grid place-items-center shrink-0 bg-muted text-muted-foreground"><RowIcon className="h-5 w-5" /></span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-base font-medium">{title}</span>
                                <span className="block text-xs text-muted-foreground mt-0.5">{text}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                    ))}
                </SettingsSection>
            )}

            {/* ── Verified badge ── */}
            {canApplyForBadge && (
            <SettingsSection title="Verified badge" description="Apply for the official CineCraft checkmark. It shows on your profile, posts and network cards.">
                {!verificationLoaded ? (
                    <p className="px-4 py-3.5 text-sm text-muted-foreground">Checking status…</p>
                ) : verificationStatus === 'verified' ? (
                    statusRow(<CheckCircle className="h-5 w-5" />, 'bg-green-500/15 text-green-600', 'You are verified', 'Your badge is visible on your profile, posts and network.')
                ) : verificationStatus === 'pending' ? (
                    statusRow(<Clock className="h-5 w-5" />, 'bg-amber-500/15 text-amber-600', 'Application received', "Our team will review your request. You'll be notified once a decision is made.")
                ) : verificationStatus === 'under_review' ? (
                    statusRow(<Clock className="h-5 w-5" />, 'bg-amber-500/15 text-amber-600', 'Application under review', "A reviewer is looking at your request now. You'll be notified once a decision is made.")
                ) : verificationStatus === 'approved' ? (
                    statusRow(<CheckCircle className="h-5 w-5" />, 'bg-green-500/15 text-green-600', 'Application approved', 'Your badge will appear on your profile shortly. Reopen this page if it does not show up.')
                ) : verificationStatus === 'revoked' ? (
                    statusRow(<XCircle className="h-5 w-5" />, 'bg-red-500/15 text-red-600', 'Your badge was removed', rejectionReason ? `${rejectionReason.replace(/[.\s]+$/, '')}. You may apply again with updated information.` : 'You may apply again with updated information.')
                ) : verificationStatus === 'rejected' ? (
                    statusRow(<XCircle className="h-5 w-5" />, 'bg-red-500/15 text-red-600', 'Your last application was not approved', rejectionReason ? `${rejectionReason.replace(/[.\s]+$/, '')}. You may apply again with updated information.` : 'You may apply again with updated information.')
                ) : null}

                {verificationLoaded && (verificationStatus === 'none' || verificationStatus === 'rejected' || verificationStatus === 'revoked') && (
                    <div className="px-4 py-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="verify-name" className="text-[13px] font-medium">Full legal name</Label>
                                <Input
                                    id="verify-name"
                                    placeholder="Your real name"
                                    value={verifyForm.full_legal_name}
                                    onChange={e => setVerifyForm(f => ({ ...f, full_legal_name: e.target.value }))}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="verify-type" className="text-[13px] font-medium">Account type</Label>
                                <select
                                    id="verify-type"
                                    className="w-full h-11 md:h-10 rounded-xl border border-input bg-background px-3 text-base md:text-sm"
                                    value={verifyForm.request_type}
                                    onChange={e => setVerifyForm(f => ({ ...f, request_type: e.target.value }))}
                                >
                                    <option value="creator">Individual Creator</option>
                                    <option value="public_figure">Public Figure</option>
                                    <option value="professional">Journalist / Press</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="verify-reason" className="text-[13px] font-medium">Why should you be verified?</Label>
                            <Textarea
                                id="verify-reason"
                                placeholder="Tell us about your work, achievements, or why you need the verified badge…"
                                className="rounded-xl resize-none min-h-[80px]"
                                value={verifyForm.reason}
                                onChange={e => setVerifyForm(f => ({ ...f, reason: e.target.value }))}
                            />
                        </div>
                        <Button
                            onClick={handleSubmitVerification}
                            disabled={isSubmittingVerification || !verifyForm.full_legal_name.trim() || !verifyForm.reason.trim()}
                            className="w-full rounded-xl font-semibold"
                        >
                            <BadgeCheck className="mr-2 h-4 w-4" />
                            {isSubmittingVerification ? 'Submitting…' : 'Apply for verification'}
                        </Button>
                    </div>
                )}
            </SettingsSection>
            )}

            {/* ── Accounts on this device ── */}
            <SettingsSection title="Accounts on this device" description="Switch between accounts you are signed in to here, or add another.">
                {savedAccounts.length === 0 && (
                    <p className="px-4 py-3.5 text-sm text-muted-foreground">No other accounts saved on this device.</p>
                )}
                {savedAccounts.map((acc) => {
                    const isActive = acc.userId === user?.id;
                    const initials = acc.username
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'U';
                    return (
                        <div key={acc.userId} className={cn('flex items-center gap-3.5 px-4 py-3', isActive && 'bg-primary/5')}>
                            <div className="relative shrink-0">
                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs overflow-hidden">
                                    {acc.avatarUrl ? (
                                        <img loading="lazy" decoding="async" src={acc.avatarUrl} alt={acc.username} className="h-full w-full object-cover" />
                                    ) : initials}
                                </div>
                                {isActive && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" aria-label="Signed in" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-base font-medium truncate leading-tight">{acc.username}</span>
                                <span className="text-xs text-muted-foreground truncate mt-0.5">{acc.email}</span>
                            </div>
                            {isActive ? (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0"><Check className="h-4 w-4" /> Current</span>
                            ) : (
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg font-medium text-xs"
                                        disabled={switchingAccId !== null}
                                        onClick={() => handleSwitchSavedAccount(acc.userId, acc.username)}
                                    >
                                        {switchingAccId === acc.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Switch'}
                                    </Button>
                                    <Button
                                        aria-label={`Remove ${acc.username} from this device`}
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                        disabled={switchingAccId !== null}
                                        onClick={() => removeAccount(acc.userId)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
                <button type="button" onClick={addAccount} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left text-primary font-medium hover:bg-muted/40 transition-colors">
                    <span className="h-10 w-10 rounded-full border border-dashed border-primary/50 grid place-items-center shrink-0"><Plus className="h-5 w-5" /></span>
                    Add another account
                </button>
            </SettingsSection>

            {/* ── Session ── */}
            <SettingsSection id="signout" title="Session">
                <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-60"
                >
                    <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.7} />
                    <span className="flex-1 min-w-0">
                        <span className="block text-base">{isSigningOut ? 'Logging out…' : 'Log out'}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Sign out of your account on this device</span>
                    </span>
                </button>
            </SettingsSection>

            {/* ── Danger zone ── */}
            <section className="mb-8">
                <h3 className="text-base font-semibold text-destructive">Danger zone</h3>
                <p className="text-sm text-muted-foreground mt-0.5">These actions cannot be undone.</p>
                <div className="mt-3 rounded-2xl border border-destructive/30 bg-card divide-y divide-destructive/15 overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-medium">Delete account</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Permanently erase your account and everything that belongs to it.</p>
                        </div>
                        <Button variant="destructive" size="sm" className="shrink-0" onClick={openDeleteDialog}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete account
                        </Button>
                    </div>

                            {/* ── 2-step deletion dialog ── */}
                            <Dialog
                                open={deleteDialogOpen}
                                onOpenChange={(open) => {
                                    if (!isDeleting) setDeleteDialogOpen(open);
                                }}
                            >
                                <DialogContent className="max-w-md w-[95vw] bg-card border border-destructive/30 rounded-[28px] p-0 overflow-y-auto max-h-[90dvh]">

                                    {/* ── Step 1: What will be deleted ── */}
                                    {deleteStep === 1 && (
                                        <>
                                            <DialogHeader className="p-6 pb-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="p-2 rounded-xl bg-destructive/10">
                                                        <ShieldAlert className="h-5 w-5 text-destructive" />
                                                    </div>
                                                    <DialogTitle className="text-lg font-bold text-foreground">
                                                        Delete your account?
                                                    </DialogTitle>
                                                </div>
                                                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                                    The following data will be <span className="font-bold text-destructive">permanently and irreversibly</span> erased:
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="px-6 py-4">
                                                <ul className="space-y-2">
                                                    {[
                                                        'Profile, bio, and account credentials',
                                                        'All posts, comments, and reactions',
                                                        'Portfolio items and media uploads',
                                                        'Direct messages and chat history',
                                                        'Project memberships and files',
                                                        'Job applications and listings',
                                                        'Ratings, reviews, and legal documents',
                                                        'All analytics and activity data',
                                                    ].map((item) => (
                                                        <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>

                                                {/* Checkbox confirmation */}
                                                <label className="flex items-start gap-3 mt-5 p-3 bg-destructive/5 border border-destructive/20 rounded-xl cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-0.5 accent-destructive h-4 w-4 shrink-0"
                                                        checked={deleteUnderstood}
                                                        onChange={e => setDeleteUnderstood(e.target.checked)}
                                                    />
                                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                                        I understand this is <span className="font-bold text-foreground">permanent and cannot be undone</span>, and I want to permanently delete my CineCraft Connect account.
                                                    </span>
                                                </label>
                                            </div>

                                            <div className="flex justify-between gap-3 px-6 pb-6">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setDeleteDialogOpen(false)}
                                                    className="flex-1 rounded-xl"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    disabled={!deleteUnderstood}
                                                    onClick={() => setDeleteStep(2)}
                                                    className="flex-1 rounded-xl font-bold"
                                                >
                                                    Continue →
                                                </Button>
                                            </div>
                                        </>
                                    )}

                                    {/* ── Step 2: Type email to confirm ── */}
                                    {deleteStep === 2 && (
                                        <>
                                            <DialogHeader className="p-6 pb-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="p-2 rounded-xl bg-destructive/10">
                                                        <Trash2 className="h-5 w-5 text-destructive" />
                                                    </div>
                                                    <DialogTitle className="text-lg font-bold text-foreground">
                                                        Final confirmation
                                                    </DialogTitle>
                                                </div>
                                                <DialogDescription className="text-sm text-muted-foreground">
                                                    Type your email address to permanently delete your account.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="px-6 py-4 space-y-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                                        Your email address
                                                    </Label>
                                                    <p className="text-xs text-primary bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-lg">
                                                        {user?.email}
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                                        Confirm by typing your email
                                                    </Label>
                                                    <Input
                                                        type="email"
                                                        placeholder={user?.email ?? 'your@email.com'}
                                                        value={deleteConfirmEmail}
                                                        onChange={e => setDeleteConfirmEmail(e.target.value)}
                                                        className="rounded-xl border-destructive/30 focus-visible:ring-destructive/30"
                                                        disabled={isDeleting}
                                                        autoComplete="off"
                                                    />
                                                    {deleteConfirmEmail.length > 0 && deleteConfirmEmail.toLowerCase() !== user?.email?.toLowerCase() && (
                                                        <p className="text-xs text-destructive font-medium flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Email does not match
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-between gap-3 px-6 pb-6">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setDeleteStep(1)}
                                                    disabled={isDeleting}
                                                    className="flex-1 rounded-xl"
                                                >
                                                    ← Back
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    disabled={isDeleting || deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()}
                                                    onClick={handleDeleteAccount}
                                                    className="flex-1 rounded-xl font-bold"
                                                >
                                                    {isDeleting ? 'Deleting...' : '🗑 Delete Forever'}
                                                </Button>
                                            </div>
                                        </>
                                    )}

                                </DialogContent>
                            </Dialog>

                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-medium">Clear all messages</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Permanently delete all your direct messages.</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear messages
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete all your messages?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This permanently deletes every direct message you sent or received, so the other people lose those messages too, and the group-chat messages you sent. This cannot be undone.
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
                </div>
            </section>
        </>
    );
};

export default AccountSettings;
