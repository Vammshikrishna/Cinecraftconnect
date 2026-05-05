import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RefreshCw, Layers, Search, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';

interface Task {
    id: string;
    name: string;
    description?: string | null;
    due_date?: string | null;
    is_completed: boolean;
}

interface TasksProps {
    project_id: string;
}

const Tasks = ({ project_id }: TasksProps) => {
    const { isInternal } = useAppRole();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [newTask, setNewTask] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchTasks = async () => {
        setFetching(true);
        setError(null);
        try {
            let { data, error: fetchError } = await supabase
                .from('tasks' as any)
                .select('*')
                .eq('project_space_id', project_id);

            if (fetchError) {
                throw fetchError;
            }

            const mapped = (data || []).map((item: any) => ({
                id: item.id,
                name: item.title || item.name || "Untitled Task",
                description: item.description ?? null,
                due_date: item.due_date ?? null,
                is_completed: item.status === 'completed' || item.status === 'done' || item.is_completed === true,
            }));
            setTasks(mapped);
        } catch (err: any) {
            setError(err.message || "Connection error");
        } finally {
            setFetching(false);
        }
    };

    const handleToggleTask = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('tasks' as any)
                .update({ status: !currentStatus ? 'completed' : 'pending' })
                .eq('id', id);
            if (error) throw error;
            fetchTasks();
        } catch (err: any) {
            toast({ title: "Error", description: "Could not update task", variant: "destructive" });
        }
    };

    useEffect(() => {
        fetchTasks();

        const channel = supabase
            .channel(`tasks:${project_id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `project_space_id=eq.${project_id}`
            }, () => {
                fetchTasks();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project_id]);

    const handleAddTask = async () => {
        const title = newTask.trim();
        if (!title) return;

        setLoading(true);
        try {
            const taskData: any = {
                title: title,
                description: null,
                due_date: null,
                status: 'pending',
                project_space_id: project_id
            };

            const { error: insertError } = await supabase
                .from('tasks' as any)
                .insert([taskData]);

            if (insertError) throw insertError;

            setNewTask('');
            toast({ title: "Task added", description: "Your production task was saved." });
            fetchTasks();
        } catch (err: any) {
            toast({
                title: "Schema Mismatch",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredTasks = tasks.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Workspace</h1>
                    <p className="text-3xl font-extrabold text-foreground">Production Tasks</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-grow min-w-[200px] sm:min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find a task or asset..."
                            className="pl-11 pr-4 h-12 bg-card border-border rounded-xl placeholder:text-muted-foreground focus:border-primary/50 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-between gap-3 text-destructive">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
                        <div>
                            <p className="text-sm font-bold">Connection Issue</p>
                            <p className="text-xs opacity-70">{error}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => fetchTasks()} className="h-8 hover:bg-destructive/20 text-destructive font-bold">
                        <RefreshCw className="h-4 w-4 mr-2" /> Retry
                    </Button>
                </div>
            )}

            {!isInternal ? (
                <div className="bg-card border border-border p-4 sm:p-6 rounded-2xl mb-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">New Production Step</label>
                            <Input
                                value={newTask}
                                onChange={(e) => setNewTask(e.target.value)}
                                placeholder="Enter task name..."
                                className="h-14 bg-background border-border rounded-2xl placeholder:text-muted-foreground px-6 focus:border-primary/50 text-lg transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                            />
                        </div>
                        <Button
                            onClick={handleAddTask}
                            disabled={loading || !newTask.trim()}
                            className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20 transition-all w-full sm:w-auto"
                        >
                            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : "Deploy Task"}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 bg-muted/30 border border-border/50 rounded-2xl text-center">
                    <p className="text-sm text-muted-foreground italic font-medium">Internal staff are in observation mode and cannot modify production tasks.</p>
                </div>
            )}

            <div className="space-y-3 pb-24">
                {fetching && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <Loader2 className="h-10 w-10 animate-spin mb-4" />
                        <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Fetching backlog...</p>
                    </div>
                ) : filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                        <div key={task.id} className="group flex items-center gap-4 p-5 bg-card border border-border rounded-2xl hover:bg-accent/50 hover:border-primary/20 transition-all duration-300 shadow-sm">
                            <Checkbox
                                id={`task-${task.id}`}
                                checked={task.is_completed}
                                onCheckedChange={() => !isInternal && handleToggleTask(task.id, task.is_completed)}
                                disabled={isInternal}
                                className="h-6 w-6 border-2 border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <label
                                htmlFor={`task-${task.id}`}
                                className={`flex-1 cursor-pointer text-lg font-bold leading-tight transition-all ${task.is_completed ? 'line-through opacity-30 italic' : 'text-foreground'}`}
                            >
                                {task.name}
                            </label>
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                <p className="text-[9px] font-black uppercase text-primary tracking-tighter bg-primary/10 px-2 py-1 rounded-lg">Production Log</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
                        <Layers className="h-16 w-16 mb-4 text-muted-foreground" />
                        <p className="text-lg font-bold text-foreground uppercase tracking-widest">No Active Tasks</p>
                        <p className="text-sm text-muted-foreground">Keep the production moving by adding items above.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tasks;
