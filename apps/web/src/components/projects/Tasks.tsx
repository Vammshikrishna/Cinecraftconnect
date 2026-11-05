import { useState } from 'react';
import { useProjectTasks, type ProjectTask } from '@/hooks/useProjectTasks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, CheckCircle2, ChevronDown, ListChecks, Loader2, PartyPopper, Plus, RefreshCw, Search, ShieldAlert, Target, Trash2 } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';
import { cn } from '@/lib/utils';
import { FilterChips, WorkspaceCard, WorkspaceEmpty, WorkspaceHero, WorkspaceNotice } from './WorkspaceUI';

interface TasksProps {
  project_id: string;
}

type Filter = 'all' | 'open' | 'done';

/** A round progress dial for the side panel. */
const Dial = ({ percent }: { percent: number }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 mx-auto" role="img" aria-label={`${percent}% of tasks done`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-primary transition duration-700" strokeDasharray={c} strokeDashoffset={c - (c * percent) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums leading-none">{percent}%</p>
          <p className="text-xs text-muted-foreground mt-1">complete</p>
        </div>
      </div>
    </div>
  );
};

const dueLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const text = diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : diff < 0 ? `${-diff}d overdue` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { text, overdue: diff < 0, soon: diff >= 0 && diff <= 1 };
};

