import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, Lock, Key, CheckCircle2, ChevronRight, Clock, AlertTriangle, Tag, MessageSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
          const expiresAt = new Date(requestDataCast.expires_at).getTime();
          if (expiresAt > Date.now()) {
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
      toast({ title: 'Request Failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/20 backdrop-blur-md min-h-[400px]">
        <Clock className="w-8 h-8 text-primary animate-spin mb-4" />
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Verifying security policies...</span>
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-lg text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 border border-destructive/20">
          <ShieldAlert className="w-8 h-8 text-destructive animate-pulse" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Access Restrictive Area</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          Your staff role (<span className="text-destructive font-bold uppercase">{staffRole || 'user'}</span>) does not possess authorization to view or request escalation for this space.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-[#0a0a0a]/80 backdrop-blur-3xl relative">
      {/* Decorative background glow blobs to power the glassmorphism */}
      <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[140px] pointer-events-none animate-pulse duration-[6s] mix-blend-screen" />
      <div className="absolute bottom-[10%] right-[20%] w-[40rem] h-[40rem] rounded-full bg-destructive/10 blur-[140px] pointer-events-none animate-pulse duration-[8s] mix-blend-screen" />

      <div className="min-h-full w-full flex items-center justify-center p-4 py-12 relative z-10">
        <AnimatePresence mode="wait">
          {pendingRequest ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-black/80 border border-white/5 rounded-[2rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.08)] backdrop-blur-xl flex flex-col items-center text-center space-y-6 m-auto"
            >
              {/* Top color highlight */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse border border-amber-500/20">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
                  Approval Pending
                </h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  Target: {chatTitle}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your request has been logged. Access requires validation from a peer staff member.
                </p>
              </div>
              <div className="p-4 w-full rounded-2xl bg-amber-500/5 border border-amber-500/15 text-left space-y-2">
                <span className="text-[9px] uppercase font-black tracking-widest text-amber-500">Request Reason</span>
                <p className="text-xs text-amber-200/80 italic">"{pendingRequest.reason_details}"</p>
              </div>
              <div className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Checking approval queue status...</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`relative bg-[#050505]/90 border border-white/5 rounded-[2rem] p-8 sm:p-10 max-w-lg w-full m-auto shadow-2xl transition-all duration-500 backdrop-blur-2xl space-y-8 ${
                isEmergency 
                  ? 'shadow-[0_0_80px_-15px_rgba(239,68,68,0.15)] border-destructive/20' 
                  : 'shadow-[0_0_80px_-15px_rgba(245,158,11,0.1)]'
              }`}
            >
              {/* Top color highlight bar */}
              <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent ${
                isEmergency ? 'via-destructive/70' : 'via-primary/50'
              } to-transparent transition-all duration-500`} />

              {/* Grid texture overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none rounded-[2rem]" />

              <div className="relative flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                  isEmergency 
                    ? 'bg-destructive/10 border-destructive/30 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' 
                    : 'bg-primary/10 border-primary/20 text-primary'
                }`}>
                  {isEmergency ? <AlertTriangle className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                    Audited Access
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    Target: <span className="text-white font-medium">{chatTitle}</span>
                  </span>
                </div>
              </div>

              <div className="relative p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-200/90 leading-relaxed flex gap-3 shadow-[inset_0_0_12px_rgba(245,158,11,0.03)]">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
                <span>
                  All items in this workspace are protected. Under governance guidelines, staff entry is conditional, temporary, and permanently logged to the forensic audit ledger.
                </span>
              </div>

              <form onSubmit={handleSubmitRequest} className="relative space-y-5">
                <div className="space-y-2.5">
                  <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90 ml-1">
                    Reason Category
                  </Label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 w-4 h-4 z-10 pointer-events-none" />
                    <Select value={reasonCategory} onValueChange={setReasonCategory}>
                      <SelectTrigger className="rounded-xl h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-white pl-11 transition-all duration-300">
                        <SelectValue placeholder="Select a reason category..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111] border-white/10">
                        {REASON_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-sm text-white/90 focus:bg-white/10 focus:text-white hover:bg-white/10 hover:text-white cursor-pointer">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="details" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90 ml-1">
                    Justification / Details
                  </Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 text-muted-foreground/50 w-4 h-4 z-10 pointer-events-none" />
                    <Textarea
                      id="details"
                      placeholder="Provide precise details justifying why entry to this private space is necessary..."
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      className="rounded-xl min-h-[100px] bg-white/5 border-white/10 hover:border-white/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none text-sm text-white pl-11 pt-3.5 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="ticket" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90 ml-1">
                    Support Ticket Reference <span className="text-muted-foreground/50">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 w-4 h-4 z-10 pointer-events-none" />
                    <Input
                      id="ticket"
                      placeholder="e.g. TICKET-9428"
                      value={ticketReference}
                      onChange={(e) => setTicketReference(e.target.value)}
                      className="rounded-xl h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm text-white pl-11 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Emergency Override (Only for Admin & Super Admin) */}
                {(staffRole === 'admin' || staffRole === 'super_admin') && (
                  <div className={`p-4 rounded-xl border transition-all duration-500 mt-2 ${
                    isEmergency 
                      ? 'bg-destructive/10 border-destructive/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                      : 'bg-destructive/5 border-white/5 hover:border-white/10'
                  }`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="emergency"
                        checked={isEmergency}
                        onCheckedChange={(checked) => setIsEmergency(!!checked)}
                        className="mt-1 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-white rounded-md"
                      />
                      <div className="space-y-1.5">
                        <Label htmlFor="emergency" className="text-xs font-black text-destructive uppercase tracking-wide cursor-pointer flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Emergency Break-Glass Override
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Bypasses peer-approval. Use ONLY in life-safety, data-leak, or critical compliance incidents. Logs a critical alarm.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !reasonCategory || !reasonDetails.trim()}
                  className={`w-full rounded-xl h-12 font-black uppercase tracking-widest text-xs transition-all duration-300 transform active:scale-[0.98] border-none flex items-center justify-center gap-2 mt-4 ${
                    isEmergency
                      ? 'bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]'
                      : 'bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)]'
                  }`}
                >
                  {submitting ? (
                    'Processing...'
                  ) : isEmergency ? (
                    <>
                      <Key className="w-4 h-4" /> Trigger Emergency Access
                    </>
                  ) : (
                    <>
                      Submit Access Request <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
