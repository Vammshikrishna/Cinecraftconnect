import { useState } from 'react';
import { cn } from '@/lib/utils';
import PaymentsOverview from '@/components/internal/admin/PaymentsOverview';
import RefundsDesk from '@/components/internal/admin/RefundsDesk';
import DisputesDesk from '@/components/internal/admin/DisputesDesk';
import PayoutsDesk from '@/components/internal/admin/PayoutsDesk';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'payouts', label: 'Payouts' },
] as const;

type Section = (typeof SECTIONS)[number]['id'];

/** The money side of the console: what was paid, then the three things admins act on (refunds, disputes, payouts). */
export const PaymentsConsole = () => {
  const [section, setSection] = useState<Section>('overview');
  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Payments sections" className="inline-flex rounded-xl bg-muted p-1">
        {SECTIONS.map((s) => (
          <button key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}
            className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors', section === s.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'overview' && <PaymentsOverview onRefunded={() => setSection('refunds')} />}
      {section === 'refunds' && <RefundsDesk />}
      {section === 'disputes' && <DisputesDesk />}
      {section === 'payouts' && <PayoutsDesk />}
    </div>
  );
};

export default PaymentsConsole;
