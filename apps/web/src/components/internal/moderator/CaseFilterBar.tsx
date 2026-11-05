import { Button } from '@/components/ui/button';
import SavedViewsBar from '@/components/internal/shared/SavedViewsBar';
import { DEFAULT_FILTER, isDefaultFilter, parseFilter, type QueueFilter } from './caseTools';

const SELECT = 'h-8 rounded-lg border border-border/50 bg-background/60 px-2 text-[12px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20';

interface Props {
  filter: QueueFilter;
  onChange: (f: QueueFilter) => void;
  /** only open cases have a deadline and an owner */
  open: boolean;
}

/** Search, filters and sort for the queue, plus filters a moderator saves to come back to (staff_saved_views, scope mod.queue). */
const CaseFilterBar = ({ filter, onChange, open }: Props) => {
  const set = (patch: Partial<QueueFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="px-4 py-3 border-b border-border/10 space-y-2" role="search" aria-label="Filter the queue">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Search reason, reporter or id"
          aria-label="Search the queue"
          className="h-8 flex-1 min-w-[140px] rounded-lg border border-border/50 bg-background/60 px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {open && (
          <select aria-label="Priority" className={SELECT} value={filter.priority} onChange={(e) => set({ priority: e.target.value as QueueFilter['priority'] })}>
            <option value="all">Any priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        )}
        {open && (
          <select aria-label="Deadline" className={SELECT} value={filter.sla} onChange={(e) => set({ sla: e.target.value as QueueFilter['sla'] })}>
            <option value="all">Any deadline</option>
            <option value="overdue">Overdue</option>
            <option value="soon">Due within 1h</option>
          </select>
        )}
        {open && (
          <select aria-label="Owner" className={SELECT} value={filter.owner} onChange={(e) => set({ owner: e.target.value as QueueFilter['owner'] })}>
            <option value="all">Anyone</option>
            <option value="mine">Mine</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
        )}
        <select aria-label="Sort" className={SELECT} value={filter.sort} onChange={(e) => set({ sort: e.target.value as QueueFilter['sort'] })}>
          <option value="due">Soonest deadline</option>
          <option value="priority">Highest priority</option>
          <option value="reports">Most reports</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        {!isDefaultFilter(filter) && (
          <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => onChange(DEFAULT_FILTER)}>Clear</Button>
        )}
      </div>
      <SavedViewsBar scope="mod.queue" current={filter} isDefault={isDefaultFilter(filter)} onApply={(f) => onChange(parseFilter(f))} />
    </div>
  );
};

export default CaseFilterBar;
