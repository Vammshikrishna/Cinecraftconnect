import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, Lock, Key, ChevronRight, Clock, AlertTriangle, Eye, Timer, ScrollText, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@cinecraft/core';

interface SpaceEscalationPanelProps {
  targetType: 'room' | 'project_space' | 'dm';
  targetId: string;
  chatTitle: string;
  onAccessGranted: () => void;
}

const REASON_CATEGORIES = [
  { id: 'harassment', label: 'Harassment & Abuse Investigation' },
  { id: 'fraud', label: 'Fraud & Impersonation Audit' },
  { id: 'data_leak', label: 'Data Leak & IP Protection' },
  { id: 'bug_troubleshooting', label: 'Technical Troubleshooting' },
  { id: 'emergency', label: 'Critical Emergency Override' },
];

export const SpaceEscalationPanel = ({
  targetType,
  targetId,
  chatTitle,
  onAccessGranted
}: SpaceEscalationPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [staffRole, setStaffRole] = useState<'moderator' | 'admin' | 'super_admin' | null>(null);
  const [reasonCategory, setReasonCategory] = useState<string>('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch staff role and check for existing pending requests
  const fetchGovernanceStatus = async () => {
    if (!user) return;
    try {
      // 1. Get staff role
      const { data: roleData } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData) {
        setStaffRole((roleData as any).role as any);
      }

      // 2. Check for active/pending requests
      const { data: requestData } = await (supabase as any)
        .from('space_access_requests')
        .select('*')
        .eq('requester_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const requestDataCast = requestData as any;
      if (requestDataCast) {
        // If approved, check if grant is active and not expired
        if (requestDataCast.status === 'approved') {
          // An approved request is not access by itself: the grant row is. After End access the request can still look
          // approved, so only an active grant lets the person in.
          const { data: grant } = await (supabase as any)
            .from('space_access_grants')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();
          if (grant) {
            onAccessGranted(); // Access is already active!
          }
        } else {
          setPendingRequest(requestDataCast);
        }
      }
    } catch (err) {
      console.error('Error fetching governance status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGovernanceStatus();

    // Set up polling for approval status
    const interval = setInterval(() => {
      if (pendingRequest) {
        fetchGovernanceStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, targetId, pendingRequest]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCategory) {
      toast({ title: 'Category Required', description: 'Please select a reason category.', variant: 'destructive' });
      return;
    }
    if (!reasonDetails.trim()) {
      toast({ title: 'Details Required', description: 'Please explain why you need access.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: requestId, error } = await (supabase as any).rpc('request_space_access', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason_category: reasonCategory,
        p_reason_details: reasonDetails + (ticketReference ? ` (Ticket Ref: ${ticketReference})` : ''),
        p_emergency: isEmergency
      });

      if (error) throw error;

      if (isEmergency) {
        toast({ title: '🚨 Emergency Override Triggered', description: 'Emergency space access granted and logged in the forensic ledger.' });
        onAccessGranted();
      } else {
        toast({ title: 'Request Submitted', description: 'Your access request has been sent to the approval queue.' });
        fetchGovernanceStatus();
      }
    } catch (err: any) {
      toast({ title: 'Request Failed', description: friendlyError(err, 'An error occurred.'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px] gap-3" role="status">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Checking your permissions</span>
      </div>
    );
  }

  // Double check scope compatibility
  const isAuthorizedToRequest =
    staffRole === 'super_admin' ||
    (staffRole === 'admin' && targetType !== 'dm') ||
    (staffRole === 'moderator' && targetType === 'room');

  if (!isAuthorizedToRequest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">You cannot open this space</h2>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Your staff role (<span className="font-medium text-foreground capitalize">{(staffRole || 'user').replace('_', ' ')}</span>) is not allowed to request access to this kind of space.
        </p>
      </div>
    );
  }

  const canSubmit = !!reasonCategory && !!reasonDetails.trim() && !submitting;

  const RULES = [
    { icon: Eye, title: 'Read only', text: 'You can read, but not post, react or call.' },
    { icon: Timer, title: 'Two hours', text: 'Access ends by itself, or when you end it.' },
    { icon: ScrollText, title: 'Logged', text: 'Every visit is written to the audit ledger.' },
  ];

  return (
    <div className="w-full h-full overflow-y-auto bg-muted/30">
      <div className="min-h-full w-full flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        {pendingRequest ? (
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Waiting for approval</h1>
            <p className="text-sm text-muted-foreground mt-1">{chatTitle}</p>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              Another staff member has to approve your request before you can enter. This page updates by itself.
            </p>
            <div className="mt-6 rounded-2xl bg-muted/50 border border-border p-4 text-left">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your reason</p>
              <p className="text-sm text-foreground">{pendingRequest.reason_details}</p>
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" /></span>
              Checking every few seconds
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRequest} className="w-full max-w-xl rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
            <div className={cn('px-6 sm:px-8 pt-7 pb-6 border-b border-border bg-gradient-to-br to-card', isEmergency ? 'from-destructive/10' : 'from-primary/10')}>
              <div className="flex items-center gap-4">
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', isEmergency ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}>
                  {isEmergency ? <AlertTriangle className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">This space is private</h1>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">Request access to <span className="font-medium text-foreground">{chatTitle}</span></p>
                </div>
              </div>
              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {RULES.map((r) => (
                  <li key={r.title} className="rounded-xl bg-background/70 border border-border/70 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><r.icon className="w-4 h-4 text-primary" />{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-6">
              <fieldset>
                <legend className="text-sm font-medium text-foreground mb-2.5">Why do you need access?</legend>
                <div role="radiogroup" aria-label="Reason" className="grid gap-2">
                  {REASON_CATEGORIES.map((c) => {
                    const on = reasonCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setReasonCategory(c.id)}
                        className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors', on ? 'border-primary bg-primary/5 text-foreground font-medium ring-1 ring-primary/30' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30')}
                      >
                        <span className={cn('h-5 w-5 rounded-full border grid place-items-center shrink-0', on ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>{on && <Check className="h-3 w-3" />}</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="details" className="text-sm font-medium text-foreground">Details</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{reasonDetails.length} characters</span>
                </div>
                <Textarea
                  id="details"
                  placeholder="Explain what you need to check and why it cannot wait."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  className="rounded-xl min-h-[110px] bg-background border-border resize-y text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket" className="text-sm font-medium text-foreground">Support ticket <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="ticket"
                  placeholder="TICKET-9428"
                  value={ticketReference}
                  onChange={(e) => setTicketReference(e.target.value)}
                  className="rounded-xl h-11 bg-background border-border text-base"
                />
              </div>

              {(staffRole === 'admin' || staffRole === 'super_admin') && (
                <div className={cn('rounded-xl border p-4 transition-colors', isEmergency ? 'bg-destructive/10 border-destructive/40' : 'bg-muted/40 border-border')}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="emergency"
                      checked={isEmergency}
                      onCheckedChange={(checked) => setIsEmergency(!!checked)}
                      className="mt-0.5 border-destructive/60 data-[state=checked]:bg-destructive data-[state=checked]:text-white"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="emergency" className="text-sm font-semibold text-destructive cursor-pointer flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Emergency override
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Skips the second approval. Use it only for life safety, data leaks or critical compliance problems. It raises a critical alert.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!canSubmit}
                className={cn('w-full h-12 rounded-xl font-semibold text-base gap-2', isEmergency && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground')}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending</>
                ) : isEmergency ? (
                  <><Key className="w-4 h-4" /> Enter now (emergency)</>
                ) : (
                  <>Request access <ChevronRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
