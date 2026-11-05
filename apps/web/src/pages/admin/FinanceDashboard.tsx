import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import TeamStatsCards from '@/components/internal/shared/TeamStatsCards';
import RefundsDesk from '@/components/internal/admin/RefundsDesk';
import { supabase } from '@/integrations/supabase/client';

/**
 * The finance console. Finance reads and decides refunds and nothing else: no moderation, no user management.
 * Needs supabase/manual/part_gc_finance_role.sql.
 */
const FinanceDashboard = () => {
  const [limit, setLimit] = useState<{ single_approver_limit_minor: number; super_admin_minor: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).rpc('finance_refund_settings');
      if (data) setLimit(data);
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <InternalHeader title="Finance" subtitle="Refund approvals" role="Finance" />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        <section aria-label="How refund approval works" className="rounded-2xl border border-border bg-card p-5 flex gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center"><Landmark className="h-5 w-5" aria-hidden="true" /></div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Two people decide every refund</p>
            <p className="mt-1">
              You can never approve a refund you asked for.
              {limit
                ? ` Up to ${(limit.single_approver_limit_minor / 100).toLocaleString()} one other person approves it; above that two different people have to.`
                : ' Up to the approval limit one other person approves it; above that two different people have to.'}
              {' '}Every vote is written to the audit ledger. An admin sends an approved refund to the payment provider.
            </p>
          </div>
        </section>
        <TeamStatsCards teams={['finance']} />
        <RefundsDesk />
      </main>
    </div>
  );
};

export default FinanceDashboard;
