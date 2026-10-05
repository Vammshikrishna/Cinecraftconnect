import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, Lock, Key, CheckCircle2, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
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

interface ChatEscalationPanelProps {
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

export const ChatEscalationPanel = ({
  targetType,
  targetId,
  chatTitle,
  onAccessGranted
}: ChatEscalationPanelProps) => {
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
        .from('chat_access_requests')
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
      const { data: requestId, error } = await (supabase as any).rpc('request_chat_access', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason_category: reasonCategory,
        p_reason_details: reasonDetails + (ticketReference ? ` (Ticket Ref: ${ticketReference})` : ''),
        p_emergency: isEmergency
      });

      if (error) throw error;

      if (isEmergency) {
        toast({ title: '🚨 Emergency Override Triggered', description: 'Emergency access granted and logged in the forensic ledger.' });
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/20 backdrop-blur-md">
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 border border-destructive/20">
          <ShieldAlert className="w-8 h-8 text-destructive animate-pulse" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Access Restrictive Area</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          Your staff role (<span className="text-destructive font-bold uppercase">{staffRole || 'user'}</span>) does not possess authorization to view or request escalation for this category of chat messages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-black/40 backdrop-blur-xl overflow-y-auto">
      <AnimatePresence mode="wait">
        {pendingRequest ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card/30 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md flex flex-col items-center text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse border border-amber-500/20">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight">Approval Pending</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                Target: {chatTitle}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your request has been logged. Access requires validation from a peer staff member.
              </p>
            </div>
            <div className="p-4 w-full rounded-xl bg-amber-500/5 border border-amber-500/20 text-left space-y-2">
              <span className="text-[10px] uppercase font-bold text-amber-500">Request Reason</span>
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card/30 border border-white/10 rounded-2xl p-8 max-w-lg w-full shadow-2xl backdrop-blur-md space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Audited Access Required</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Target: {chatTitle}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/50 pl-3">
              All communications on this platform are protected. Under governance guidelines, staff access is conditional, temporary, and forensic audit-logged.
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Reason Category
                </Label>
                <Select value={reasonCategory} onValueChange={setReasonCategory}>
                  <SelectTrigger className="rounded-xl h-11 bg-black/20 border-white/10">
                    <SelectValue placeholder="Select a reason category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Justification / Details
                </Label>
                <Textarea
                  id="details"
                  placeholder="Provide precise details justifying why access to this private chat is necessary..."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  className="rounded-xl min-h-[90px] bg-black/20 border-white/10 resize-none text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Support Ticket Reference (Optional)
                </Label>
                <Input
                  id="ticket"
                  placeholder="e.g. TICKET-9428"
                  value={ticketReference}
                  onChange={(e) => setTicketReference(e.target.value)}
                  className="rounded-xl h-11 bg-black/20 border-white/10 text-sm"
                />
              </div>

              {/* Emergency Override (Only for Admin & Super Admin) */}
              {(staffRole === 'admin' || staffRole === 'super_admin') && (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="emergency"
                      checked={isEmergency}
                      onCheckedChange={(checked) => setIsEmergency(!!checked)}
                      className="mt-1 border-destructive/50 data-[state=checked]:bg-destructive"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="emergency" className="text-xs font-black text-destructive uppercase tracking-wide cursor-pointer flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Emergency Break-Glass Override
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Bypasses peer-approval. Use ONLY in life-safety, data-leak, or critical compliance incidents. Logs a critical alarm.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !reasonCategory || !reasonDetails.trim()}
                className={`w-full rounded-xl h-11 font-black uppercase tracking-widest text-xs ${
                  isEmergency
                    ? 'bg-destructive hover:bg-destructive/80 text-white shadow-lg shadow-destructive/20'
                    : 'bg-primary hover:bg-primary/80 text-black shadow-lg shadow-primary/20'
                }`}
              >
                {submitting ? (
                  'Processing...'
                ) : isEmergency ? (
                  <>
                    <Key className="w-4 h-4 mr-2" /> Trigger Emergency Access
                  </>
                ) : (
                  <>
                    Submit Access Request <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