const Tasks = ({ project_id }: TasksProps) => {
  const { isInternal } = useAppRole();
  const [newTask, setNewTask] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(true);

  const { tasks, isLoading, error, addTask, toggleTask, deleteTask } = useProjectTasks(project_id);

  const done = tasks.filter((t) => t.is_completed).length;
  const open = tasks.length - done;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const visible = tasks
    .filter((t) => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => filter === 'all' || (filter === 'done' ? t.is_completed : !t.is_completed));
  const todo = visible.filter((t) => !t.is_completed);
  const finished = visible.filter((t) => t.is_completed);
  const upNext = tasks.find((t) => !t.is_completed);

  const handleAddTask = () => {
    const title = newTask.trim();
    if (!title) return;
    addTask.mutate(title, { onSuccess: () => setNewTask('') });
  };

  const Row = ({ task }: { task: ProjectTask }) => {
    const due = dueLabel(task.due_date);
    return (
      <li className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary/5">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.is_completed}
          onCheckedChange={() => !isInternal && toggleTask.mutate({ id: task.id, currentStatus: task.is_completed })}
          disabled={isInternal || toggleTask.isPending}
          className="h-5 w-5 rounded-full"
          aria-label={task.is_completed ? `Mark "${task.name}" as not done` : `Mark "${task.name}" as done`}
        />
        <label htmlFor={`task-${task.id}`} className={cn('flex-1 min-w-0 text-base leading-snug break-words', !isInternal && 'cursor-pointer', task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground')}>
          {task.name}
          {task.description && <span className="block text-sm text-muted-foreground no-underline mt-0.5">{task.description}</span>}
        </label>
        {due && !task.is_completed && (
          <span className={cn('hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', due.overdue ? 'bg-destructive/10 text-destructive' : due.soon ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground')}>
            <CalendarDays className="h-3 w-3" /> {due.text}
          </span>
        )}
        {task.is_completed && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden />}
        {!isInternal && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete task "${task.name}"`}
            onClick={() => deleteTask.mutate(task.id)}
            className="h-8 w-8 rounded-full text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </li>
    );
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
        <WorkspaceHero
          icon={ListChecks}
          title="Tasks"
          description={tasks.length > 0 ? `${done} of ${tasks.length} done` : 'What still needs doing on this production.'}
          stats={[
            { label: 'Total', value: tasks.length },
            { label: 'Open', value: open, tone: 'warn' },
            { label: 'Done', value: done, tone: 'success' },
            { label: 'Progress', value: `${percent}%`, tone: 'primary' },
          ]}
        />

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-between gap-3 text-destructive" role="alert">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Tasks could not be loaded</p>
                <p className="text-xs opacity-80">{(error as Error).message}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="text-destructive hover:bg-destructive/15 font-semibold">
              <RefreshCw className="h-4 w-4 mr-2" /> Try again
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
          {/* ── Left: add, filter, list ───────────────────────────── */}
          <div className="space-y-4 min-w-0">
            {!isInternal ? (
              <WorkspaceCard className="p-3">
                <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="flex items-center gap-2">
                  <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Plus className="h-5 w-5" /></span>
                  <Input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add a task, for example “Confirm the location permit”"
                    aria-label="New task"
                    className="h-10 border-0 shadow-none focus-visible:ring-0 bg-transparent px-1 text-base"
                  />
                  <Button type="submit" disabled={addTask.isPending || !newTask.trim()} className="h-10 rounded-xl px-5 font-semibold shrink-0">
                    {addTask.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Add task'}
                  </Button>
                </form>
              </WorkspaceCard>
            ) : (
              <WorkspaceNotice>Staff are in observation mode and cannot change tasks.</WorkspaceNotice>
            )}

            {tasks.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FilterChips<Filter>
                  label="Filter tasks"
                  value={filter}
                  onChange={setFilter}
                  options={[{ id: 'all', label: 'All', count: tasks.length }, { id: 'open', label: 'Open', count: open }, { id: 'done', label: 'Done', count: done }]}
                />
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search tasks" aria-label="Search tasks" className="pl-9 h-9 bg-card rounded-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            )}

            {isLoading && tasks.length === 0 ? (
              <div className="flex justify-center py-16" role="status" aria-label="Loading tasks">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length > 0 ? (
              <div className="space-y-4">
                {todo.length > 0 && (
                  <WorkspaceCard className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                      <h2 className="text-sm font-semibold">To do</h2>
                      <span className="text-xs text-muted-foreground tabular-nums">{todo.length}</span>
                    </div>
                    <ul className="divide-y divide-border">{todo.map((t) => <Row key={t.id} task={t} />)}</ul>
                  </WorkspaceCard>
                )}
                {finished.length > 0 && (
                  <WorkspaceCard className="overflow-hidden">
                    <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <h2 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Completed</h2>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">{finished.length}<ChevronDown className={cn('h-4 w-4 transition-transform', showDone && 'rotate-180')} /></span>
                    </button>
                    {showDone && <ul className="divide-y divide-border border-t border-border">{finished.map((t) => <Row key={t.id} task={t} />)}</ul>}
                  </WorkspaceCard>
                )}
              </div>
            ) : (
              <WorkspaceCard>
                <WorkspaceEmpty
                  icon={ListChecks}
                  title={searchQuery || filter !== 'all' ? 'No matching tasks' : 'No tasks yet'}
                  description={searchQuery || filter !== 'all' ? 'Try a different word or filter.' : 'Add the first task above to start tracking the work.'}
                />
              </WorkspaceCard>
            )}
          </div>

          {/* ── Right: how the work is going ──────────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-0">
            <WorkspaceCard className="p-5">
              <h2 className="text-sm font-semibold mb-4">Overall progress</h2>
              <Dial percent={percent} />
              <p className="text-center text-sm text-muted-foreground mt-4">
                {tasks.length === 0 ? 'Nothing to track yet.' : open === 0 ? 'Everything is done.' : `${open} ${open === 1 ? 'task' : 'tasks'} left to finish`}
              </p>
            </WorkspaceCard>

            <WorkspaceCard className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                {open === 0 && tasks.length > 0 ? <PartyPopper className="h-4 w-4 text-primary" /> : <Target className="h-4 w-4 text-primary" />}
                {open === 0 && tasks.length > 0 ? 'All wrapped up' : 'Up next'}
              </h2>
              {upNext ? (
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
                  <p className="text-sm font-medium text-foreground break-words">{upNext.name}</p>
                  {dueLabel(upNext.due_date) && <p className="text-xs text-muted-foreground mt-1">{dueLabel(upNext.due_date)!.text}</p>}
                  {!isInternal && (
                    <Button size="sm" variant="outline" className="mt-3 h-8 rounded-lg" onClick={() => toggleTask.mutate({ id: upNext.id, currentStatus: false })}>
                      Mark as done
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{tasks.length === 0 ? 'Your next task will show here.' : 'Nothing left to do. Add a task when something new comes up.'}</p>
              )}
            </WorkspaceCard>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
