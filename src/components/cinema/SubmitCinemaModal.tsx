
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Film, Video, Plus, Trash2, Image as ImageIcon, Layout, GalleryHorizontal } from "lucide-react";
import { EnhancedFileUpload } from "@/components/ui/enhanced-file-upload";

interface SubmitCinemaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const SubmitCinemaModal = ({ isOpen, onClose, onSuccess }: SubmitCinemaModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        title: "",
        type: "movie",
        overview: "",
        poster_url: "",
        backdrop_url: "",
        trailer_url: "",
        release_date: new Date().toISOString().split('T')[0],
        genre: [] as string[],
        runtime: 0,
        credits: [] as { role: string, name: string }[],
        gallery: [] as string[]
    });

    const [newGenre, setNewGenre] = useState("");
    const [newCredit, setNewCredit] = useState({ role: "", name: "" });

    const handleUpload = async (file: File, type: 'poster' | 'backdrop' | 'gallery') => {
        if (!user) return "";
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${type}.${fileExt}`;
        const filePath = `cinema/${fileName}`;

        // Note: Using 'project-assets' bucket. Ensure it exists or update bucket name.
        const { error: uploadError } = await supabase.storage
            .from('project-assets')
            .upload(filePath, file);

        if (uploadError) {
            console.error(`Error uploading ${type}:`, uploadError);
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('project-assets')
            .getPublicUrl(filePath);

        if (type === 'poster') setFormData(prev => ({ ...prev, poster_url: publicUrl }));
        if (type === 'backdrop') setFormData(prev => ({ ...prev, backdrop_url: publicUrl }));
        if (type === 'gallery') setFormData(prev => ({ ...prev, gallery: [...prev.gallery, publicUrl] }));

        return publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        if (!formData.poster_url) {
            toast({ title: "Poster Required", description: "Please upload a poster for your film.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('platform_cinema')
                .insert({
                    creator_id: user.id,
                    ...formData
                });

            if (error) throw error;

            toast({ title: "Success!", description: "Your film has been submitted to the platform." });
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Error submitting film:", error);
            toast({ title: "Error", description: "Failed to submit film. Please try again.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const addGenre = () => {
        if (newGenre.trim() && !formData.genre.includes(newGenre.trim())) {
            setFormData({ ...formData, genre: [...formData.genre, newGenre.trim()] });
            setNewGenre("");
        }
    };

    const removeGenre = (g: string) => {
        setFormData({ ...formData, genre: formData.genre.filter(item => item !== g) });
    };

    const addCredit = () => {
        if (newCredit.role && newCredit.name) {
            setFormData({ ...formData, credits: [...formData.credits, newCredit] });
            setNewCredit({ role: "", name: "" });
        }
    };

    const removeCredit = (index: number) => {
        setFormData({ ...formData, credits: formData.credits.filter((_, i) => i !== index) });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Film className="h-6 w-6 text-primary" />
                        Submit Your Work
                    </DialogTitle>
                    <DialogDescription>
                        Fill in the details for your film, ad, or show to showcase it on CineCraft Connect.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-8 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Title *</label>
                            <Input 
                                required
                                placeholder="Enter film title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Content Type *</label>
                            <Select 
                                value={formData.type} 
                                onValueChange={(value) => setFormData({ ...formData, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="movie">Feature Film</SelectItem>
                                    <SelectItem value="short">Short Film</SelectItem>
                                    <SelectItem value="tv">Web Series / TV Show</SelectItem>
                                    <SelectItem value="ad">Advertisement / Brand Film</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Media Assets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-primary" /> Film Poster (Vertical) *
                            </label>
                            <EnhancedFileUpload 
                                onFileUpload={(file) => handleUpload(file, 'poster')}
                                accept="image/*"
                                maxSize={5}
                                className={formData.poster_url ? "border-primary/50 bg-primary/5" : ""}
                            >
                                {formData.poster_url ? (
                                    <div className="relative group">
                                        <img src={formData.poster_url} alt="Poster Preview" className="h-40 mx-auto rounded-lg object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <p className="text-white text-xs font-bold">Click to change</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-xs font-medium">Upload vertical poster (2:3 aspect recommended)</p>
                                    </div>
                                )}
                            </EnhancedFileUpload>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Layout className="h-4 w-4 text-primary" /> Film Backdrop (Horizontal) *
                            </label>
                            <EnhancedFileUpload 
                                onFileUpload={(file) => handleUpload(file, 'backdrop')}
                                accept="image/*"
                                maxSize={5}
                                className={formData.backdrop_url ? "border-primary/50 bg-primary/5" : ""}
                            >
                                {formData.backdrop_url ? (
                                    <div className="relative group">
                                        <img src={formData.backdrop_url} alt="Backdrop Preview" className="w-full h-40 rounded-lg object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <p className="text-white text-xs font-bold">Click to change</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-xs font-medium">Upload cinematic backdrop (16:9 aspect recommended)</p>
                                    </div>
                                )}
                            </EnhancedFileUpload>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-bold flex items-center gap-2">
                            <Video className="h-4 w-4 text-primary" /> Trailer URL (YouTube/Vimeo)
                        </label>
                        <Input 
                            placeholder="https://youtube.com/watch?v=..."
                            value={formData.trailer_url}
                            onChange={(e) => setFormData({ ...formData, trailer_url: e.target.value })}
                            className="bg-secondary/20"
                        />
                    </div>

                    {/* Gallery Section */}
                    <div className="space-y-4 p-6 bg-secondary/10 rounded-2xl border-2 border-dashed border-secondary/20">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <GalleryHorizontal className="h-4 w-4 text-primary" /> Gallery & Screenshots (Up to 5)
                            </label>
                            <span className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Optional Showcase</span>
                        </div>
                        
                        <EnhancedFileUpload 
                            onFileUpload={(file) => handleUpload(file, 'gallery')}
                            accept="image/*"
                            maxSize={5}
                            multiple
                            disabled={formData.gallery.length >= 5}
                        >
                            <div className="py-2">
                                <Plus className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs">Add more visuals to impress the community</p>
                            </div>
                        </EnhancedFileUpload>

                        {formData.gallery.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 mt-4">
                                {formData.gallery.map((url, i) => (
                                    <div key={i} className="relative group aspect-square">
                                        <img src={url} className="w-full h-full object-cover rounded-md" />
                                        <button 
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, idx) => idx !== i) }))}
                                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Overview / Synopsis</label>
                        <Textarea 
                            rows={4}
                            placeholder="Tell us what your film is about..."
                            value={formData.overview}
                            onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                        />
                    </div>

                    {/* Genres */}
                    <div className="space-y-4">
                        <label className="text-sm font-semibold">Genres</label>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Action, Drama, etc."
                                value={newGenre}
                                onChange={(e) => setNewGenre(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGenre())}
                            />
                            <Button type="button" variant="outline" onClick={addGenre}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.genre.map(g => (
                                <span key={g} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium flex items-center gap-2">
                                    {g}
                                    <Trash2 className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeGenre(g)} />
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Cast & Crew */}
                    <div className="space-y-4">
                        <label className="text-sm font-semibold">Cast & Crew Credits</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Input 
                                placeholder="Role (e.g. Director)"
                                value={newCredit.role}
                                onChange={(e) => setNewCredit({ ...newCredit, role: e.target.value })}
                            />
                            <Input 
                                placeholder="Name"
                                value={newCredit.name}
                                onChange={(e) => setNewCredit({ ...newCredit, name: e.target.value })}
                            />
                            <Button type="button" variant="outline" onClick={addCredit}>Add Credit</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {formData.credits.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg text-sm">
                                    <span><strong>{c.role}:</strong> {c.name}</span>
                                    <Trash2 className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => removeCredit(i)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="px-8">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit to Platform
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
