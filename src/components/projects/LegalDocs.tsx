import { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Download, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LegalDoc {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    document_type: string | null;
    uploaded_by: string | null;
    created_at: string;
}

interface LegalDocsProps {
    project_id: string;
}

const LegalDocs = ({ project_id }: LegalDocsProps) => {
    const { data: docs, error } = useRealtimeData<LegalDoc>('legal_docs', 'project_id', project_id);
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [documentType, setDocumentType] = useState('contract');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setDocumentType('contract');
        setSelectedFile(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!title || !selectedFile) {
            toast({ title: "Error", description: "Title and file are required", variant: "destructive" });
            return;
        }

        setUploading(true);

        try {
            // Upload file to storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${project_id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('legal-documents')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('legal-documents')
                .getPublicUrl(fileName);

            // Insert document record
            const { error: insertError } = await supabase
                .from('legal_docs' as any)
                .insert([{
                    project_id,
                    title,
                    description: description || null,
                    url: publicUrl,
                    document_type: documentType,
                    uploaded_by: (await supabase.auth.getUser()).data.user?.id
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Document uploaded successfully" });
            setDialogOpen(false);
            resetForm();
        } catch (err: any) {
            console.error('Upload error:', err);
            toast({ title: "Error", description: err.message || "Failed to upload document", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc: LegalDoc) => {
        if (!confirm(`Delete "${doc.title}"?`)) return;

        try {
            // Delete from storage if URL exists
            if (doc.url) {
                const fileName = doc.url.split('/').pop();
                if (fileName) {
                    await supabase.storage
                        .from('legal-documents')
                        .remove([`${project_id}/${fileName}`]);
                }
            }

            // Delete record
            const { error } = await supabase
                .from('legal_docs' as any)
                .delete()
                .eq('id', doc.id);

            if (error) throw error;

            toast({ title: "Success", description: "Document deleted" });
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    if (error) {
        return <div className="p-8 text-destructive">Error loading legal documents: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Legal Documents</h1>
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" />Upload Document</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload Legal Document</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Title *</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Location Release Form" />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details..." />
                            </div>
                            <div>
                                <Label>Document Type</Label>
                                <Select value={documentType} onValueChange={setDocumentType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="release">Release Form</SelectItem>
                                        <SelectItem value="nda">NDA</SelectItem>
                                        <SelectItem value="permit">Permit</SelectItem>
                                        <SelectItem value="insurance">Insurance</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>File *</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="file" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt" />
                                    {selectedFile && <span className="text-sm text-muted-foreground">{selectedFile.name}</span>}
                                </div>
                            </div>
                            <Button onClick={handleUpload} disabled={uploading} className="w-full">
                                {uploading ? (
                                    <>Uploading...</>
                                ) : (
                                    <><Upload className="h-4 w-4 mr-2" />Upload Document</>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {docs && docs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map(doc => (
                        <div key={doc.id} className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                            <div className="flex items-start gap-3">
                                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate">{doc.title}</h3>
                                    {doc.description && (
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        {doc.document_type && (
                                            <span className="text-xs px-2 py-1 bg-primary/20 rounded capitalize">{doc.document_type}</span>
                                        )}
                                        <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                {doc.url && (
                                    <Button size="sm" variant="outline" asChild className="flex-1">
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                            <Download className="h-4 w-4 mr-2" />Download
                                        </a>
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No legal documents have been uploaded for this project yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Click "Upload Document" to get started.</p>
                </div>
            )}
        </div>
    );
};

export default LegalDocs;
