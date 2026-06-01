import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Loader2, Calendar, Briefcase, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Experience {
  id: number;
  user_id: string;
  title: string;
  company: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_at: string;
}

type ExperienceInsert = Omit<Experience, 'id' | 'created_at'> & {
  id?: number;
  created_at?: string;
  user_id?: string;
};

const ExperienceForm = ({ experience, onSave, onCancel }: { experience?: Experience, onSave: (exp: Experience) => void, onCancel: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ExperienceInsert>({
    id: experience?.id,
    user_id: user!.id,
    title: experience?.title || '',
    company: experience?.company || '',
    start_date: experience?.start_date || '',
    end_date: experience?.end_date || null,
    description: experience?.description || null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrent, setIsCurrent] = useState(experience ? !experience.end_date : false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const dataToSubmit = { ...formData, end_date: isCurrent ? null : formData.end_date };

    const { data, error } = await (supabase
      .from('user_experience' as any)
      .upsert(dataToSubmit as any)
      .select()
      .single() as any);

    if (error) {
      toast({ title: 'Error saving experience', description: error.message, variant: 'destructive' });
    } else if (data) {
      onSave(data);
      toast({ title: `Experience ${experience ? 'updated' : 'added'}`, description: 'Your profile is now up-to-date.' });
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="title">Job Title</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g. Director of Photography"
            required
          />
        </div>
        <div>
          <Label htmlFor="company">Company / Project</Label>
          <Input
            id="company"
            name="company"
            value={formData.company}
            onChange={handleInputChange}
            placeholder="e.g. Netflix, Cinecraft Studios"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              value={formData.end_date || ''}
              onChange={handleInputChange}
              disabled={isCurrent}
              required={!isCurrent}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="isCurrent"
            checked={isCurrent}
            onCheckedChange={(checked) => {
              setIsCurrent(!!checked);
            }}
          />
          <Label htmlFor="isCurrent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I currently work here
          </Label>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description || ''}
            onChange={handleInputChange}
            placeholder="Describe your responsibilities, achievements, or project details..."
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
};

const Experience = ({ userId, isOwner }: { userId: string, isOwner: boolean }) => {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | undefined>(undefined);
  const { toast } = useToast();

  const fetchExperience = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('user_experience' as any)
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false }) as any);
    
    if (error) toast({ title: 'Error fetching experience', description: error.message, variant: 'destructive' });
    else setExperiences(data || []);
    setLoading(false);
  }, [userId, toast]);

  useEffect(() => { fetchExperience(); }, [fetchExperience]);

  const handleSave = (savedExp: Experience) => {
    const index = experiences.findIndex(exp => exp.id === savedExp.id);
    if (index > -1) {
      setExperiences(prev => prev.map(exp => exp.id === savedExp.id ? savedExp : exp));
    } else {
      setExperiences(prev => [savedExp, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const originalExperiences = experiences;
    setExperiences(prev => prev.filter(exp => exp.id !== id));

    const { error } = await supabase.from('user_experience' as any).delete().eq('id', id);

    if (error) {
      setExperiences(originalExperiences);
      toast({ title: 'Error deleting experience', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Experience Deleted', description: 'Your experience has been removed.' });
    }
  };
  const ExperienceSkeleton = () => (
      <div className="space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:bg-white/[0.03] before:w-[2px] before:rounded">
          {[...Array(2)].map((_, i) => (
              <div key={i} className="relative pl-10">
                  <div className="absolute left-1.5 top-1.5 h-6 w-6 rounded-full border border-white/5 bg-card flex items-center justify-center shadow-sm z-10 animate-pulse">
                    <div className="h-2 w-2 rounded-full bg-gray-600"></div>
                  </div>
                  <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-5 space-y-3">
                      <div className="h-6 w-2/5 bg-gray-800 rounded animate-pulse"></div>
                      <div className="h-4 w-1/4 bg-gray-800 rounded animate-pulse"></div>
                      <div className="h-3 w-1/5 bg-gray-800 rounded animate-pulse"></div>
                  </div>
              </div>
          ))}
      </div>
  );

  return (
    <Card className="glass-card overflow-hidden border border-white/10 shadow-xl bg-background/30 backdrop-blur-md">
      <CardHeader className="border-b border-white/[0.05] bg-white/[0.01] px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">Experience</CardTitle>
        </div>
        {isOwner && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => setSelectedExperience(undefined)}
                className="border-white/10 hover:bg-white/5 text-foreground font-semibold rounded-lg px-4 h-9 transition-all"
              >
                <Plus size={16} className="mr-2 text-primary" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card/95 border border-white/10 backdrop-blur-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {selectedExperience ? 'Edit' : 'Add'} Experience
                </DialogTitle>
              </DialogHeader>
              <div className="pt-4">
                <ExperienceForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} experience={selectedExperience} />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {loading ? <ExperienceSkeleton /> : (
          <div className="space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:bg-white/[0.06] before:w-[2px] before:rounded">
            {experiences.length > 0 ? (
              experiences.map(exp => (
                <div key={exp.id} className="relative pl-10 group transition-all duration-300">
                  {/* Timeline point indicator */}
                  <div className="absolute left-1.5 top-1.5 h-6 w-6 rounded-full border border-white/10 bg-card flex items-center justify-center group-hover:border-primary/50 transition-all duration-300 shadow-sm z-10">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                  </div>
                  
                  {/* Item card */}
                  <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-xl p-5 transition-all duration-300 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-lg sm:text-xl text-foreground group-hover:text-primary transition-colors duration-300 leading-snug">
                          {exp.title}
                        </h4>
                        <p className="text-primary font-bold text-sm tracking-wide uppercase">
                          {exp.company}
                        </p>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-md text-xs text-muted-foreground border border-white/5 mt-2">
                          <Calendar className="h-3.5 w-3.5 text-primary/70" />
                          <span>
                            {new Date(exp.start_date).toLocaleString('default', { month: 'short', year: 'numeric' })} - {exp.end_date ? new Date(exp.end_date).toLocaleString('default', { month: 'short', year: 'numeric' }) : 'Present'}
                          </span>
                        </div>
                      </div>
                      
                      {isOwner && (
                        <div className="flex gap-1.5 self-end sm:self-start bg-white/5 p-1 rounded-lg border border-white/5 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded hover:bg-white/10 hover:text-foreground text-muted-foreground/80 transition-all"
                            onClick={() => { setSelectedExperience(exp); setIsModalOpen(true); }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground/80 transition-all"
                            onClick={() => handleDelete(exp.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {exp.description && (
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground/90 whitespace-pre-line bg-white/[0.01] p-3 rounded-lg border border-white/[0.02]">
                        {exp.description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 px-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl w-full">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
                  <Briefcase className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">No Experience Listed</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  {isOwner ? "Share your career journey and projects to attract potential collaborators and employers." : "This user hasn't added any work experience yet."}
                </p>
                {isOwner && (
                  <Button 
                    onClick={() => { setSelectedExperience(undefined); setIsModalOpen(true); }} 
                    className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg px-6 h-9 transition-all shadow-[0_4px_12px_rgba(var(--primary),0.2)]"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Experience
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Experience;
