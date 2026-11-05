import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Eye, Lock, ShieldAlert, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { friendlyError } from '@cinecraft/core';
import { cn } from '@/lib/utils';

interface AccessRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_rank: number;
  target_type: 'room' | 'project_space' | 'dm';
  target_title: string | null;
  reason_category: string;
  reason_details: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  emergency_override: boolean;
  created_at: string;
  expires_at: string;
  approver_name: string | null;
  can_approve: boolean;
}

const CATEGORY: Record<string, string> = {
  harassment: 'Harassment and abuse investigation',
  fraud: 'Fraud and impersonation audit',
  data_leak: 'Data leak and IP protection',
  bug_troubleshooting: 'Technical troubleshooting',
  emergency: 'Critical emergency',
};
const TARGET: Record<string, string> = { room: 'Discussion room', project_space: 'Project space', dm: 'Direct message' };
const RANK: Record<number, string> = { 1: 'Moderator', 2: 'Admin', 3: 'Super admin' };
const FILTERS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
] as const;

const waited = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

/**
 * Staff who want to look inside a private room or project space ask for audited access. A second staff member of enough
 * rank approves or rejects it here. Approval gives the requester 2 hours of read-only access from this moment.
 */
export const AccessRequestsQueue = ({ onCount }: { onCount?: (n: number) => void }) => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('pending');
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_access_requests', { p_status: filter });
    if (error) {
      toast({ title: 'Could not load requests', description: friendlyError(error), variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data || []) as AccessRequest[]);
      if (filter === 'pending') {
        onCount?.((data || []).filter((r: AccessRequest) => r.status === 'pending' && new Date(r.expires_at) > new Date()).length);
      }
    }
    setLoading(false);
  }, [filter, toast, onCount]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const approve = async (r: AccessRequest) => {
    setBusyId(r.id);
    const { error } = await (supabase as any).rpc('approve_space_access', { p_request_id: r.id });
    setBusyId(null);
    if (error) {
      toast({ title: 'Could not approve', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Access approved', description: `${r.requester_name} can read the space for 2 hours.` });
    load();
  };

  const reject = async (r: AccessRequest, note: string) => {
    const { error } = await (supabase as any).rpc('reject_space_access', { p_request_id: r.id, p_note: note });
    if (error) {
      toast({ title: 'Could not reject', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Request rejected' });
    setRejecting(null);
    load();
  };

  return (
    <section aria-labelledby="access-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="access-title" className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Audited access requests
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Staff asking to read a private room or project space. Access is read only, lasts 2 hours and is logged.
          </p>
        </div>
        <div role="tablist" aria-label="Filter requests" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-9 px-3.5 rounded-full text-sm font-medium border transition-colors',
                filter === f.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Eye className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">{filter === 'pending' ? 'Nothing is waiting' : 'No requests here'}</p>
          <p className="text-sm text-muted-foreground mt-1">New requests appear here and notify the staff who can decide them.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const expired = r.status === 'pending' && new Date(r.expires_at) <= new Date();
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold flex flex-wrap items-center gap-2">
                      {r.requester_name}
                      <Badge variant="outline" className="rounded-full text-xs">{RANK[r.requester_rank] || 'Staff'}</Badge>
                      {r.emergency_override && (
                        <Badge className="rounded-full text-xs bg-destructive text-destructive-foreground gap-1">
                          <ShieldAlert className="h-3 w-3" /> Emergency
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      wants to read <span className="font-medium text-foreground">{r.target_title || 'a private space'}</span> · {TARGET[r.target_type]}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {waited(r.created_at)}
                  </span>
                </div>

                <div className="mt-3 rounded-xl bg-muted/50 border border-border p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">{CATEGORY[r.reason_category] || r.reason_category}</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{r.reason_details}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {r.status === 'pending'
                      ? expired ? 'Expired before anyone decided' : 'Waiting for a decision'
                      : `${r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Expired'}${r.approver_name ? ` by ${r.approver_name}` : ''}`}
                  </p>
                  {r.status === 'pending' && !expired && (
                    r.can_approve ? (
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-10 rounded-xl gap-1.5" onClick={() => setRejecting(r)} disabled={busyId === r.id}>
                          <X className="h-4 w-4" /> Reject
                        </Button>
                        <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => approve(r)} disabled={busyId === r.id}>
                          <Check className="h-4 w-4" /> Approve for 2 hours
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">You cannot decide this one: it is your own request, or it needs a higher rank.</p>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReasonDialog
        open={!!rejecting}
        title="Reject this request"
        description="The person is told it was not approved, with your note."
        confirmLabel="Reject request"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={(note) => rejecting && reject(rejecting, note)}
      />
    </section>
  );
};

export default AccessRequestsQueue;
