import { BadgeCheck, CreditCard, Sparkles } from 'lucide-react';
import { formatMoney } from '@cinecraft/core';
import { Button } from '@/components/ui/button';
import type { ProductAccess } from '@/hooks/useProductAccess';

const BILLING_WORD = { one_time: 'one-time', monthly: 'a month', yearly: 'a year' } as const;

/**
 * The line shown above a form that needs a separate paid product. Free during the beta; once live it either confirms the
 * purchase is active or offers to buy it. The form around it decides whether to block submitting (see `needsPurchase`).
 */
export const ProductNotice = ({ access, onBuy, buying }: { access: ProductAccess; onBuy: () => void; buying: boolean }) => {
  if (!access.found) return null;

  if (!access.required) {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span><span className="font-semibold">Free during the beta.</span> <span className="text-muted-foreground">This will be a paid {access.name?.toLowerCase()} later.</span></span>
      </div>
    );
  }

  if (access.has_access) {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm">
        <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          <span className="font-semibold">{access.name} is active</span>
          {access.valid_until && <span className="text-muted-foreground"> until {new Date(access.valid_until).toLocaleDateString()}</span>}
          {typeof access.uses_remaining === 'number' && <span className="text-muted-foreground">, {access.uses_remaining} {access.uses_remaining === 1 ? 'submission' : 'submissions'} left</span>}
        </span>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-2xl border border-border bg-card p-4">
      <p className="font-semibold">{access.name}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{access.description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold tabular-nums">
          {formatMoney(access.price_minor ?? 0, access.currency)} <span className="text-sm font-normal text-muted-foreground">{BILLING_WORD[access.billing || 'one_time']}</span>
        </p>
        <Button onClick={onBuy} disabled={buying || access.is_active === false} className="h-10 rounded-xl gap-1.5 font-semibold">
          <CreditCard className="h-4 w-4" /> {access.is_active === false ? 'Not on sale yet' : buying ? 'Opening' : 'Buy'}
        </Button>
      </div>
    </div>
  );
};

export default ProductNotice;
