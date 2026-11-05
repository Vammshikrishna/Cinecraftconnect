import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { useProjectBudget, BudgetItem, ScheduleItem } from '@/hooks/useProjectBudget';
import { useProjectCallSheets } from '@/hooks/useProjectCallSheets';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
  Download,
  LayoutList,
  CalendarDays,
  Lock,
  Users,
  CheckSquare,
} from 'lucide-react';
import { WorkspaceEmpty, WorkspaceHero } from './WorkspaceUI';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { exportElementToPDF } from '@/utils/pdfExport';
import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAppRole } from '@/hooks/useAppRole';

interface BudgetSchedProps {
  project_id: string;
}

const CATEGORY_COLORS = ['bg-primary', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500'];

const STATUS_STYLE: Record<string, { label: string; chip: string; bar: string }> = {
  scheduled: { label: 'Scheduled', chip: 'bg-sky-500/10 text-sky-600', bar: 'bg-sky-500' },
  'in-progress': { label: 'In progress', chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  completed: { label: 'Completed', chip: 'bg-emerald-500/15 text-emerald-600', bar: 'bg-emerald-500' },
  delayed: { label: 'Delayed', chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
};

const money = (n: number) => '$' + Math.round(n).toLocaleString();

/** A trash button that asks before deleting (budget lines and schedule phases used to disappear on one tap). */
const ConfirmDelete = ({ label, what, onConfirm }: { label: string; what: string; onConfirm: () => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button aria-label={label} size="icon" variant="ghost" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
        <AlertDialogDescription>This removes it for everyone in the project. It cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const BudgetSched = ({ project_id }: BudgetSchedProps) => {
  const { toast } = useToast();
  const { isInternal } = useAppRole();
  const { callSheets } = useProjectCallSheets(project_id);

  const {
    budgetData,
    scheduleData,
    crewAvailabilityData,
    isLoading,
    budgetError,
    scheduleError,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
  } = useProjectBudget(project_id);

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  
  // ── View mode state ──────────────────────────────────────────────────────
  const [scheduleViewMode, setScheduleViewMode] = useState<'list' | 'timeline'>('list');
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_space_members' as any)
        .select('user_id, profiles(full_name, username)')
        .eq('project_space_id', project_id);
      if (data) setProjectMembers(data);
    };
    fetchMembers();
  }, [project_id]);

  // ── Budget form ──────────────────────────────────────────────────────────
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetItemName, setBudgetItemName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');

  // ── Schedule form ────────────────────────────────────────────────────────
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('scheduled');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const resetBudgetForm = () => {
    setBudgetCategory('');
    setBudgetItemName('');
    setEstimatedCost('');
    setEditingBudget(null);
  };

  const resetScheduleForm = () => {
    setScheduleTitle('');
    setScheduleDescription('');
    setStartDate('');
    setEndDate('');
    setScheduleStatus('scheduled');
    setAssignedTo([]);
    setIsLocked(false);
    setConflictWarning(null);
    setEditingSchedule(null);
  };

  // ── Budget handlers ──────────────────────────────────────────────────────
  const handleBudgetSubmit = () => {
    const amount = estimatedCost.trim() === '' ? 0 : Number(estimatedCost);
    if (!budgetCategory.trim() || !budgetItemName.trim()) {
      toast({ title: 'Fill in the details', description: 'Give the item a category and a name.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'Check the amount', description: 'The amount must be a number that is zero or more.', variant: 'destructive' });
      return;
    }
    if (editingBudget) {
      updateBudgetItem.mutate(
        {
          id: editingBudget.id,
          category: budgetCategory,
          item_name: budgetItemName,
          estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
        },
        { onSuccess: () => { setBudgetDialogOpen(false); resetBudgetForm(); } }
      );
    } else {
      addBudgetItem.mutate(
        {
          category: budgetCategory,
          item_name: budgetItemName,
          estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
        },
        { onSuccess: () => { setBudgetDialogOpen(false); resetBudgetForm(); } }
      );
    }
  };

  const openEditBudget = (item: BudgetItem) => {
    setEditingBudget(item);
    setBudgetCategory(item.category);
    setBudgetItemName(item.item_name);
    setEstimatedCost(item.estimated_cost?.toString() || '');
    setBudgetDialogOpen(true);
  };

  // ── Schedule handlers ────────────────────────────────────────────────────
  const checkConflicts = (assignees: string[], sDate: string, eDate: string) => {
    if (assignees.length === 0) return null;
    
    // Support for Entire Crew check
    if (assignees.includes('all_crew')) {
      const personalConflicts = crewAvailabilityData.filter(a => 
        a.status === 'booked' && 
        ((a.start_date <= eDate && a.end_date >= sDate))
      );
      if (personalConflicts.length > 0) {
        const conflictingMember = projectMembers.find(m => m.user_id === personalConflicts[0].user_id);
        return `${conflictingMember?.profiles?.full_name || 'A crew member'} is marked as BOOKED in their personal calendar for these dates.`;
      }
      const scheduleConflicts = scheduleData.filter(s => 
        s.is_locked && 
        s.id !== editingSchedule?.id &&
        ((s.start_date <= eDate && (s.end_date || s.start_date) >= sDate))
      );
      if (scheduleConflicts.length > 0) return 'One or more crew members are already LOCKED into another schedule phase on these dates.';
      return null;
    }

    // Check personal availability for multiple crew members
    const personalConflicts = crewAvailabilityData.filter(a => 
      assignees.includes(a.user_id) && 
      a.status === 'booked' && 
      ((a.start_date <= eDate && a.end_date >= sDate))
    );
    
    if (personalConflicts.length > 0) {
      const conflictingMember = projectMembers.find(m => m.user_id === personalConflicts[0].user_id);
      return `${conflictingMember?.profiles?.full_name || 'A crew member'} is marked as BOOKED in their personal calendar for these dates.`;
    }
    
    // Check other locked schedule items
    const scheduleConflicts = scheduleData.filter(s => 
      s.is_locked && 
      s.id !== editingSchedule?.id &&
      s.assignees?.some(a => assignees.includes(a.user_id)) &&
      ((s.start_date <= eDate && (s.end_date || s.start_date) >= sDate))
    );
    
    if (scheduleConflicts.length > 0) return 'One or more selected crew members are already LOCKED into another schedule phase on these dates.';
    
    return null;
  };

  const handleScheduleSubmit = (lockOverride?: boolean) => {
    const end = endDate || startDate;
    const conflict = checkConflicts(assignedTo, startDate, end);
    if (conflict && !conflictWarning) {
      setConflictWarning(conflict);
      return; // Stop submission to show warning
    }

    const finalIsLocked = lockOverride !== undefined ? lockOverride : isLocked;

    const payload = {
      title: scheduleTitle,
      description: scheduleDescription,
      start_date: startDate,
      end_date: endDate || null,
      status: scheduleStatus,
      is_locked: finalIsLocked,
      is_full_crew: assignedTo.includes('all_crew'),
      assignees: assignedTo.includes('all_crew') ? [] : assignedTo,
    };

    if (editingSchedule) {
      updateScheduleItem.mutate(
        { id: editingSchedule.id, ...payload },
        { onSuccess: () => { setScheduleDialogOpen(false); resetScheduleForm(); } }
      );
    } else {
      addScheduleItem.mutate(
        payload,
        { onSuccess: () => { setScheduleDialogOpen(false); resetScheduleForm(); } }
      );
    }
  };

  const handleLockPhase = () => {
    setIsLocked(true);
    handleScheduleSubmit(true);
  };

  const openEditSchedule = (item: ScheduleItem) => {
    setEditingSchedule(item);
    setScheduleTitle(item.title);
    setScheduleDescription(item.description || '');
    setStartDate(item.start_date);
    setEndDate(item.end_date || '');
    setScheduleStatus(item.status || 'scheduled');
    setAssignedTo(item.is_full_crew ? ['all_crew'] : (item.assignees?.map(a => a.user_id) || []));
    setIsLocked(item.is_locked || false);
    setConflictWarning(null);
    setScheduleDialogOpen(true);
  };

  const totalEstimated = budgetData.reduce((sum, item) => sum + (item.estimated_cost || 0), 0);

  const formatDateRange = (start: string, end: string | null) => {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end
      ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Ongoing';
    return `${s} — ${e}`;
  };

  const isBudgetSaving = addBudgetItem.isPending || updateBudgetItem.isPending;
  const isScheduleSaving = addScheduleItem.isPending || updateScheduleItem.isPending;

  if (budgetError || scheduleError) {
    return (
      <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">
        Error loading data.
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full overflow-y-auto no-scrollbar bg-transparent">
      <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <WorkspaceHero
          icon={DollarSign}
          title="Budget and schedule"
          description="Track spending and plan the phases of the shoot."
          stats={[
            { label: 'Estimated budget', value: `$${totalEstimated.toLocaleString()}`, tone: 'primary' },
            { label: 'Budget lines', value: budgetData.length },
            { label: 'Phases', value: scheduleData.length },
            { label: 'Locked', value: scheduleData.filter((x: any) => x.is_locked).length, tone: 'warn' },
          ]}
        />
      </div>

      <div className="space-y-6 pb-24">
        {/* ── Budget Tracking ─────────────────────────────────────────────── */}
        <div className="bg-card border border-border p-4 sm:p-6 rounded-2xl">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div><h2 className="text-lg font-semibold text-foreground leading-tight">Budget</h2><p className="text-xs text-muted-foreground">Estimated cost by category</p></div>
            </div>
            {!isInternal && (
              <Dialog
                open={budgetDialogOpen}
                onOpenChange={(open) => {
                  setBudgetDialogOpen(open);
                  if (!open) resetBudgetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-xl px-5 h-10 font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md w-[95vw] bg-card border border-border p-0 rounded-2xl overflow-hidden shadow-md">
                  <DialogHeader className="p-6 border-b border-border">
                    <DialogTitle className="text-xl font-bold text-foreground">
                      {editingBudget ? 'Update' : 'New'} Allocation
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-1">
                      Define financial constraints for this production asset.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Asset Category
                      </Label>
                      <Input
                        value={budgetCategory}
                        onChange={(e) => setBudgetCategory(e.target.value)}
                        placeholder="e.g., Equipment, Talent"
                        className="bg-background border-border rounded-xl h-12 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Asset Name
                      </Label>
                      <Input
                        value={budgetItemName}
                        onChange={(e) => setBudgetItemName(e.target.value)}
                        placeholder="e.g., 4K Camera Rig"
                        className="bg-background border-border rounded-xl h-12 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Amount ($)
                      </Label>
                      <Input
                        type="number"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                        className="bg-background border-border rounded-xl h-12 focus:border-primary/50"
                      />
                    </div>
                    <Button
                      onClick={handleBudgetSubmit}
                      className="w-full bg-primary hover:bg-primary/80 h-12 rounded-xl font-semibold text-base shadow-sm"
                      disabled={isBudgetSaving}
                    >
                      {isBudgetSaving ? (
                        <Loader2 className="animate-spin" />
                      ) : editingBudget ? (
                        'Update Asset'
                      ) : (
                        'Add Allocation'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isLoading && budgetData.length === 0 ? (
            <div className="flex items-center justify-center py-12 opacity-30">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : budgetData.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                const groups = new Map<string, typeof budgetData>();
                budgetData.forEach((it) => {
                  const key = (it.category || 'Other').trim() || 'Other';
                  groups.set(key, [...(groups.get(key) || []), it]);
                });
                const list = [...groups.entries()]
                  .map(([name, items]) => ({ name, items, total: items.reduce((a, b) => a + (b.estimated_cost || 0), 0) }))
                  .sort((a, b) => b.total - a.total);
                return (
                  <>
                    <div>
                      <div className="flex items-end justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Total estimated</p>
                          <p className="text-3xl font-bold text-foreground tabular-nums">{money(totalEstimated)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{budgetData.length} {budgetData.length === 1 ? 'line' : 'lines'} in {list.length} {list.length === 1 ? 'category' : 'categories'}</p>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted" role="img" aria-label="Share of the budget by category">
                        {list.map((g, i) => <div key={g.name} className={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} style={{ width: `${totalEstimated ? (g.total / totalEstimated) * 100 : 0}%` }} title={`${g.name}: ${money(g.total)}`} />)}
                      </div>
                      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                        {list.map((g, i) => (
                          <li key={g.name} className="flex items-center gap-2 text-sm">
                            <span className={cn('h-2.5 w-2.5 rounded-full', CATEGORY_COLORS[i % CATEGORY_COLORS.length])} />
                            <span className="capitalize text-foreground">{g.name}</span>
                            <span className="text-muted-foreground tabular-nums">{totalEstimated ? Math.round((g.total / totalEstimated) * 100) : 0}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      {list.map((g, i) => (
                        <div key={g.name} className="rounded-xl border border-border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                            <span className="flex items-center gap-2 text-sm font-semibold capitalize"><span className={cn('h-2.5 w-2.5 rounded-full', CATEGORY_COLORS[i % CATEGORY_COLORS.length])} />{g.name}</span>
                            <span className="text-sm font-semibold tabular-nums">{money(g.total)}</span>
                          </div>
                          <ul className="divide-y divide-border">
                            {g.items.map((item) => (
                              <li key={item.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden max-w-xs"><div className={cn('h-full rounded-full', CATEGORY_COLORS[i % CATEGORY_COLORS.length])} style={{ width: `${totalEstimated ? ((item.estimated_cost || 0) / totalEstimated) * 100 : 0}%` }} /></div>
                                </div>
                                <p className="text-sm font-semibold tabular-nums text-foreground shrink-0">{money(item.estimated_cost || 0)}</p>
                                {!isInternal && (
                                  <div className="flex shrink-0">
                                    <Button aria-label={`Edit ${item.item_name}`} size="icon" variant="ghost" onClick={() => openEditBudget(item)} className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></Button>
                                    <ConfirmDelete label={`Delete ${item.item_name}`} what={item.item_name} onConfirm={() => deleteBudgetItem.mutate(item.id)} />
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

          ) : (
            <WorkspaceEmpty icon={DollarSign} title="No budget lines yet" description="Add what you expect to spend, like equipment, talent or locations, to see where the money goes." />
          )}
        </div>

        {/* ── Production Roadmap ───────────────────────────────────────────── */}
        <div className="bg-card border border-border p-4 sm:p-6 rounded-2xl">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0"><h2 className="text-lg font-semibold text-foreground leading-tight truncate">Production roadmap</h2><p className="text-xs text-muted-foreground">Phases of the shoot and who is on them</p></div>
            </div>
            <div className="flex items-center gap-2 order-3 sm:order-none w-full sm:w-auto">
              <div role="tablist" aria-label="Roadmap view" className="inline-flex rounded-xl bg-muted p-1">
                {([['list', 'List', LayoutList], ['timeline', 'Timeline', CalendarDays]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" role="tab" aria-selected={scheduleViewMode === id} onClick={() => setScheduleViewMode(id)}
                    className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-colors', scheduleViewMode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              {scheduleViewMode === 'timeline' && (
                <Button variant="outline" size="sm" onClick={() => exportElementToPDF('timeline-export-container', 'Production_Schedule.pdf')} className="rounded-xl h-10">
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </Button>
              )}
            </div>
            {!isInternal && (
              <Dialog
                open={scheduleDialogOpen}
                onOpenChange={(open) => {
                  setScheduleDialogOpen(open);
                  if (!open) resetScheduleForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-xl px-5 h-10 font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Schedule Phase
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md w-full bg-card border border-border p-0 rounded-2xl sm:rounded-2xl overflow-hidden shadow-md">
                  <DialogHeader className="p-4 sm:p-6 border-b border-border">
                    <DialogTitle className="text-xl font-bold text-foreground">
                      {editingSchedule ? 'Edit' : 'Create'} Milestone
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-1">
                      Map out a critical phase of your film production.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Phase Title
                      </Label>
                      <Input
                        value={scheduleTitle}
                        onChange={(e) => setScheduleTitle(e.target.value)}
                        placeholder="e.g., Principle Photography"
                        className="bg-background border-border rounded-xl h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Phase Description
                      </Label>
                      <Textarea
                        value={scheduleDescription}
                        onChange={(e) => setScheduleDescription(e.target.value)}
                        placeholder="Overview of goals..."
                        className="bg-background border-border rounded-xl min-h-[80px] resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Start
                        </Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-background border-border rounded-xl h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Target End
                        </Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-background border-border rounded-xl h-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Current Status
                      </Label>
                      <Select value={scheduleStatus} onValueChange={setScheduleStatus}>
                        <SelectTrigger className="bg-background border-border rounded-xl h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border rounded-2xl">
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Assign Crew Members
                      </Label>
                      <div className="bg-background border border-border rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-3">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="all_crew"
                            checked={assignedTo.includes('all_crew')}
                            onCheckedChange={(checked) => {
                              if (checked) setAssignedTo(['all_crew']);
                              else setAssignedTo([]);
                            }}
                          />
                          <label htmlFor="all_crew" className="text-sm font-bold text-primary cursor-pointer">Entire Crew (All Members)</label>
                        </div>
                        <div className="h-px bg-border/50 my-2" />
                        {projectMembers.map((m) => (
                          <div key={m.user_id} className="flex items-center space-x-3">
                            <Checkbox
                              id={m.user_id}
                              checked={assignedTo.includes(m.user_id)}
                              disabled={assignedTo.includes('all_crew')}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setAssignedTo(prev => [...prev.filter(id => id !== 'all_crew'), m.user_id]);
                                } else {
                                  setAssignedTo(prev => prev.filter(id => id !== m.user_id));
                                }
                              }}
                            />
                            <label htmlFor={m.user_id} className="text-sm cursor-pointer hover:text-primary transition-colors">{m.profiles?.full_name || m.profiles?.username}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {conflictWarning && (
                      <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 rounded-xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Availability Conflict</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                          {conflictWarning}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => handleScheduleSubmit()}
                        variant="outline"
                        className="flex-1 h-12 rounded-xl font-semibold text-base border-border"
                        disabled={isScheduleSaving}
                      >
                        {isScheduleSaving ? <Loader2 className="animate-spin" /> : editingSchedule ? 'Save Changes' : 'Draft Phase'}
                      </Button>
                      {!isLocked && (
                        <Button
                          onClick={handleLockPhase}
                          className="flex-1 bg-primary hover:bg-primary/80 h-12 rounded-xl font-semibold text-base shadow-sm"
                          disabled={isScheduleSaving}
                        >
                          <Lock className="w-4 h-4 mr-2" /> Lock Phase
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isLoading && scheduleData.length === 0 ? (
            <div className="flex items-center justify-center py-12 opacity-30">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : scheduleData.length > 0 ? (
            scheduleViewMode === 'timeline' ? (
              <div id="timeline-export-container" className="p-4 sm:p-6 bg-card border border-border rounded-2xl overflow-x-auto">
                <div className="min-w-full lg:min-w-[800px] space-y-4">
                  <h3 className="font-semibold text-base mb-4">Crew availability and schedule</h3>
                  
                  {/* Crew Members Rows */}
                  {projectMembers.map(member => {
                    const memberName = member.profiles?.full_name || member.profiles?.username || 'Unknown';
                    const memberSchedules = scheduleData.filter(s => s.assignees?.some(a => a.user_id === member.user_id) || s.is_full_crew);
                    const memberAvail = crewAvailabilityData.filter(a => a.user_id === member.user_id);
                    
                    if (memberSchedules.length === 0 && memberAvail.length === 0) return null;

                    return (
                      <div key={member.user_id} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-muted/40 p-4 rounded-2xl border border-border">
                        <div className="w-full sm:w-48 shrink-0">
                          <p className="font-bold text-xs sm:text-sm truncate">{memberName}</p>
                        </div>
                        <div className="flex-1 flex gap-2 flex-wrap">
                          {memberSchedules.map(s => (
                            <div key={s.id} className="bg-primary/20 border border-primary text-primary px-3 py-1 rounded-full text-xs font-bold cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => openEditSchedule(s)}>
                              {s.title} ({formatDateRange(s.start_date, s.end_date)})
                              {s.is_locked && <Lock className="inline w-3 h-3 ml-1" />}
                            </div>
                          ))}
                          {memberAvail.map(a => (
                            <div key={a.id} className={`px-3 py-1 rounded-full text-xs font-bold ${a.status === 'booked' ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500'}`}>
                              Personal: {a.status} ({formatDateRange(a.start_date, a.end_date)})
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned Phases */}
                  {scheduleData.filter(s => (!s.assignees || s.assignees.length === 0) && !s.is_full_crew).length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-muted/40 p-4 rounded-2xl border border-border">
                      <div className="w-full sm:w-48 shrink-0">
                        <p className="font-bold text-xs sm:text-sm text-muted-foreground">Unassigned Phases</p>
                      </div>
                      <div className="flex-1 flex gap-2 flex-wrap">
                        {scheduleData.filter(s => (!s.assignees || s.assignees.length === 0) && !s.is_full_crew).map(s => (
                          <div key={s.id} className="bg-secondary/40 border border-border text-foreground px-3 py-1 rounded-full text-xs font-bold cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => openEditSchedule(s)}>
                            {s.title} ({formatDateRange(s.start_date, s.end_date)})
                            {s.is_locked && <Lock className="inline w-3 h-3 ml-1" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scheduleData.map((item) => {
                  const st = STATUS_STYLE[item.status || 'scheduled'] || STATUS_STYLE.scheduled;
                  const start = new Date(item.start_date).getTime();
                  const end = item.end_date ? new Date(item.end_date).getTime() : null;
                  const days = end ? Math.max(1, Math.round((end - start) / 86400000) + 1) : null;
                  const pct = end && end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : item.status === 'completed' ? 100 : 0;
                  const shown = item.status === 'completed' ? 100 : item.status === 'scheduled' ? 0 : pct;
                  const sheetsInPhase = callSheets.filter((c) => {
                    const t = new Date(c.date).setHours(0, 0, 0, 0);
                    const a = new Date(item.start_date).setHours(0, 0, 0, 0);
                    const b = item.end_date ? new Date(item.end_date).setHours(0, 0, 0, 0) : a;
                    return t >= a && t <= b;
                  }).length;
                  const names = item.is_full_crew ? ['Entire crew'] : (item.assignees || []).map((a) => projectMembers.find((m) => m.user_id === a.user_id)?.profiles?.full_name || 'Member');
                  return (
                    <div key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 hover:shadow-sm transition-shadow">
                      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', st.bar)} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 min-w-0">
                            <span className="truncate">{item.title}</span>
                            {item.is_locked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="Locked" />}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> {formatDateRange(item.start_date, item.end_date)}{days ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
                          </p>
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', st.chip)}>{st.label}</span>
                      </div>

                      {item.description && <p className="mt-3 text-sm text-foreground/80 leading-relaxed line-clamp-3">{item.description}</p>}

                      <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown)} aria-label={`${item.title} progress`}>
                        <div className={cn('h-full rounded-full transition-[width]', st.bar)} style={{ width: `${shown}%` }} />
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {sheetsInPhase === 0 ? 'No call sheets yet' : `${sheetsInPhase} ${sheetsInPhase === 1 ? 'call sheet' : 'call sheets'}`}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {names.length > 0 ? (
                            <>
                              <div className="flex -space-x-2">
                                {names.slice(0, 3).map((n, i) => (
                                  <span key={i} className="h-7 w-7 rounded-full bg-primary/10 text-primary border-2 border-card grid place-items-center text-xs font-semibold">{n.charAt(0).toUpperCase()}</span>
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">{item.is_full_crew ? 'Entire crew' : names.length > 2 ? `${names.length} members` : names.map((n) => n.split(' ')[0]).join(', ')}</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> No one assigned</span>
                          )}
                        </div>
                        {!isInternal && (
                          <div className="flex shrink-0">
                            <Button aria-label={`Edit ${item.title}`} size="icon" variant="ghost" onClick={() => openEditSchedule(item)} className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></Button>
                            <ConfirmDelete label={`Delete ${item.title}`} what={item.title} onConfirm={() => deleteScheduleItem.mutate(item.id)} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <WorkspaceEmpty icon={Clock} title="No phases planned" description="Schedule the phases of the shoot, like prep, principal photography and post, and assign your crew." />
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default BudgetSched;
