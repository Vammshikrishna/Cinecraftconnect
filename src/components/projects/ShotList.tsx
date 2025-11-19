import React, { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Shot {
    id: number;
    scene: number;
    shot: number;
    description: string;
}

interface ShotListProps {
    project_id: string;
}

const ShotList = ({ project_id }: ShotListProps) => {
    const { data: shots, error } = useRealtimeData<Shot>('shot_list', 'project_id', project_id);
    const [newScene, setNewScene] = useState(1);
    const [newShot, setNewShot] = useState(1);
    const [newDescription, setNewDescription] = useState('');

    const handleAddShot = async () => {
        if (newDescription.trim() === '') return;
        await supabase
            .from('shot_list')
            .insert([{ scene: newScene, shot: newShot, description: newDescription, project_id: project_id }]);
        setNewDescription('');
        setNewShot(prev => prev + 1);
    };

    if (error) {
        return <div className="p-8 text-destructive">Error loading shot list: {error.message}</div>;
    }

    return (
        <div className="p-8 flex flex-col h-full">
            <h1 className="text-2xl font-bold mb-6">Shot List</h1>
            <div className="flex gap-4 mb-6 items-center">
                <Input
                    type="number"
                    value={newScene}
                    onChange={(e) => setNewScene(parseInt(e.target.value) || 1)}
                    placeholder="Scene"
                    className="w-24"
                />
                <Input
                    type="number"
                    value={newShot}
                    onChange={(e) => setNewShot(parseInt(e.target.value) || 1)}
                    placeholder="Shot"
                    className="w-24"
                />
                <Input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description of the shot..."
                    className="flex-grow"
                />
                <Button onClick={handleAddShot}>Add Shot</Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full border-collapse table-fixed">
                    <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b border-border">
                            <th className="p-3 text-left w-24 font-semibold">Scene</th>
                            <th className="p-3 text-left w-24 font-semibold">Shot</th>
                            <th className="p-3 text-left font-semibold">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shots && shots.length > 0 ? (
                            shots.map(shot => (
                                <tr key={shot.id} className="border-b border-border/50 hover:bg-muted/50">
                                    <td className="p-3">{shot.scene}</td>
                                    <td className="p-3">{shot.shot}</td>
                                    <td className="p-3 break-words">{shot.description}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                                    No shots have been added yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShotList;
