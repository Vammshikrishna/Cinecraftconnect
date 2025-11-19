import React, { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';

interface Task {
    id: number;
    title: string;
    completed: boolean;
}

interface TasksProps {
    project_id: string;
}

const Tasks = ({ project_id }: TasksProps) => {
    const { data: tasks, error: realtimeError, setData } = useRealtimeData<Task>('tasks', 'project_id', project_id);
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
                .insert([{ title: newTask, completed: false, project_id: project_id }])
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

    const handleToggleTask = async (id: number, completed: boolean) => {
        await supabase
            .from('tasks')
            .update({ completed: !completed })
            .eq('id', id);
    };

    if (realtimeError) {
        return <div>Error loading tasks: {realtimeError.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Tasks</h1>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add a new task"
                    className="border p-2 rounded w-full"
                />
                <button
                    onClick={handleAddTask}
                    className="bg-blue-500 text-white p-2 rounded"
                    disabled={loading}
                >
                    {loading ? 'Adding...' : 'Add Task'}
                </button>
            </div>
            {error && <div className="text-red-500">{error.message}</div>}
            <ul>
                {tasks && tasks.map(task => (
                    <li key={task.id} className="flex items-center gap-2 mb-2">
                        <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task.id, task.completed)}
                        />
                        <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Tasks;
