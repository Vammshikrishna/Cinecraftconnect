import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, DollarSign, Calendar, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';

interface BudgetItem {
    id: string;
    category: string;
    item_name: string;
    estimated_cost: number | null;
    actual_cost: number | null;
    notes: string | null;
}

interface ScheduleItem {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    status: string | null;
}

interface BudgetSchedProps {
    project_id: string;
}

const BudgetSched = ({ project_id }: BudgetSchedProps) => {
    const { isInternal } = useAppRole();
    const { data: rawBudget, error: budgetError } = useRealtimeData<BudgetItem>('budget_items', 'project_id', project_id);
    const { data: rawSchedule, error: scheduleError } = useRealtimeData<ScheduleItem>('schedule_items', 'project_id', project_id);
    const { toast } = useToast();

    // Local state for decrypted data
    const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
    const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);

    const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
    const [saving, setSaving] = useState(false);

    // Budget form state
    const [budgetCategory, setBudgetCategory] = useState('');
    const [budgetItemName, setBudgetItemName] = useState('');
    const [estimatedCost, setEstimatedCost] = useState('');

    // Schedule form state
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [scheduleDescription, setScheduleDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [scheduleStatus, setScheduleStatus] = useState('scheduled');

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
        setEditingSchedule(null);
    };

    useEffect(() => {
        setBudgetData(rawBudget || []);
        setScheduleData(rawSchedule || []);
    }, [rawBudget, rawSchedule]);

    const handleAddBudgetItem = async () => {
        if (!budgetCategory || !budgetItemName) {
            toast({ title: "Error", description: "Category and item name are required", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('budget_items' as any)
                .insert([{
                    project_id,
                    category: budgetCategory,
                    item_name: budgetItemName,
                    estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
                    actual_cost: 0,
                }]);

            if (error) throw error;
            toast({ title: "Success", description: "Budget allocation locked" });
            setBudgetDialogOpen(false);
            resetBudgetForm();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateBudgetItem = async () => {
        if (!editingBudget) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('budget_items' as any)
                .update({
                    category: budgetCategory,
                    item_name: budgetItemName,
                    estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
                })
                .eq('id', editingBudget.id);

            if (error) throw error;
            toast({ title: "Success", description: "Budget item updated" });
            setBudgetDialogOpen(false);
            resetBudgetForm();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBudgetItem = async (id: string) => {
        if (!confirm('Delete this budget item?')) return;
        const { error } = await supabase.from('budget_items' as any).delete().eq('id', id);
        if (error) toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
        else toast({ title: "Success", description: "Item deleted" });
    };

    const handleAddScheduleItem = async () => {
        if (!scheduleTitle || !startDate) {
            toast({ title: "Error", description: "Title and start date are required", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('schedule_items' as any)
                .insert([{
                    project_id,
                    title: scheduleTitle,
                    description: scheduleDescription,
                    start_date: startDate,
                    end_date: endDate || null,
                    status: scheduleStatus
                }]);

            if (error) throw error;
            toast({ title: "Success", description: "Schedule item added" });
            setScheduleDialogOpen(false);
            resetScheduleForm();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateScheduleItem = async () => {
        if (!editingSchedule) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('schedule_items' as any)
                .update({
                    title: scheduleTitle,
                    description: scheduleDescription,
                    start_date: startDate,
                    end_date: endDate || null,
                    status: scheduleStatus
                })
                .eq('id', editingSchedule.id);

            if (error) throw error;
            toast({ title: "Success", description: "Schedule item updated" });
            setScheduleDialogOpen(false);
            resetScheduleForm();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteScheduleItem = async (id: string) => {
        if (!confirm('Delete this schedule item?')) return;
        const { error } = await supabase.from('schedule_items' as any).delete().eq('id', id);
        if (error) toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
        else toast({ title: "Success", description: "Item deleted" });
    };

    const openEditBudget = (item: BudgetItem) => {
        setEditingBudget(item);
        setBudgetCategory(item.category);
        setBudgetItemName(item.item_name);
        setEstimatedCost(item.estimated_cost?.toString() || '');
        setBudgetDialogOpen(true);
    };

    const openEditSchedule = (item: ScheduleItem) => {
        setEditingSchedule(item);
        setScheduleTitle(item.title);
        setScheduleDescription(item.description || '');
        setStartDate(item.start_date);
        setEndDate(item.end_date || '');
        setScheduleStatus(item.status || 'scheduled');
        setScheduleDialogOpen(true);
    };

    const totalEstimated = budgetData.reduce((sum, item) => sum + (item.estimated_cost || 0), 0);

    const formatDateRange = (start: string, end: string | null) => {
        const startDate = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endDate = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Ongoing';
        return `${startDate} \u2014 ${endDate}`;
    };

    if (budgetError || scheduleError) {
        return <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">Error loading data.</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar bg-transparent">
            <div className="flex flex-col gap-1 mb-12">
                <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Financials</h1>
                <p className="text-3xl font-extrabold text-foreground">Production Budget</p>
            </div>

            <div className="space-y-12 pb-24">
                <div className="bg-card border border-border shadow-sm p-8 rounded-[32px] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Budget Tracking</h2>
                        </div>
                        {!isInternal && (
                            <Dialog open={budgetDialogOpen} onOpenChange={(open) => { setBudgetDialogOpen(open); if (!open) resetBudgetForm(); }}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all">
                                        <Plus className="h-4 w-4 mr-2" /> Add Item
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md w-[95vw] bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
                                    <DialogHeader className="p-6 border-b border-border">
                                        <DialogTitle className="text-xl font-bold text-foreground">{editingBudget ? 'Update' : 'New'} Allocation</DialogTitle>
                                        <DialogDescription className="text-muted-foreground mt-1">Define financial constraints for this production asset.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-6 space-y-5">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Asset Category</Label>
                                            <Input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} placeholder="e.g., Equipment, Talent" className="bg-background border-border rounded-xl h-12 focus:border-primary/50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Asset Name</Label>
                                            <Input value={budgetItemName} onChange={(e) => setBudgetItemName(e.target.value)} placeholder="e.g., 4K Camera Rig" className="bg-background border-border rounded-xl h-12 focus:border-primary/50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Amount ($)</Label>
                                            <Input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="bg-background border-border rounded-xl h-12 focus:border-primary/50" />
                                        </div>
                                        <Button onClick={editingBudget ? handleUpdateBudgetItem : handleAddBudgetItem} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" disabled={saving}>
                                            {saving ? <Loader2 className="animate-spin" /> : (editingBudget ? 'Update Asset' : 'Add Allocation')}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>

                    {budgetData.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp /></div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Total Estimated</p>
                                    <p className="text-3xl font-extrabold text-foreground">${totalEstimated.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {budgetData.map(item => (
                                    <div key={item.id} className="group relative flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-accent/10 rounded-2xl hover:bg-accent/50 transition-all border border-border gap-4">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-foreground text-lg">{item.item_name}</p>
                                                <span className="text-[9px] font-bold px-2 py-1 bg-card border border-border shadow-sm rounded-full text-muted-foreground uppercase tracking-widest">{item.category}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between w-full sm:w-auto gap-8">
                                            <p className="text-sm font-bold text-foreground">${item.estimated_cost?.toLocaleString()}</p>
                                            {!isInternal && (
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => openEditBudget(item)} className="text-muted-foreground hover:text-primary transition-colors p-2 h-10 w-10 rounded-full">
                                                        <Pencil className="h-5 w-5" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteBudgetItem(item.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-2 h-10 w-10 rounded-full">
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

                <div className="bg-card border border-border shadow-sm p-8 rounded-[32px] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Production Roadmap</h2>
                        </div>
                        {!isInternal && (
                            <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) resetScheduleForm(); }}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all">
                                        <Plus className="h-4 w-4 mr-2" /> Schedule Phase
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md w-[95vw] bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
                                    <DialogHeader className="p-6 border-b border-border">
                                        <DialogTitle className="text-xl font-bold text-foreground">{editingSchedule ? 'Edit' : 'Create'} Milestone</DialogTitle>
                                        <DialogDescription className="text-muted-foreground mt-1">Map out a critical phase of your film production.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-6 space-y-5">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Phase Title</Label>
                                            <Input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g., Principle Photography" className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Phase Description</Label>
                                            <Textarea value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} placeholder="Overview of goals..." className="bg-background border-border rounded-xl min-h-[80px] resize-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Start</Label>
                                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Target End</Label>
                                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Current Status</Label>
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
                                        <Button onClick={editingSchedule ? handleUpdateScheduleItem : handleAddScheduleItem} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" disabled={saving}>
                                            {saving ? <Loader2 className="animate-spin" /> : (editingSchedule ? 'Update Milestone' : 'Lock Phase')}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>

                    {scheduleData.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scheduleData.map(item => (
                                <div key={item.id} className="p-6 bg-white/5 rounded-3xl hover:bg-accent/50 border border-border transition-all group">
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatDateRange(item.start_date, item.end_date)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter ${item.status === 'completed' ? 'bg-primary/10 text-primary border border-primary/20' :
                                                item.status === 'in-progress' ? 'bg-primary/10 text-primary border border-primary/20' :
                                                    item.status === 'delayed' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                        'bg-card border border-border shadow-sm'
                                                }`}>
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
                                                <Button size="sm" variant="ghost" onClick={() => openEditSchedule(item)} className="text-muted-foreground hover:text-white p-2 h-9 w-9 rounded-full">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteScheduleItem(item.id)} className="text-muted-foreground hover:text-red-400 p-2 h-9 w-9 rounded-full">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
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

