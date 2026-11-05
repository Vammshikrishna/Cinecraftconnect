import { ReactNode } from 'react';
import { CalendarClock, MapPin, Banknote, Users, ShieldCheck } from 'lucide-react';

interface Availability {
  status?: string | null; booked_until?: string | null; rate_min?: number | null; rate_max?: number | null;
  rate_currency?: string | null; cities?: string[] | null; note?: string | null;
}

const Row = ({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) => (
  <div className="flex gap-3">
    <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground leading-snug [overflow-wrap:anywhere]">{children}</div>
    </div>
  </div>
);

const rate = (a: Availability) => {
  if (a.rate_min == null && a.rate_max == null) return null;
  const c = a.rate_currency || 'INR';
  if (a.rate_min != null && a.rate_max != null) return `${c} ${a.rate_min} - ${a.rate_max} per day`;
  return a.rate_min != null ? `from ${c} ${a.rate_min} per day` : `up to ${c} ${a.rate_max} per day`;
};

/**
 * "At a glance" next to the profile header: work availability (only what the person lets you see), the day rate,
 * the cities they work in, and memberships.
 */
export const ProfileDetailsCard = ({ availability, unions }: {
  availability?: Availability | null;
  unions?: string[] | null;
}) => {
  const a = availability || null;
  const status = a?.status === 'open' ? 'Open to work' : a?.status === 'booked' ? 'Booked' : null;
  const until = a?.status === 'booked' && a.booked_until ? ` until ${new Date(a.booked_until).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  const price = a ? rate(a) : null;
  const cities = Array.isArray(a?.cities) ? a!.cities! : [];
  const memberships = (unions || []).filter(Boolean);
  const hasAnything = status || price || cities.length > 0 || a?.note || memberships.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="space-y-4 border-t border-border/50 pt-5" aria-label="At a glance">
      {status && (
        <Row icon={<CalendarClock size={16} />} label="Work">
          <span className={a?.status === 'open' ? 'text-emerald-600' : 'text-amber-600'}>{status}{until}</span>
          {a?.note && <span className="block text-sm font-normal text-muted-foreground mt-0.5">{a.note}</span>}
        </Row>
      )}
      {price && <Row icon={<Banknote size={16} />} label="Day rate">{price}</Row>}
      {cities.length > 0 && <Row icon={<MapPin size={16} />} label="Works in">{cities.join(', ')}</Row>}
      {memberships.length > 0 && <Row icon={<ShieldCheck size={16} />} label="Memberships">{memberships.join(', ')}</Row>}
      {!status && a?.note && <Row icon={<Users size={16} />} label="Note">{a.note}</Row>}
    </div>
  );
};
