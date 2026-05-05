import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Download, Trash2, Upload, MapPin, User, Phone, Loader2, Info, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';

interface CallSheet {
    id: string;
    date: string;
    call_time: string | null;
    location: string | null;
    director: string | null;
    director_phone: string | null;
    producer: string | null;
    producer_phone: string | null;
    notes: string | null;
    created_at: string;
}

interface CallSheetProps {
    project_id: string;
}

const CallSheet = ({ project_id }: CallSheetProps) => {
    const { isInternal } = useAppRole();
    const { data: rawCallSheets, error } = useRealtimeData<CallSheet>('call_sheets', 'project_id', project_id);
    const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [date, setDate] = useState('');
    const [callTime, setCallTime] = useState('');
    const [location, setLocation] = useState('');
    const [director, setDirector] = useState('');
    const [directorPhone, setDirectorPhone] = useState('');
    const [producer, setProducer] = useState('');
    const [producerPhone, setProducerPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const resetForm = () => {
        setDate('');
        setCallTime('');
        setLocation('');
        setDirector('');
        setDirectorPhone('');
        setProducer('');
        setProducerPhone('');
        setNotes('');
        setSelectedFile(null);
    };

    useEffect(() => {
        setCallSheets(rawCallSheets || []);
    }, [rawCallSheets]);

    const handleCreate = async () => {
        if (!date) {
            toast({ title: "Error", description: "Date is required", variant: "destructive" });
            return;
        }

        setCreating(true);

        try {
            const { error: insertError } = await supabase
                .from('call_sheets' as any)
                .insert([{
                    project_id,
                    date,
                    call_time: callTime || null,
                    location,
                    director,
                    director_phone: directorPhone,
                    producer,
                    producer_phone: producerPhone,
                    notes
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Call sheet created successfully" });
            setDialogOpen(false);
            resetForm();
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to create call sheet", variant: "destructive" });
        } finally {
            setCreating(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !date) {
            toast({ title: "Error", description: "Date and file are required", variant: "destructive" });
            return;
        }

        setUploading(true);

        try {
            const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;
            const filePath = `call-sheets/${project_id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('project-files')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('project-files')
                .getPublicUrl(filePath);

            const notesContent = `Uploaded file: ${publicUrl}`;

            const { error: insertError } = await supabase
                .from('call_sheets' as any)
                .insert([{
                    project_id,
                    date,
                    notes: notesContent
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Call sheet uploaded successfully" });
            setUploadDialogOpen(false);
            resetForm();
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to upload call sheet", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (url: string, fileName: string) => {
        try {
            let path = "";
            if (url.includes('project-files/')) {
                path = url.split('project-files/').pop()?.split('?')[0] || "";
            } else if (url.startsWith('http')) {
                try {
                    const urlObj = new URL(url);
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
                    path = url.split('/').pop() || "";
                }
            } else {
                path = url;
            }
            path = decodeURIComponent(path.split('?')[0]);
            if (!path) throw new Error("Invalid file path structure");
            
            // 2. Generate signed URL
            const { data: signedData, error: signedError } = await supabase.storage
                .from('project-files')
                .createSignedUrl(path, 60);

            if (signedError) throw signedError;
            if (!signedData?.signedUrl) throw new Error("Could not generate secure download link");

            // 3. Fetch as blob
            const response = await fetch(signedData.signedUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast({ title: "Success", description: "Downloading " + fileName });
        } catch (err: any) {
            toast({ title: "Error", description: "Download failed: " + err.message, variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this call sheet?')) return;

        try {
            const { error } = await supabase
                .from('call_sheets' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({ title: "Success", description: "Call sheet deleted" });
        } catch (err: any) {
            toast({ title: "Error", description: "Failed to delete call sheet", variant: "destructive" });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    if (error) {
        return <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">Error loading call sheets: {error.message}</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto w-full no-scrollbar bg-transparent">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Production</h1>
                    <p className="text-2xl font-bold text-foreground text-gradient">Call Sheets</p>
                </div>
                
                {!isInternal ? (
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-primary/20 transition-all">
                                    <Plus className="h-5 w-5 mr-2" /> 
                                    Create New
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl w-[95vw] bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
                                <DialogHeader className="p-6 border-b border-border">
                                    <DialogTitle className="text-xl font-bold text-foreground">Sheet Details</DialogTitle>
                                    <DialogDescription className="text-muted-foreground mt-1">Populate production requirements for the upcoming day.</DialogDescription>
                                </DialogHeader>
                                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Production Date</Label>
                                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">General Call Time</Label>
                                            <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Location Details</Label>
                                        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Studio 42, Los Angeles" className="bg-background border-border rounded-xl h-12" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Director</Label>
                                            <Input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Name" className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Director Mobile</Label>
                                            <Input value={directorPhone} onChange={(e) => setDirectorPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Producer</Label>
                                            <Input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Name" className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Producer Mobile</Label>
                                            <Input value={producerPhone} onChange={(e) => setProducerPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-background border-border rounded-xl h-12" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Safety & Talent Notes</Label>
                                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions for cast and crew..." className="bg-background border-border rounded-xl min-h-[120px] resize-none" />
                                    </div>
                                    <Button onClick={handleCreate} disabled={creating} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20">
                                        {creating ? <Loader2 className="animate-spin" /> : 'Create Call Sheet'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
    
                        <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) resetForm(); }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex-1 sm:flex-none border-border bg-card hover:bg-accent/50 text-foreground rounded-2xl px-6 h-12 font-bold backdrop-blur-xl transition-all">
                                    <Upload className="h-5 w-5 mr-2" /> Upload PDF
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] sm:max-w-md bg-card border border-border p-0 rounded-[32px] overflow-hidden shadow-3xl">
                                <DialogHeader className="p-6 border-b border-border">
                                    <DialogTitle className="text-xl font-bold text-foreground">Upload Metadata</DialogTitle>
                                    <DialogDescription className="text-muted-foreground mt-1">Link an existing PDF document to a production date.</DialogDescription>
                                </DialogHeader>
                                <div className="p-6 space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Shoot Date</Label>
                                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-primary tracking-wider uppercase ml-1">Document File</Label>
                                        <div className="group relative">
                                            <Input type="file" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="bg-background border-border rounded-xl h-12 py-3 cursor-pointer file:bg-transparent file:text-primary file:font-bold file:border-0" />
                                        </div>
                                        {selectedFile && <span className="text-xs text-primary font-medium mt-2 flex items-center gap-2"><Info className="w-3 h-3" /> {selectedFile.name}</span>}
                                    </div>
                                    <Button onClick={handleUpload} disabled={uploading} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20">
                                        {uploading ? <Loader2 className="animate-spin" /> : <><Upload className="h-5 w-5 mr-2" /> Confirm Upload</>}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : (
                    <div className="bg-muted/30 border border-border/50 px-6 py-3 rounded-2xl text-sm text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-3">
                        <Info className="w-4 h-4" /> Observation Mode
                    </div>
                )}
            </div>

            {callSheets && callSheets.length > 0 ? (
                <div className="flex flex-col gap-16 max-w-4xl mx-auto pb-64 snap-y snap-proximity">
                    {callSheets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sheet, index) => (
                        <div key={sheet.id} className="relative pl-8 sm:pl-16 border-l-[3px] border-primary/20 last:border-l-0 pb-16 snap-start">
                            {/* Timeline Node */}
                            <div className="absolute top-0 left-[-12px] w-[21px] h-[21px] bg-primary rounded-full border-4 border-background shadow-lg shadow-primary/40 z-20" />
                            
                            {/* Date Header - Natural Scroll */}
                            <div className="relative mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-10 p-2 rounded-2xl -ml-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black tracking-[0.3em] text-primary uppercase ml-1">Production Day {callSheets.length - index}</p>
                                        <span className="h-px w-8 bg-primary/30" />
                                    </div>
                                    <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tighter">{formatDate(sheet.date)}</h2>
                                </div>
                                {!isInternal && (
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handleDelete(sheet.id)}
                                        className="bg-destructive/10 hover:bg-destructive text-destructive hover:text-white rounded-full p-2 h-10 w-10 transition-all opacity-40 hover:opacity-100 self-start sm:self-auto"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>

                            <div className="group bg-card/60 border border-border shadow-2xl rounded-[40px] p-6 sm:p-12 hover:bg-accent/40 active:scale-[0.99] transition-all duration-700 relative overflow-hidden backdrop-blur-xl">
                                {/* Cinematic Gradient Overlays */}
                                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full group-hover:bg-primary/20 transition-all pointer-events-none" />
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
                                
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
                                    {/* Left Content - Core Specs */}
                                    <div className="lg:col-span-12 xl:col-span-7 space-y-10">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                            {sheet.call_time && (
                                                <div className="bg-card border border-border/50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all group/stat">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-primary/10 rounded-xl group-hover/stat:bg-primary/20 transition-colors">
                                                            <Clock className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">General Call</p>
                                                    </div>
                                                    <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground font-mono tracking-tighter">
                                                        {sheet.call_time && sheet.call_time.includes(':') ? sheet.call_time.split(':').slice(0, 2).join(':') : sheet.call_time}
                                                    </p>
                                                </div>
                                            )}
                                            {sheet.location && (
                                                <div className="bg-card border border-border/50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all group/stat">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-primary/10 rounded-xl group-hover/stat:bg-primary/20 transition-colors">
                                                            <MapPin className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Live Location</p>
                                                    </div>
                                                    <p className="text-base sm:text-lg font-bold text-foreground/90 leading-snug tracking-tight">
                                                        {sheet.location}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {(sheet.director || sheet.producer) && (
                                            <div className="flex flex-wrap gap-12 py-8 border-y border-border/40">
                                                {sheet.director && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 opacity-50 mb-1">
                                                            <User className="w-3.5 h-3.5" />
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Director</p>
                                                        </div>
                                                        <p className="text-xl font-black text-foreground tracking-tight">{sheet.director}</p>
                                                        {sheet.director_phone && (
                                                            <a href={`tel:${sheet.director_phone}`} className="text-xs text-primary font-bold hover:underline flex items-center gap-2 group/phone">
                                                                <Phone className="w-3 h-3 group-hover/phone:rotate-12 transition-transform" /> 
                                                                {sheet.director_phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                {sheet.producer && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 opacity-50 mb-1">
                                                            <User className="w-3.5 h-3.5" />
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Producer</p>
                                                        </div>
                                                        <p className="text-xl font-black text-foreground tracking-tight">{sheet.producer}</p>
                                                        {sheet.producer_phone && (
                                                            <a href={`tel:${sheet.producer_phone}`} className="text-xs text-primary font-bold hover:underline flex items-center gap-2 group/phone">
                                                                <Phone className="w-3 h-3 group-hover/phone:rotate-12 transition-transform" /> 
                                                                {sheet.producer_phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Content - Full Width Notes or Call to Action */}
                                    <div className="lg:col-span-12 xl:col-span-5 flex flex-col justify-center">
                                        {sheet.notes && (
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="w-4 h-4 text-primary" />
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Production Log</p>
                                                </div>
                                                {sheet.notes.startsWith('Uploaded file:') ? (
                                                    <Button 
                                                        className="w-full bg-primary hover:bg-primary/90 text-white rounded-[24px] h-24 font-black transition-all flex flex-col items-center justify-center gap-1 shadow-2xl shadow-primary/30 active:scale-95 group/btn" 
                                                        onClick={() => handleDownload(sheet.notes!.replace('Uploaded file: ', ''), `CallSheet_${formatDate(sheet.date)}.pdf`)}
                                                    >
                                                        <Download className="h-8 w-8 mb-1 group-hover/btn:translate-y-1 transition-transform" />
                                                        <span className="text-[10px] uppercase tracking-widest opacity-80">Download Digital Pack</span>
                                                    </Button>
                                                ) : (
                                                    <div className="bg-background/40 rounded-3xl p-8 border border-border/50 italic text-sm text-foreground/90 leading-relaxed shadow-inner max-h-[300px] overflow-y-auto no-scrollbar scroll-smooth">
                                                        <span className="text-primary text-2xl font-serif mr-1">"</span>
                                                        {sheet.notes}
                                                        <span className="text-primary text-2xl font-serif ml-1">"</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-card border border-border shadow-sm rounded-full flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No Call Sheets</h3>
                    <p className="text-muted-foreground max-w-xs mb-8">Maintain production momentum by creating specialized daily schedules.</p>
                </div>
            )}
        </div>
    );
};

export default CallSheet;
