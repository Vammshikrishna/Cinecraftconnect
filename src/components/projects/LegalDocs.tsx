import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Download, Trash2, Shield, Loader2, Calendar, Eye, FileCheck, Film } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LegalDoc {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    url: string | null;
    document_type: string | null;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
    signedUrl?: string; // Secure access link
}

interface LegalDocsProps {
    project_id: string;
}

const LegalDocs = ({ project_id }: LegalDocsProps) => {
    const { data: rawDocs, error } = useRealtimeData<LegalDoc>('legal_docs', 'project_id', project_id);
    const [docs, setDocs] = useState<LegalDoc[]>([]);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const previewDoc = docs.find(d => d.id === previewId) || null;
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
                    // Optimized path extraction
                    const bucketMatch = doc.url.match(/legal-documents\/(.*)$/);
                    let path = bucketMatch ? bucketMatch[1] : "";
                    
                    if (!path && doc.url.includes('object/')) {
                         const parts = doc.url.split('object/')[1].split('/');
                         if (parts.length > 2) path = parts.slice(2).join('/');
                    }

                    if (!path) path = doc.url.split('/').pop() || "";
                    
                    // Clean and decode path
                    path = decodeURIComponent(path.split('?')[0]).replace(/^\/+/, '');
                    
                    if (!path) return { ...doc, signedUrl: doc.url || undefined };

                    // 1. Attempt Signed URL (best for security)
                    const { data: signedData, error: signError } = await supabase.storage
                        .from('legal-documents')
                        .createSignedUrl(path, 3600);

                    if (!signError && signedData?.signedUrl) {
                        return { ...doc, signedUrl: signedData.signedUrl };
                    }

                    // 2. Fallback to Public URL (best for reliability)
                    const { data: { publicUrl } } = supabase.storage
                        .from('legal-documents')
                        .getPublicUrl(path);

                    return { ...doc, signedUrl: publicUrl || doc.url || undefined };
                } catch (e) {
                    return { ...doc, signedUrl: doc.url || undefined };
                }
            }));

            setDocs(docsWithSignedUrls as any);
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
            const filePath = `${project_id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('legal-documents')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('legal-documents')
                .getPublicUrl(filePath);

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

            toast({ title: "Success", description: "Document archived successfully" });
            setDialogOpen(false);
            resetForm();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to upload document", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (doc: LegalDoc) => {
        if (!doc.url) return;
        try {
            let path = "";
            if (doc.url.includes('legal-documents/')) {
                path = doc.url.split('legal-documents/').pop()?.split('?')[0] || "";
            } else if (doc.url.startsWith('http')) {
                try {
                    const urlObj = new URL(doc.url);
                    const pathParts = urlObj.pathname.split('/');
                    const objectIdx = pathParts.indexOf('object');
                    if (objectIdx !== -1 && pathParts.length > objectIdx + 3) {
                        path = pathParts.slice(objectIdx + 3).join('/');
                    } else {
                        const bucketIdx = pathParts.indexOf('legal-documents');
                        if (bucketIdx !== -1) {
                            path = pathParts.slice(bucketIdx + 1).join('/');
                        } else {
                            const legacyIdx = pathParts.indexOf('project-files');
                            if (legacyIdx !== -1) path = pathParts.slice(legacyIdx + 1).join('/');
                        }
                    }
                } catch (e) {
                    path = doc.url.split('/').pop() || "";
                }
            } else {
                path = doc.url;
            }
            path = decodeURIComponent(path.split('?')[0]).replace(/^\/+/, ''); // Clean leading slashes
            if (!path) throw new Error("Invalid file path structure");
            
            // 2. Generate a fresh signed URL
            const { data: signedData, error: signedError } = await supabase.storage
                .from('legal-documents')
                .createSignedUrl(path, 60);

            if (signedError) throw signedError;
            if (!signedData?.signedUrl) throw new Error("Could not generate secure download link");

            // 3. Fetch as blob
            const response = await fetch(signedData.signedUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            
            const originalFilename = doc.url.split('/').pop()?.split('?')[0] || "";
            const ext = originalFilename.includes('.') ? originalFilename.split('.').pop() : "pdf";
            link.download = `${doc.title.replace(/\s+/g, '_')}.${ext}`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast({ title: "Downloaded", description: doc.title + " is ready." });
        } catch (err: any) {
            toast({ title: "Download Failed", description: err.message, variant: "destructive" });
        }
    };

    const handleDelete = async (doc: LegalDoc) => {
        if (!confirm(`Permanently delete "${doc.title}"?`)) return;

        try {
            if (doc.url) {
                const parts = doc.url.split('legal-documents/');
                const path = (parts.length > 1 ? parts[1] : null)?.replace(/^\/+/, ''); // Clean leading slashes
                if (path) {
                    await supabase.storage.from('legal-documents').remove([decodeURIComponent(path.split('?')[0])]);
                }
            }

            const { error } = await supabase.from('legal_docs' as any).delete().eq('id', doc.id);
            if (error) throw error;

            // Optimistic UI update: instantly remove the doc from view
            setDocs(prev => prev.filter(item => item.id !== doc.id));

            toast({ title: "Removed", description: "Document deleted from registry" });
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        }
    };

    const getFileIcon = (type: string | null) => {
        if (type === 'contract') return <Shield className="w-5 h-5 text-primary" />;
        if (type === 'nda') return <FileCheck className="w-5 h-5 text-blue-400" />;
        if (type === 'media') return <Film className="w-5 h-5 text-purple-400" />;
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    };

    const isImage = (url: string | null) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].toLowerCase();
        return cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.png') || 
               cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp') || cleanUrl.includes('.jpg?') || 
               cleanUrl.includes('.png?') || cleanUrl.includes('.jpeg?');
    };

    const isPdf = (url: string | null) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].toLowerCase();
        return cleanUrl.endsWith('.pdf') || cleanUrl.includes('.pdf?');
    };

    const isVideo = (url: string | null) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].toLowerCase();
        return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.ogg') || 
               cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.m4v') || cleanUrl.includes('.mp4?') || 
               cleanUrl.includes('.mov?');
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
                        <Button className="bg-primary hover:bg-primary/80 text-primary-foreground rounded-full px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all">
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
                                    <SelectContent className="bg-popover border border-border rounded-xl shadow-2xl backdrop-blur-3xl">
                                        <SelectItem value="contract" className="cursor-pointer text-foreground py-2.5">Contract</SelectItem>
                                        <SelectItem value="release" className="cursor-pointer text-foreground py-2.5">Release Form</SelectItem>
                                        <SelectItem value="nda" className="cursor-pointer text-foreground py-2.5">NDA</SelectItem>
                                        <SelectItem value="permit" className="cursor-pointer text-foreground py-2.5">Permit</SelectItem>
                                        <SelectItem value="media" className="cursor-pointer text-foreground py-2.5">Media / Video</SelectItem>
                                        <SelectItem value="insurance" className="cursor-pointer text-foreground py-2.5">Insurance</SelectItem>
                                        <SelectItem value="other" className="cursor-pointer text-foreground py-2.5">Other Document</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">File Asset</Label>
                                <div className="relative group">
                                    <Input type="file" onChange={handleFileSelect} className="bg-background border-border rounded-xl h-12 py-3 file:bg-transparent file:text-primary file:font-bold file:border-0" />
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
                        <div key={doc.id} className="group bg-card border border-border rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl hover:bg-accent/50 transition-all duration-300 relative">
                            {/* Card Content */}
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors">
                                        {getFileIcon(doc.document_type)}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={() => setPreviewId(doc.id)}
                                            className="h-9 w-9 rounded-full bg-background/50 hover:bg-background border border-border"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={() => handleDelete(doc)}
                                            className="h-9 w-9 rounded-full hover:text-red-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-1 mb-4">
                                    <div className="flex items-center gap-2 text-primary/60">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{formatDate(doc.created_at)}</span>
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">{doc.title}</h3>
                                    {doc.document_type && (
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{doc.document_type}</p>
                                    )}
                                </div>

                                {doc.description && (
                                    <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                                        {doc.description}
                                    </p>
                                )}

                                {doc.url && (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleDownload(doc)} 
                                        className="w-full h-12 bg-accent/30 hover:bg-primary hover:text-primary-foreground border-border rounded-xl font-bold transition-all"
                                    >
                                        <Download className="h-4 w-4 mr-2" /> Download Document
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
                    <Shield className="w-16 h-16 mb-4" />
                    <p className="text-lg font-bold uppercase tracking-widest">Registry Empty</p>
                    <p className="text-sm">Safeguard your project by archiving its legal papers here.</p>
                </div>
            )}

            {/* Quick Look Dialog */}
            <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
                <DialogContent className="max-w-5xl w-[95vw] h-[85vh] bg-card border border-border p-0 rounded-[32px] overflow-hidden flex flex-col shadow-3xl">
                    <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            {previewDoc && getFileIcon(previewDoc.document_type)}
                            <DialogTitle className="text-lg font-bold text-foreground truncate">
                                {previewDoc?.title}
                            </DialogTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            {previewDoc && previewDoc.url && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleDownload(previewDoc)}
                                    className="rounded-xl border-border hover:bg-accent/50"
                                >
                                    <Download className="w-4 h-4 mr-2" /> Download
                                </Button>
                            )}
                        </div>
                        <DialogDescription className="sr-only">Preview of {previewDoc?.title}</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-grow relative bg-black/5 flex items-center justify-center overflow-hidden">
                        {previewDoc && (previewDoc.signedUrl || previewDoc.url) && (
                            isImage(previewDoc.url) ? (
                                <img 
                                    src={previewDoc.signedUrl || previewDoc.url || ''} 
                                    alt={previewDoc.title} 
                                    className="max-w-full max-h-full object-contain p-4 shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-500"
                                />
                            ) : isPdf(previewDoc.url) ? (
                                <iframe 
                                    src={`${previewDoc.signedUrl || previewDoc.url}#toolbar=0`} 
                                    className="w-full h-full border-0 animate-in fade-in duration-500"
                                    title="PDF Preview"
                                />
                            ) : isVideo(previewDoc.url) ? (
                                <video 
                                    src={previewDoc.signedUrl || previewDoc.url || ''} 
                                    controls 
                                    className="max-w-full max-h-full p-4 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-500"
                                    autoPlay 
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center p-12">
                                    <FileText className="w-32 h-32 text-muted-foreground opacity-20" />
                                    <div>
                                        <p className="text-foreground text-xl font-bold mb-2">Detailed Preview Unavailable</p>
                                        <p className="text-muted-foreground max-w-xs text-sm">You can download this asset to view it on your local machine.</p>
                                    </div>
                                    <Button 
                                        onClick={() => handleDownload(previewDoc)} 
                                        className="bg-primary text-primary-foreground rounded-2xl px-10 h-14 font-bold text-lg hover:scale-105 transition-transform"
                                    >
                                        Download to System
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LegalDocs;
