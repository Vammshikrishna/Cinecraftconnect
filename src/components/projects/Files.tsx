import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Image as ImageIcon, File, Eye, Download, Loader2, Trash2, ShieldAlert, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';

interface ProjectFile {
    id: string;
    name: string;
    size: number;
    url: string;
    file_type: string | null;
    signedUrl?: string; // Temporary access link
}

interface FilesProps {
    project_id: string;
}

const Files = ({ project_id }: FilesProps) => {
    const { isInternal } = useAppRole();
    const { data: rawFiles, error } = useRealtimeData<ProjectFile>('files', 'project_id', project_id);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
    const { toast } = useToast();

    // Effect to generate signed URLs for all files
    useEffect(() => {
        const generateSignedUrls = async () => {
            if (!rawFiles || rawFiles.length === 0) {
                setFiles([]);
                return;
            }

            const filesWithSignedUrls = await Promise.all(rawFiles.map(async (file) => {
                try {
                    let path = "";
                    if (file.url.includes('project-files/')) {
                        path = file.url.split('project-files/').pop()?.split('?')[0] || "";
                    } else if (!file.url.startsWith('http')) {
                        path = file.url.split('?')[0];
                    } else {
                        const parts = file.url.split('/');
                        const bucketIdx = parts.indexOf('project-files');
                        if (bucketIdx !== -1) {
                            path = parts.slice(bucketIdx + 1).join('/').split('?')[0];
                        }
                    }
                    
                    if (!path) path = `${project_id}/${file.name}`;
                    
                    const { data } = await supabase.storage
                        .from('project-files')
                        .createSignedUrl(decodeURIComponent(path), 3600);

                    return {
                        ...file,
                        signedUrl: data?.signedUrl || file.url
                    };
                } catch (e) {
                    return file;
                }
            }));

            setFiles(filesWithSignedUrls);
        };

        generateSignedUrls();
    }, [rawFiles, project_id]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const getFileIcon = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className="w-5 h-5 text-purple-400" />;
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-5 h-5 text-blue-400" />;
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) return <Video className="w-5 h-5 text-red-400" />;
        return <File className="w-5 h-5 text-gray-400" />;
    };

    const isImage = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
    };

    const isVideo = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ['mp4', 'webm', 'ogg', 'mov'].includes(ext || '');
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);

        try {
            const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;
            const filePath = `${project_id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('project-files')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('project-files')
                .getPublicUrl(filePath);

            const { error: insertError } = await supabase.from('files' as any).insert([
                {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    url: publicUrlData.publicUrl,
                    project_id: project_id,
                    file_type: selectedFile.type
                },
            ]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "File uploaded successfully" });
            setSelectedFile(null);
        } catch (err: any) {
            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (file: ProjectFile, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        try {
            // 1. Get path
            let path = "";
            if (file.url.includes('project-files/')) {
                path = file.url.split('project-files/').pop()?.split('?')[0] || "";
            } else if (file.url.startsWith('http')) {
                try {
                    const urlObj = new URL(file.url);
                    const pathParts = urlObj.pathname.split('/');
                    const objectIdx = pathParts.indexOf('object');
                    if (objectIdx !== -1 && pathParts.length > objectIdx + 3) {
                        path = pathParts.slice(objectIdx + 3).join('/');
                    } else {
                        const bucketIdx = pathParts.indexOf('project-files');
                        if (bucketIdx !== -1) {
                            path = pathParts.slice(bucketIdx + 1).join('/');
                        }
                    }
                } catch (e) {
                    path = file.url.split('/').pop() || "";
                }
            } else {
                path = file.url;
            }
            path = decodeURIComponent(path.split('?')[0]);
            if (!path) throw new Error("Could not determine file path");

            // 2. Generate a fresh signed URL to bypass any bucket policy issues
            const { data: signedData, error: signedError } = await supabase.storage
                .from('project-files')
                .createSignedUrl(path, 60);

            if (signedError) throw signedError;
            if (!signedData?.signedUrl) throw new Error("Could not generate secure download link");

            // 3. Fetch the file as a blob to force a browser download dialog
            const response = await fetch(signedData.signedUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file.name;
            link.target = '_self';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            toast({ title: "Started", description: "Download initiated" });
        } catch (err: any) {
            toast({ title: "Download Failed", description: err.message, variant: "destructive" });
        }
    };

    const handleDelete = async (id: string, url: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            // Extract path from URL: everything after 'project-files/'
            const parts = url.split('project-files/');
            if (parts.length < 2) throw new Error("Invalid file path");
            
            const filePath = decodeURIComponent(parts[1]);
            
            const { error: storageError } = await supabase.storage.from('project-files').remove([filePath]);
            if (storageError) throw storageError;

            const { error: deleteError } = await supabase.from('files' as any).delete().eq('id', id);
            if (deleteError) throw deleteError;

            toast({ title: "Deleted", description: "File removed successfully" });
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to delete: " + err.message, variant: "destructive" });
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-red-500/10 rounded-3xl border border-red-500/20 m-4">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Error loading files</h3>
                <p className="text-red-400/80 max-w-xs">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar bg-transparent">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Storage</h1>
                    <p className="text-2xl font-bold text-foreground text-gradient">Project Files</p>
                </div>
                
                {!isInternal ? (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <div className="relative group overflow-hidden bg-card border border-border rounded-2xl p-1 flex-grow">
                            <Input 
                                type="file" 
                                onChange={handleFileChange} 
                                className="bg-transparent border-0 focus-visible:ring-0 cursor-pointer h-10 py-1" 
                            />
                        </div>
                        <Button 
                            onClick={handleUpload} 
                            disabled={uploading || !selectedFile}
                            className="bg-primary hover:bg-primary/80 text-white rounded-2xl px-8 h-12 shadow-lg shadow-primary/20 transition-all font-bold"
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upload File'}
                        </Button>
                    </div>
                ) : (
                    <div className="bg-muted/30 border border-border/50 px-6 py-2 rounded-2xl text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Observation Mode
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
                {files && files.map(file => (
                    <div 
                        key={file.id} 
                        className="group bg-card border border-border rounded-[28px] overflow-hidden transition-all duration-300 hover:bg-accent/50 hover:border-primary/20 hover:translate-y-[-4px] shadow-sm hover:shadow-xl"
                    >
                        {/* Thumbnail Area */}
                        <div className="aspect-video relative overflow-hidden bg-background/40 flex items-center justify-center border-b border-border">
                            {isImage(file.name) ? (
                                <img 
                                    src={file.signedUrl || file.url} 
                                    alt={file.name} 
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                />
                            ) : isVideo(file.name) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-card/60 gap-3 group-hover:bg-card/40 transition-colors">
                                    <div className="p-4 bg-red-400/10 rounded-2xl">
                                        <Video className="w-8 h-8 text-red-400" />
                                    </div>
                                    <span className="text-[10px] font-bold text-red-400 tracking-widest uppercase bg-red-400/10 px-3 py-1 rounded-full">Cinema Preview</span>
                                </div>
                            ) : (
                                <div className="p-6 bg-card rounded-full">
                                    {getFileIcon(file.name)}
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => setPreviewFile(file)}
                                    className="bg-card/60 hover:bg-card border-border"
                                    title="Quick Look"
                                >
                                    <Eye className="w-5 h-5" />
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={(e) => handleDownload(file, e)}
                                    className="bg-card border border-border shadow-sm rounded-full p-2 h-10 w-10 text-primary hover:text-primary/80 transition-colors"
                                    title="Download"
                                >
                                    <Download className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Details Area */}
                        <div className="p-5 flex flex-col gap-1">
                            <h3 className="text-sm font-semibold text-foreground truncate max-w-full" title={file.name}>
                                {file.name}
                            </h3>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{formatBytes(file.size)}</span>
                                {!isInternal && (
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handleDelete(file.id, file.url)}
                                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-0 h-8 w-8 rounded-full"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {files?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6 border border-border">
                        <File className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No files yet</h3>
                    <p className="text-muted-foreground max-w-xs">Upload important assets, scripts, or images to share with your team.</p>
                </div>
            )}

            {/* Quick Look Dialog */}
            <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
                <DialogContent className="max-w-5xl w-[95vw] h-[85vh] bg-card border border-border p-0 rounded-[32px] overflow-hidden flex flex-col shadow-3xl">
                    <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            {previewFile && getFileIcon(previewFile.name)}
                            <DialogTitle className="text-lg font-bold text-foreground truncate">
                                {previewFile?.name}
                            </DialogTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            {previewFile && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={(e) => handleDownload(previewFile, e)}
                                    className="rounded-xl border-border hover:bg-accent/50"
                                >
                                    <Download className="w-4 h-4 mr-2" /> Download
                                </Button>
                            )}
                        </div>
                        <DialogDescription className="sr-only">
                            Preview of {previewFile?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow relative bg-black/20 flex items-center justify-center p-4 sm:p-12 overflow-hidden">
                        {previewFile && isImage(previewFile.name) ? (
                            <img 
                                src={previewFile.signedUrl || previewFile.url} 
                                alt={previewFile.name} 
                                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-500" 
                            />
                        ) : previewFile && isVideo(previewFile.name) ? (
                            <video 
                                src={previewFile.signedUrl || previewFile.url} 
                                controls 
                                className="max-w-full max-h-full rounded-xl shadow-2xl animate-in fade-in duration-500" 
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <FileText className="w-32 h-32 text-muted-foreground opacity-20" />
                                <p className="text-foreground text-lg font-medium">Preview not available for this file type</p>
                                <Button 
                                    onClick={(e) => previewFile && handleDownload(previewFile, e)} 
                                    className="bg-primary text-white rounded-2xl px-8 py-6 h-auto font-bold text-lg hover:scale-105 transition-transform"
                                >
                                    Download to System
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Files;
