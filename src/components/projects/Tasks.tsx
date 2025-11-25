import { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    is_completed: boolean | null;
}

interface TasksProps {
    project_id: string;
}

const Tasks = ({ project_id }: TasksProps) => {
    const { data: tasks, error: realtimeError, setData } = useRealtimeData<Task>('tasks', 'project_space_id', project_id);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const handleAddTask = async () => {
        if (newTask.trim() === '') return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: insertError } = await supabase
                .from('tasks')
                .insert([{ name: newTask, is_completed: false, project_space_id: project_id }])
                .select();

            if (insertError) throw insertError;

            if (data) {
                setData(prevTasks => [...(prevTasks || []), ...data]);
            }
            setNewTask('');
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async (id: string, is_completed: boolean | null) => {
        // Optimistic update
        setData(prevTasks =>
            prevTasks?.map(t =>
                t.id === id ? { ...t, is_completed: !is_completed } : t
            ) || []
        );

        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: !is_completed })
            .eq('id', id);

        if (error) {
            // Revert on error
            setData(prevTasks =>
                prevTasks?.map(t =>
                    t.id === id ? { ...t, is_completed: is_completed } : t
                ) || []
            );
        }
    };

    if (realtimeError) {
        return <div className="text-destructive">Error loading tasks: {realtimeError.message}</div>;
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Tasks</h1>

            <div className="flex gap-3 mb-8">
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
                                checked={task.is_completed || false}
                                onCheckedChange={() => handleToggleTask(task.id, task.is_completed)}
                            />
                            <label
                                htmlFor={`task-${task.id}`}
                                className={`flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}
                            >
                                {task.name}
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
