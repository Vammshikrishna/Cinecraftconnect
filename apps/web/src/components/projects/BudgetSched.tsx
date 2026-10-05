import { useState, useEffect } from 'react';
import { useProjectBudget, BudgetItem, ScheduleItem } from '@/hooks/useProjectBudget';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { exportElementToPDF } from '@/utils/pdfExport';
import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAppRole } from '@/hooks/useAppRole';

interface BudgetSchedProps {
  project_id: string;
}

const BudgetSched = ({ project_id }: BudgetSchedProps) => {
  const { isInternal } = useAppRole();

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
    <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar bg-transparent">
      <div className="flex flex-col gap-1 mb-12">
        <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Financials</h1>
        <p className="text-2xl sm:text-3xl font-extrabold text-foreground">Production Budget</p>
      </div>

      <div className="space-y-12 pb-24">
        {/* ── Budget Tracking ─────────────────────────────────────────────── */}
        <div className="bg-card border border-border shadow-sm p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Budget Tracking</h2>
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
                    className="bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md w-[95vw] bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20"
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20">
                    <TrendingUp />
                  </div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">
                    Total Estimated
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
                    ${totalEstimated.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {budgetData.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-accent/10 rounded-2xl hover:bg-accent/50 transition-all border border-border gap-4"
                  >
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-foreground text-base sm:text-lg">{item.item_name}</p>
                        <span className="text-[9px] font-bold px-2 py-1 bg-card border border-border shadow-sm rounded-full text-muted-foreground uppercase tracking-widest">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full sm:w-auto gap-8">
                      <p className="text-sm font-bold text-foreground">
                        ${item.estimated_cost?.toLocaleString()}
                      </p>
                      {!isInternal && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditBudget(item)}
                            className="text-muted-foreground hover:text-primary transition-colors p-2 h-10 w-10 rounded-full"
                          >
                            <Pencil className="h-5 w-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteBudgetItem.mutate(item.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors p-2 h-10 w-10 rounded-full"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <DollarSign className="w-12 h-12 mb-4" />
              <p className="text-sm font-medium">Financial data stream is empty.</p>
            </div>
          )}
        </div>

        {/* ── Production Roadmap ───────────────────────────────────────────── */}
        <div className="bg-card border border-border shadow-sm p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">Production Roadmap</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                variant={scheduleViewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScheduleViewMode('list')}
                className="rounded-xl h-10"
              >
                <LayoutList className="w-4 h-4 mr-2" /> List
              </Button>
              <Button
                variant={scheduleViewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScheduleViewMode('timeline')}
                className="rounded-xl h-10"
              >
                <CalendarDays className="w-4 h-4 mr-2" /> Timeline
              </Button>
              {scheduleViewMode === 'timeline' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportElementToPDF('timeline-export-container', 'Production_Schedule.pdf')}
                  className="rounded-xl h-10"
                >
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
                    className="bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Schedule Phase
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md w-full bg-card border border-border p-0 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-3xl">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                      <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">
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
                        className="flex-1 h-14 rounded-2xl font-bold text-lg border-border"
                        disabled={isScheduleSaving}
                      >
                        {isScheduleSaving ? <Loader2 className="animate-spin" /> : editingSchedule ? 'Save Changes' : 'Draft Phase'}
                      </Button>
                      {!isLocked && (
                        <Button
                          onClick={handleLockPhase}
                          className="flex-1 bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20"
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
              <div id="timeline-export-container" className="p-4 sm:p-6 bg-card border border-border rounded-3xl overflow-x-auto">
                <div className="min-w-full lg:min-w-[800px] space-y-4">
                  <h3 className="font-bold text-base sm:text-lg mb-4">Crew Availability & Schedule</h3>
                  
                  {/* Crew Members Rows */}
                  {projectMembers.map(member => {
                    const memberName = member.profiles?.full_name || member.profiles?.username || 'Unknown';
                    const memberSchedules = scheduleData.filter(s => s.assignees?.some(a => a.user_id === member.user_id) || s.is_full_crew);
                    const memberAvail = crewAvailabilityData.filter(a => a.user_id === member.user_id);
                    
                    if (memberSchedules.length === 0 && memberAvail.length === 0) return null;

                    return (
                      <div key={member.user_id} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-black/20 p-4 rounded-2xl border border-border/50">
                        <div className="w-full sm:w-48 shrink-0">
                          <p className="font-bold text-xs sm:text-sm truncate">{memberName}</p>
                        </div>
                        <div className="flex-1 flex gap-2 flex-wrap">
                          {memberSchedules.map(s => (
                            <div key={s.id} className="bg-primary/20 border border-primary text-primary px-3 py-1 rounded-full text-xs font-bold cursor-pointer" onClick={() => openEditSchedule(s)}>
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
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-black/20 p-4 rounded-2xl border border-border/50">
                      <div className="w-full sm:w-48 shrink-0">
                        <p className="font-bold text-xs sm:text-sm text-muted-foreground">Unassigned Phases</p>
                      </div>
                      <div className="flex-1 flex gap-2 flex-wrap">
                        {scheduleData.filter(s => (!s.assignees || s.assignees.length === 0) && !s.is_full_crew).map(s => (
                          <div key={s.id} className="bg-secondary/40 border border-border text-foreground px-3 py-1 rounded-full text-xs font-bold cursor-pointer" onClick={() => openEditSchedule(s)}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduleData.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 bg-white/5 rounded-3xl hover:bg-accent/50 border border-border transition-all group relative"
                  >
                    {item.is_locked && (
                      <div className="absolute top-0 right-0 m-4 p-1.5 bg-primary/20 text-primary rounded-full">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1 pr-8">
                          <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {formatDateRange(item.start_date, item.end_date)}
                            </p>
                          </div>
                          {item.is_full_crew ? (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3 text-primary" />
                              <span className="font-bold text-primary">Entire Crew (All Members)</span>
                            </div>
                          ) : item.assignees && item.assignees.length > 0 ? (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>Assigned to: {
                                item.assignees.length > 2 
                                ? `${item.assignees.length} Members` 
                                : item.assignees.map(a => projectMembers.find(m => m.user_id === a.user_id)?.profiles?.full_name?.split(' ')[0] || 'Member').join(', ')
                              }</span>
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter ${
                            item.status === 'completed'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : item.status === 'in-progress'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : item.status === 'delayed'
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-card border border-border shadow-sm'
                          }`}
                        >
                          {item.status?.replace('-', ' ') || 'scheduled'}
                        </span>
                      </div>
  
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-6 bg-black/20 p-3 rounded-xl border border-border line-clamp-2">
                          {item.description}
                        </p>
                      )}
  
                      {!isInternal && (
                        <div className="mt-auto flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditSchedule(item)}
                            className="text-muted-foreground hover:text-white p-2 h-9 w-9 rounded-full"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteScheduleItem.mutate(item.id)}
                            className="text-muted-foreground hover:text-red-400 p-2 h-9 w-9 rounded-full"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <Clock className="w-12 h-12 mb-4" />
              <p className="text-sm font-medium">No active production milestones.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetSched;
