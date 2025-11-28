import { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProjectFile {
    id: number;
    name: string;
    size: number;
    url: string;
}

// CORRECTED: Props interface now expects project_id
interface FilesProps {
    project_id: string;
}

// CORRECTED: Component now accepts project_id
const Files = ({ project_id }: FilesProps) => {
    // CORRECTED: useRealtimeData is now called with project_id
    const { data: files, error } = useRealtimeData<ProjectFile>('files', 'project_id', project_id);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);

        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        // CORRECTED: The file path now uses the project_id
        const filePath = `${project_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('project-files')
            .upload(filePath, selectedFile);

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            setUploading(false);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from('project-files')
            .getPublicUrl(filePath);

        // CORRECTED: The insert query now uses the correct project_id column
        await supabase.from('files' as any).insert([
            {
                name: selectedFile.name,
                size: selectedFile.size,
                url: publicUrlData.publicUrl,
                project_id: project_id,
            },
        ]);

        setUploading(false);
        setSelectedFile(null);
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    if (error) {
        return <div>Error loading files: {error.message}</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto">
            <h1 className="text-xl sm:text-2xl font-bold mb-4">Files</h1>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Input type="file" onChange={handleFileChange} className="w-full" />
                <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="w-full sm:w-auto">
                    {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </div>
            <ul className="space-y-2">
                {files && files.map(file => (
                    <li key={file.id} className="flex justify-between items-center p-3 border-b bg-card/50 rounded-lg">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate mr-4 max-w-[200px] sm:max-w-none">
                            {file.name}
                        </a>
                        <span className="text-gray-500 text-sm whitespace-nowrap">{formatBytes(file.size)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Files;
