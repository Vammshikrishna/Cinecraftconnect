import { useState } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Download, Trash2, Upload, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    const { data: callSheets, error } = useRealtimeData<CallSheet>('call_sheets', 'project_id', project_id);
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
                    location: location || null,
                    director: director || null,
                    director_phone: directorPhone || null,
                    producer: producer || null,
                    producer_phone: producerPhone || null,
                    notes: notes || null
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Call sheet created successfully" });
            setDialogOpen(false);
            resetForm();
        } catch (err: any) {
            console.error('Create error:', err);
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
            // Upload file to storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${project_id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('call-sheets')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('call-sheets')
                .getPublicUrl(fileName);

            // Insert call sheet record with file reference
            const { error: insertError } = await supabase
                .from('call_sheets' as any)
                .insert([{
                    project_id,
                    date,
                    notes: `Uploaded file: ${publicUrl}`
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Call sheet uploaded successfully" });
            setUploadDialogOpen(false);
            resetForm();
        } catch (err: any) {
            console.error('Upload error:', err);
            toast({ title: "Error", description: "Failed to upload call sheet", variant: "destructive" });
        } finally {
            setUploading(false);
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
        return new Date(dateString).toLocaleDateString();
    };

    if (error) {
        return <div className="p-8 text-destructive">Error loading call sheets: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Call Sheet</h1>
                <div className="flex gap-2">
                    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" />Create Call Sheet</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Create Call Sheet</DialogTitle>
                                <DialogDescription>Fill in the details below to create a new call sheet.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Date *</Label>
                                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Call Time</Label>
                                        <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <Label>Location</Label>
                                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Studio A, 123 Main St" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Director</Label>
                                        <Input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Director name" />
                                    </div>
                                    <div>
                                        <Label>Director Phone</Label>
                                        <Input value={directorPhone} onChange={(e) => setDirectorPhone(e.target.value)} placeholder="Phone number" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Producer</Label>
                                        <Input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Producer name" />
                                    </div>
                                    <div>
                                        <Label>Producer Phone</Label>
                                        <Input value={producerPhone} onChange={(e) => setProducerPhone(e.target.value)} placeholder="Phone number" />
                                    </div>
                                </div>
                                <div>
                                    <Label>Notes</Label>
                                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={4} />
                                </div>
                                <Button onClick={handleCreate} disabled={creating} className="w-full">
                                    {creating ? 'Creating...' : 'Create Call Sheet'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Upload PDF</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload Call Sheet</DialogTitle>
                                <DialogDescription>Upload an existing call sheet file (PDF, Image).</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Date *</Label>
                                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                </div>
                                <div>
                                    <Label>Call Sheet File *</Label>
                                    <Input type="file" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                                    {selectedFile && <span className="text-sm text-muted-foreground mt-2 block">{selectedFile.name}</span>}
                                </div>
                                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                                    {uploading ? 'Uploading...' : <><Upload className="h-4 w-4 mr-2" />Upload Call Sheet</>}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {callSheets && callSheets.length > 0 ? (
                <div className="space-y-4">
                    {callSheets.map(sheet => (
                        <div key={sheet.id} className="bg-slate-800/50 p-6 rounded-lg shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    <h2 className="text-xl font-semibold">{formatDate(sheet.date)}</h2>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(sheet.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {sheet.call_time && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Call Time</p>
                                        <p className="font-medium">{sheet.call_time}</p>
                                    </div>
                                )}
                                {sheet.location && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Location</p>
                                        <p className="font-medium">{sheet.location}</p>
                                    </div>
                                )}
                            </div>

                            {(sheet.director || sheet.producer) && (
                                <div className="border-t border-slate-700 pt-4 mt-4">
                                    <h3 className="font-semibold mb-3">Contacts</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {sheet.director && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Director</p>
                                                <p className="font-medium">{sheet.director}</p>
                                                {sheet.director_phone && <p className="text-sm text-muted-foreground">{sheet.director_phone}</p>}
                                            </div>
                                        )}
                                        {sheet.producer && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Producer</p>
                                                <p className="font-medium">{sheet.producer}</p>
                                                {sheet.producer_phone && <p className="text-sm text-muted-foreground">{sheet.producer_phone}</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {sheet.notes && (
                                <div className="border-t border-slate-700 pt-4 mt-4">
                                    <h3 className="font-semibold mb-2">Notes</h3>
                                    {sheet.notes.startsWith('Uploaded file:') ? (
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={sheet.notes.replace('Uploaded file: ', '')} target="_blank" rel="noopener noreferrer">
                                                <Download className="h-4 w-4 mr-2" />Download Call Sheet
                                            </a>
                                        </Button>
                                    ) : (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sheet.notes}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No call sheets have been created for this project yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Click "Create Call Sheet" or "Upload PDF" to get started.</p>
                </div>
            )}
        </div>
    );
};

export default CallSheet;
