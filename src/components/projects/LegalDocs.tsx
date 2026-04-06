import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Download, Trash2, Shield, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LegalDoc {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    document_type: string | null;
    date: string | null;
    uploaded_by: string | null;
    created_at: string;
    signedUrl?: string; // Secure access link
}

interface LegalDocsProps {
    project_id: string;
}

const LegalDocs = ({ project_id }: LegalDocsProps) => {
    const { data: rawDocs, error } = useRealtimeData<LegalDoc>('legal_docs', 'project_id', project_id);
    const [docs, setDocs] = useState<LegalDoc[]>([]);
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [documentType, setDocumentType] = useState('contract');
    const [date, setDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setDocumentType('contract');
        setDate('');
        setSelectedFile(null);
    };

    // Generate Secure Links
    useEffect(() => {
        const generateSignedUrls = async () => {
            if (!rawDocs || rawDocs.length === 0) {
                setDocs([]);
                return;
            }

            const docsWithSignedUrls = await Promise.all(rawDocs.map(async (doc) => {
                if (!doc.url) return doc;
                try {
                    // Extract path: legal-docs/[id]/[name]
                    const parts = doc.url.split('project-files/');
                    const path = parts.length > 1 ? parts[1] : `legal-docs/${project_id}/${doc.id}`;
                    
                    const { data } = await supabase.storage
                        .from('project-files')
                        .createSignedUrl(decodeURIComponent(path), 3600);

                    return { ...doc, signedUrl: data?.signedUrl || doc.url };
                } catch (e) {
                    return doc;
                }
            }));

            setDocs(docsWithSignedUrls);
        };

        generateSignedUrls();
    }, [rawDocs, project_id]);

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
            const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;
            const filePath = `legal-docs/${project_id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('project-files')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('project-files')
                .getPublicUrl(filePath);

            const { error: insertError } = await supabase
                .from('legal_docs' as any)
                .insert([{
                    project_id,
                    title,
                    description: description || null,
                    url: publicUrl,
                    document_type: documentType,
                    date: date || null,
                    uploaded_by: (await supabase.auth.getUser()).data.user?.id
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Document archived successfully" });
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
        if (!confirm(`Permanently delete "${doc.title}"?`)) return;

        try {
            if (doc.url) {
                const parts = doc.url.split('project-files/');
                const path = parts.length > 1 ? parts[1] : null;
                if (path) {
                    await supabase.storage.from('project-files').remove([decodeURIComponent(path)]);
                }
            }

            const { error } = await supabase.from('legal_docs' as any).delete().eq('id', doc.id);
            if (error) throw error;

            toast({ title: "Removed", description: "Document deleted from registry" });
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (error) {
        return <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">Registry error.</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar bg-transparent">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Legal</h1>
                    <p className="text-2xl font-bold text-foreground text-gradient">Archived Documents</p>
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-sm rounded-full px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all">
                            <Plus className="h-5 w-5 mr-2" /> 
                            New Document
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[95vw] bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
                        <DialogHeader className="p-6 border-b border-border">
                            <DialogTitle className="text-xl font-bold text-foreground">Upload Legal Asset</DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-1">Archive contracts, NDAs, and permits for this production.</DialogDescription>
                        </DialogHeader>
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Document Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Cast Contract - Lead" className="bg-background border-border rounded-xl h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Type</Label>
                                <Select value={documentType} onValueChange={setDocumentType}>
                                    <SelectTrigger className="bg-background border-border rounded-xl h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-black/90 border-border backdrop-blur-3xl rounded-2xl">
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="release">Release Form</SelectItem>
                                        <SelectItem value="nda">NDA</SelectItem>
                                        <SelectItem value="permit">Permit</SelectItem>
                                        <SelectItem value="insurance">Insurance</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Date</Label>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">File Asset</Label>
                                <div className="relative group">
                                    <Input type="file" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt" className="bg-background border-border rounded-xl h-12 py-3 file:bg-transparent file:text-primary file:font-bold file:border-0" />
                                </div>
                                {selectedFile && <p className="text-[10px] text-primary/80 font-bold ml-1">{selectedFile.name}</p>}
                            </div>
                            <Button onClick={handleUpload} disabled={uploading} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20">
                                {uploading ? <Loader2 className="animate-spin" /> : 'Confirm Upload'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {docs && docs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                    {docs.map(doc => (
                        <div key={doc.id} className="group bg-card border border-border shadow-sm rounded-[32px] p-6 shadow-sm hover:shadow-2xl hover:bg-accent/50 transition-all duration-300 relative overflow-hidden">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    {doc.document_type === 'contract' ? <Shield className="w-6 h-6 text-primary" /> : <FileText className="w-6 h-6 text-primary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Calendar className="h-4 w-4" />
                                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{doc.date ? formatDate(doc.date) : 'No Date'}</span>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">{doc.title}</h3>
                                </div>
                            </div>

                            {doc.description && (
                                <p className="text-sm text-muted-foreground mb-8 line-clamp-2 leading-relaxed">
                                    {doc.description}
                                </p>
                            )}

                            <div className="flex gap-2 mt-auto">
                                {doc.signedUrl || doc.url ? (
                                    <Button size="sm" variant="outline" asChild className="flex-1 h-12 bg-accent/30 hover:bg-accent/50 border-border rounded-xl text-foreground font-bold transition-all">
                                        <a href={doc.signedUrl || doc.url || '#'} target="_blank" rel="noopener noreferrer">
                                            <Download className="h-4 w-4 mr-2 text-primary" /> Access
                                        </a>
                                    </Button>
                                ) : null}
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} className="text-muted-foreground/40 hover:text-red-400 h-12 w-12 rounded-xl transition-colors">
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
                    <Shield className="w-16 h-16 mb-4" />
                    <p className="text-lg font-bold">Document vault is empty.</p>
                    <p className="text-sm">Start safeguarding your project with legal contracts.</p>
                </div>
            )}
        </div>
    );
};

export default LegalDocs;
