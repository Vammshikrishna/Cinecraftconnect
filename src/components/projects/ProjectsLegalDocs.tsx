
import React, { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS, PROJECT_FILE_FOLDERS, buildProjectFilePath } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LegalDoc {
    id: string;
    title: string;
    type: string;
    status: 'Signed' | 'Pending';
    url: string;
}

interface ProjectsLegalDocsProps {
    roomId: string;
}

const ProjectsLegalDocs = ({ roomId }: ProjectsLegalDocsProps) => {
    const { data: documents, error } = useRealtimeData<LegalDoc>('legal_docs', 'project_id', roomId);
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

        const filePath = buildProjectFilePath(
            PROJECT_FILE_FOLDERS.LEGAL,
            roomId,
            selectedFile.name
        );

        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.PROJECT_FILES)
            .upload(filePath, selectedFile);

        if (uploadError) {
            setUploading(false);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKETS.PROJECT_FILES)
            .getPublicUrl(filePath);

        await (supabase.from('legal_docs' as any).insert([
            {
                title: selectedFile.name,
                type: 'Document',
                status: 'Pending',
                url: publicUrlData.publicUrl,
                project_id: roomId,
            },
        ] as any) as any);

        setUploading(false);
        setSelectedFile(null);
    };

    const handleStatusChange = async (id: string, currentStatus: 'Signed' | 'Pending') => {
        const newStatus = currentStatus === 'Signed' ? 'Pending' : 'Signed';
        await (supabase
            .from('legal_docs' as any)
            .update({ status: newStatus } as any)
            .eq('id', id) as any);
    };

    if (error) {
        return <div>Error loading legal documents: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Legal Docs</h1>
            <div className="flex gap-2 mb-4">
                <Input type="file" onChange={handleFileChange} />
                <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                    {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </div>
            <ul>
                {(documents || []).map(doc => (
                    <li key={doc.id} className="flex justify-between items-center p-2 border-b">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            {doc.title}
                        </a>
                        <button 
                            onClick={() => handleStatusChange(doc.id, doc.status)} 
                            className={`px-2 py-1 rounded text-white ${doc.status === 'Signed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                            {doc.status}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ProjectsLegalDocs;

