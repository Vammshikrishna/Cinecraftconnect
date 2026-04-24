import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Upload, Video, Clapperboard } from "lucide-react";

interface JobApplicationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    jobId: string;
    jobTitle: string;
    onSuccess?: () => void;
}

export function JobApplicationModal({ isOpen, onOpenChange, jobId, jobTitle, onSuccess }: JobApplicationModalProps) {
    const [introduction, setIntroduction] = useState("");
    const [showreelUrl, setShowreelUrl] = useState("");
    const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPortfolioFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSubmitting(true);
        try {
            let resumeUrl = null;

            if (portfolioFile) {
                const fileExt = portfolioFile.name.split('.').pop();
                const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('resumes')
                    .upload(filePath, portfolioFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('resumes')
                    .getPublicUrl(filePath);

                resumeUrl = publicUrl;
            }

            const { error } = await supabase
                .from('job_applications')
                .insert({
                    job_id: jobId,
                    applicant_id: user.id,
                    cover_letter: introduction,
                    showreel_url: showreelUrl,
                    resume_url: resumeUrl,
                    status: 'pending'
                });

            if (error) throw error;
            
            if (onSuccess) onSuccess();

            toast({
                title: "Application Submitted",
                description: "Your application has been sent successfully!",
            });
            onOpenChange(false);
            
            // Reset fields
            setIntroduction("");
            setShowreelUrl("");
            setPortfolioFile(null);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden bg-background border-none rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.15)] ring-1 ring-black/5 mx-auto max-h-[90vh] flex flex-col">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex flex-col h-full overflow-y-auto scrollbar-none"
                >
                    {/* Accessibility Titles (Hidden from sight, read by screen readers) */}
                    <VisuallyHidden>
                        <DialogTitle>Requirement for {jobTitle}</DialogTitle>
                        <DialogDescription>Submit your application details for this role.</DialogDescription>
                    </VisuallyHidden>

                    {/* Header: Branded Emerald Section */}
                    <div className="bg-gradient-to-br from-primary to-primary/90 p-6 sm:p-10 text-primary-foreground relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
                        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                             <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                                 <Clapperboard className="w-6 h-6 sm:w-8 sm:h-8" />
                             </div>
                             <div className="min-w-0">
                                <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight truncate px-1">Requirement for {jobTitle}</h2>
                             </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 sm:p-10 space-y-5 sm:space-y-8 flex-1">
                        <div className="space-y-5 sm:space-y-8">
                            <div className="space-y-2.5">
                                <Label htmlFor="introduction" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Introduction & Experience
                                </Label>
                                <Textarea
                                    id="introduction"
                                    placeholder="Tell the producer about your fit for this role..."
                                    value={introduction}
                                    onChange={(e) => setIntroduction(e.target.value)}
                                    className="min-h-[100px] sm:min-h-[140px] rounded-xl sm:rounded-2xl bg-card border-border hover:bg-muted/50 focus:bg-background transition-all text-sm sm:text-lg p-4 sm:p-6 resize-none shadow-sm leading-relaxed"
                                    required
                                />
                            </div>

                            <div className="space-y-2.5">
                                <Label htmlFor="showreel" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Showreel / Performance Link
                                </Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-primary/60">
                                        <Video size={18} className="sm:w-5 sm:h-5" />
                                    </div>
                                    <input
                                        id="showreel"
                                        type="url"
                                        placeholder="YouTube or Vimeo Link..."
                                        value={showreelUrl}
                                        onChange={(e) => setShowreelUrl(e.target.value)}
                                        className="w-full h-12 sm:h-16 pl-12 pr-4 rounded-xl sm:rounded-2xl bg-card border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-xs sm:text-sm shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label htmlFor="portfolio" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Portfolio / Headshots / CV
                                </Label>
                                <div 
                                    onClick={() => document.getElementById('portfolio-upload')?.click()}
                                    className="w-full py-4 sm:py-6 border-2 border-dashed border-border rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 px-4 sm:px-6 group cursor-pointer hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
                                >
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all shrink-0">
                                        <Upload size={20} className="sm:w-6 sm:h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs sm:text-sm font-black text-foreground truncate px-1">
                                            {portfolioFile ? portfolioFile.name : "Select Media File"}
                                        </p>
                                        <p className="text-[9px] sm:text-[11px] font-bold text-muted-foreground/50 px-1 uppercase tracking-tighter">PDF or IMAGES (MAX 10MB)</p>
                                    </div>
                                    <input
                                        id="portfolio-upload"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-4 sm:pt-6">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-12 sm:h-16 w-full sm:flex-1 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs bg-muted/40 hover:bg-muted text-muted-foreground transition-all">
                                Dismiss
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="h-12 sm:h-16 w-full sm:flex-[2] rounded-xl sm:rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                {isSubmitting ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Clapperboard size={18} className="sm:w-5 sm:h-5" />
                                        <span>Submit Application</span>
                                    </div>
                                )}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}

