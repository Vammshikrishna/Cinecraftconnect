import { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    status: string;
    assigned_to: string | null;
}

interface BudgetSchedProps {
    project_id: string;
}

const BudgetSched = ({ project_id }: BudgetSchedProps) => {
    const { data: budgetData, error: budgetError } = useRealtimeData<BudgetItem>('budget_items', 'project_id', project_id);
    const { data: scheduleData, error: scheduleError } = useRealtimeData<ScheduleItem>('schedule_items', 'project_id', project_id);
    const { toast } = useToast();

    const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);

    // Budget form state
    const [budgetCategory, setBudgetCategory] = useState('');
    const [budgetItemName, setBudgetItemName] = useState('');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [actualCost, setActualCost] = useState('');
    const [budgetNotes, setBudgetNotes] = useState('');

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
        setActualCost('');
        setBudgetNotes('');
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

    const handleAddBudgetItem = async () => {
        if (!budgetCategory || !budgetItemName) {
            toast({ title: "Error", description: "Category and item name are required", variant: "destructive" });
            return;
        }

        const { error } = await supabase
            .from('budget_items' as any)
            .insert([{
                project_id,
                category: budgetCategory,
                item_name: budgetItemName,
                estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
                actual_cost: actualCost ? parseFloat(actualCost) : null,
                notes: budgetNotes || null
            }]);

        if (error) {
            toast({ title: "Error", description: "Failed to add budget item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Budget item added" });
            setBudgetDialogOpen(false);
            resetBudgetForm();
        }
    };

    const handleUpdateBudgetItem = async () => {
        if (!editingBudget) return;

        const { error } = await supabase
            .from('budget_items' as any)
            .update({
                category: budgetCategory,
                item_name: budgetItemName,
                estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
                actual_cost: actualCost ? parseFloat(actualCost) : null,
                notes: budgetNotes || null
            })
            .eq('id', editingBudget.id);

        if (error) {
            toast({ title: "Error", description: "Failed to update budget item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Budget item updated" });
            setBudgetDialogOpen(false);
            resetBudgetForm();
        }
    };

    const handleDeleteBudgetItem = async (id: string) => {
        if (!confirm('Delete this budget item?')) return;

        const { error } = await supabase
            .from('budget_items' as any)
            .delete()
            .eq('id', id);

        if (error) {
            toast({ title: "Error", description: "Failed to delete budget item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Budget item deleted" });
        }
    };

    const handleAddScheduleItem = async () => {
        if (!scheduleTitle || !startDate) {
            toast({ title: "Error", description: "Title and start date are required", variant: "destructive" });
            return;
        }

        const { error } = await supabase
            .from('schedule_items' as any)
            .insert([{
                project_id,
                title: scheduleTitle,
                description: scheduleDescription || null,
                start_date: startDate,
                end_date: endDate || null,
                status: scheduleStatus
            }]);

        if (error) {
            toast({ title: "Error", description: "Failed to add schedule item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Schedule item added" });
            setScheduleDialogOpen(false);
            resetScheduleForm();
        }
    };

    const handleUpdateScheduleItem = async () => {
        if (!editingSchedule) return;

        const { error } = await supabase
            .from('schedule_items' as any)
            .update({
                title: scheduleTitle,
                description: scheduleDescription || null,
                start_date: startDate,
                end_date: endDate || null,
                status: scheduleStatus
            })
            .eq('id', editingSchedule.id);

        if (error) {
            toast({ title: "Error", description: "Failed to update schedule item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Schedule item updated" });
            setScheduleDialogOpen(false);
            resetScheduleForm();
        }
    };

    const handleDeleteScheduleItem = async (id: string) => {
        if (!confirm('Delete this schedule item?')) return;

        const { error } = await supabase
            .from('schedule_items' as any)
            .delete()
            .eq('id', id);

        if (error) {
            toast({ title: "Error", description: "Failed to delete schedule item", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Schedule item deleted" });
        }
    };

    const openEditBudget = (item: BudgetItem) => {
        setEditingBudget(item);
        setBudgetCategory(item.category);
        setBudgetItemName(item.item_name);
        setEstimatedCost(item.estimated_cost?.toString() || '');
        setActualCost(item.actual_cost?.toString() || '');
        setBudgetNotes(item.notes || '');
        setBudgetDialogOpen(true);
    };

    const openEditSchedule = (item: ScheduleItem) => {
        setEditingSchedule(item);
        setScheduleTitle(item.title);
        setScheduleDescription(item.description || '');
        setStartDate(item.start_date);
        setEndDate(item.end_date || '');
        setScheduleStatus(item.status);
        setScheduleDialogOpen(true);
    };

    const totalEstimated = budgetData?.reduce((sum, item) => sum + (item.estimated_cost || 0), 0) || 0;
    const totalActual = budgetData?.reduce((sum, item) => sum + (item.actual_cost || 0), 0) || 0;

    const formatDateRange = (start: string, end: string | null) => {
        const startDate = new Date(start).toLocaleDateString();
        const endDate = end ? new Date(end).toLocaleDateString() : 'Ongoing';
        return `${startDate} - ${endDate}`;
    };

    if (budgetError || scheduleError) {
        return <div className="p-8 text-destructive">Error loading data: {budgetError?.message || scheduleError?.message}</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto">
            <h1 className="text-xl sm:text-2xl font-bold mb-6">Budget & Schedule</h1>
            <div className="space-y-8">
                {/* Budget Section */}
                <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h2 className="text-xl font-semibold">Budget Overview</h2>
                        <Dialog open={budgetDialogOpen} onOpenChange={(open) => { setBudgetDialogOpen(open); if (!open) resetBudgetForm(); }}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Budget Item</Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] rounded-lg">
                                <DialogHeader>
                                    <DialogTitle>{editingBudget ? 'Edit' : 'Add'} Budget Item</DialogTitle>
                                    <DialogDescription>Enter the details for this budget item.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Category</Label>
                                        <Input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} placeholder="e.g., Equipment, Crew, Location" />
                                    </div>
                                    <div>
                                        <Label>Item Name</Label>
                                        <Input value={budgetItemName} onChange={(e) => setBudgetItemName(e.target.value)} placeholder="e.g., Camera Rental" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Estimated Cost ($)</Label>
                                            <Input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="0.00" />
                                        </div>
                                        <div>
                                            <Label>Actual Cost ($)</Label>
                                            <Input type="number" value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder="0.00" />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Textarea value={budgetNotes} onChange={(e) => setBudgetNotes(e.target.value)} placeholder="Additional notes..." />
                                    </div>
                                    <Button onClick={editingBudget ? handleUpdateBudgetItem : handleAddBudgetItem} className="w-full">
                                        {editingBudget ? 'Update' : 'Add'} Budget Item
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {budgetData && budgetData.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-slate-900/50 rounded">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Estimated</p>
                                    <p className="text-xl sm:text-2xl font-bold">${totalEstimated.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Spent</p>
                                    <p className="text-xl sm:text-2xl font-bold">${totalActual.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Remaining</p>
                                    <p className="text-xl sm:text-2xl font-bold">${(totalEstimated - totalActual).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {budgetData.map(item => (
                                    <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-900/50 rounded hover:bg-slate-900/70 gap-3">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-medium">{item.item_name}</p>
                                                <span className="text-xs px-2 py-1 bg-primary/20 rounded">{item.category}</span>
                                            </div>
                                            {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                                        </div>
                                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                            <div className="text-left sm:text-right">
                                                <p className="text-sm text-muted-foreground">Est: ${(item.estimated_cost || 0).toLocaleString()}</p>
                                                <p className="text-sm">Actual: ${(item.actual_cost || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="ghost" onClick={() => openEditBudget(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteBudgetItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No budget items yet. Click "Add Budget Item" to get started.</p>
                    )}
                </div>

                {/* Schedule Section */}
                <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h2 className="text-xl font-semibold">Schedule Overview</h2>
                        <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) resetScheduleForm(); }}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Schedule Item</Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] rounded-lg">
                                <DialogHeader>
                                    <DialogTitle>{editingSchedule ? 'Edit' : 'Add'} Schedule Item</DialogTitle>
                                    <DialogDescription>Enter the details for this schedule item.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Title</Label>
                                        <Input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g., Pre-Production" />
                                    </div>
                                    <div>
                                        <Label>Description</Label>
                                        <Textarea value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} placeholder="Details about this phase..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Start Date</Label>
                                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        </div>
                                        <div>
                                            <Label>End Date</Label>
                                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Status</Label>
                                        <Select value={scheduleStatus} onValueChange={setScheduleStatus}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                <SelectItem value="in-progress">In Progress</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="delayed">Delayed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={editingSchedule ? handleUpdateScheduleItem : handleAddScheduleItem} className="w-full">
                                        {editingSchedule ? 'Update' : 'Add'} Schedule Item
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {scheduleData && scheduleData.length > 0 ? (
                        <div className="space-y-3">
                            {scheduleData.map(item => (
                                <div key={item.id} className="p-4 bg-slate-900/50 rounded hover:bg-slate-900/70">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <p className="font-medium text-lg">{item.title}</p>
                                                <span className={`text-xs px-2 py-1 rounded ${item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                    item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                                                        item.status === 'delayed' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                    }`}>{item.status}</span>
                                            </div>
                                            {item.description && <p className="text-sm text-muted-foreground mb-2">{item.description}</p>}
                                            <p className="text-sm text-muted-foreground">{formatDateRange(item.start_date, item.end_date)}</p>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                                            <Button size="sm" variant="ghost" onClick={() => openEditSchedule(item)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteScheduleItem(item.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No schedule items yet. Click "Add Schedule Item" to get started.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BudgetSched;
