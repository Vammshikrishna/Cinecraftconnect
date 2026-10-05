import { CalendarCheck, FileText } from 'lucide-react';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

/** Bookings (gear and locations) and Quotes (services) are two halves of one "Orders" area. */
export const OrdersTabs = ({ current }: { current: 'bookings' | 'quotes' }) => {
  const { push } = useAppNavigation();
  const tab = (key: 'bookings' | 'quotes', label: string, Icon: any, path: string) => (
    <button
      key={key}
      onClick={() => current !== key && push(path)}
      className={cn(
        'flex-1 sm:flex-none sm:px-8 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
        current === key ? 'bg-background shadow-md text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );
  return (
    <div className="inline-flex w-full sm:w-auto p-1.5 rounded-2xl bg-muted/50 border border-white/5 gap-1 mb-2">
      {tab('bookings', 'Bookings', CalendarCheck, '/marketplace/bookings')}
      {tab('quotes', 'Quotes', FileText, '/marketplace/quotes')}
    </div>
  );
};
