import React from 'react';
import { useRealtimeData } from '@/lib/realtime';

// CORRECTED: Props interface now expects project_id
interface LegalDocsProps {
    project_id: string;
}

// CORRECTED: Component now accepts project_id
const LegalDocs = ({ project_id }: LegalDocsProps) => {
    // CORRECTED: useRealtimeData is now called with project_id
    const { data: legalDocs, error } = useRealtimeData('legal_docs', project_id);

    if (error) {
        return <div className="p-8 text-destructive">Error loading legal documents: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Legal Documents</h1>
            {/* This is a placeholder. The actual implementation will depend on the data structure. */}
            {legalDocs && legalDocs.length > 0 ? (
                <div className="space-y-4">
                    {legalDocs.map((doc: any) => (
                        <div key={doc.id} className="p-4 border border-border/50 rounded-lg">
                            <h3 className="font-semibold">{doc.title || 'Document'}</h3>
                            <p className="text-sm text-muted-foreground">{doc.description || 'No description.'}</p>
                            {/* Assuming a 'url' field exists for a link */}
                            {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 inline-block">View Document</a>}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No legal documents have been uploaded for this project yet.</p>
                </div>
            )}
        </div>
    );
};

export default LegalDocs;
