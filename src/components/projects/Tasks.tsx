import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
    id: string;
    title: string;
    status: string;
}

interface TasksProps {
    project_id: string;
}

const Tasks = ({ project_id }: TasksProps) => {
    const { data: rawTasks, error: realtimeError } = useRealtimeData<Task>('tasks', 'project_space_id', project_id);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(false);

    const [error, setError] = useState<Error | null>(null);
    const { toast } = useToast();

    // Decrypt tasks when raw data or key changes
    useEffect(() => {
        setTasks(rawTasks || []);
    }, [rawTasks]);

    const handleAddTask = async () => {
        if (newTask.trim() === '') return;
        setLoading(true);
        setError(null);
        try {
            const contentToSave = newTask.trim();

            const { error: insertError } = await supabase
                .from('tasks')
                // @ts-ignore
                .insert([{ title: contentToSave, status: 'pending', project_space_id: project_id }])
                .select();

            if (insertError) throw insertError;
            setNewTask('');
        } catch (err: any) {
            setError(err);
            toast({ title: "Error", description: "Failed to add task: " + err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

        // Optimistic UI update
        const originalTasks = [...tasks];
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

        const { error } = await supabase
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            // Revert
            setTasks(originalTasks);
            toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
        }
    };

    if (realtimeError) {
        return <div className="text-destructive">Error loading tasks: {realtimeError.message}</div>;
    }

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
                <div className="text-xs text-muted-foreground">Standard Security</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
                <Input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add a new task..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <Button
                    onClick={handleAddTask}
                    disabled={loading || !newTask.trim()}
                    className="w-full sm:w-auto"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    {loading ? 'Adding...' : 'Add Task'}
                </Button>
            </div>

            {error && <div className="text-destructive mb-4">{error.message}</div>}

            <div className="space-y-3">
                {tasks && tasks.length > 0 ? (
                    tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:bg-accent/50 transition-colors">
                            <Checkbox
                                id={`task-${task.id}`}
                                checked={task.status === 'completed'}
                                onCheckedChange={() => handleToggleTask(task.id, task.status)}
                            />
                            <label
                                htmlFor={`task-${task.id}`}
                                className={`flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}
                            >
                                {task.title}
                            </label>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        No tasks yet. Add one above!
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tasks;
