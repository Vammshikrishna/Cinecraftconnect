import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/database.types';

type Experience = Tables<'user_experience'>;
type ExperienceInsert = Tables<'user_experience', 'Insert'>;

const ExperienceForm = ({ experience, onSave, onCancel }: { experience?: Experience, onSave: (exp: Experience) => void, onCancel: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ExperienceInsert>({
    user_id: user!.id,
    title: experience?.title || '',
    company: experience?.company || '',
    start_date: experience?.start_date || '',
    end_date: experience?.end_date || null,
    description: experience?.description || null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrent, setIsCurrent] = useState(!experience?.end_date);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const dataToSubmit = { ...formData, end_date: isCurrent ? null : formData.end_date };

    const { data, error } = await supabase
      .from('user_experience')
      .upsert(dataToSubmit)
      .select()
      .single();

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
      {/* Form fields for title, company, dates, and description */}
      {/* ... similar to existing form ... */}
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
    const { data, error } = await supabase
      .from('user_experience')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });
    
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

    const { error } = await supabase.from('user_experience').delete().eq('id', id);

    if (error) {
      setExperiences(originalExperiences);
      toast({ title: 'Error deleting experience', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Experience Deleted', description: 'Your experience has been removed.' });
    }
  };

  const ExperienceSkeleton = () => (
      <div className="space-y-8">
          {[...Array(2)].map((_, i) => (
              <div key={i} className="relative pl-8 border-l-2 border-gray-700/50">
                  <div className="absolute -left-3 top-0 h-5 w-5 bg-gray-600/50 rounded-full animate-pulse"></div>
                  <div className="space-y-2">
                      <div className="h-5 w-2/5 bg-gray-700/50 rounded animate-pulse"></div>
                      <div className="h-4 w-1/4 bg-gray-700/50 rounded animate-pulse"></div>
                      <div className="h-3 w-1/5 bg-gray-700/50 rounded animate-pulse"></div>
                  </div>
              </div>
          ))}
      </div>
  );

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Experience</CardTitle>
        {isOwner && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setSelectedExperience(undefined)}><Plus size={16} className="mr-2" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{selectedExperience ? 'Edit' : 'Add'} Experience</DialogTitle></DialogHeader>
              <ExperienceForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} experience={selectedExperience} />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? <ExperienceSkeleton /> : (
          <div className="space-y-6">
            {experiences.length > 0 ? experiences.map(exp => (
              <div key={exp.id} className="relative pl-8 border-l-2 border-gray-700">
                <div className="absolute -left-3 top-1 h-5 w-5 bg-primary/50 rounded-full border-4 border-card"></div>
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-lg text-foreground">{exp.title}</h4>
                        <p className="text-md text-muted-foreground">{exp.company}</p>
                        <p className="text-sm text-muted-foreground/80 flex items-center">
                            <Calendar className="h-4 w-4 mr-2"/>
                            {new Date(exp.start_date).getFullYear()} - {exp.end_date ? new Date(exp.end_date).getFullYear() : 'Present'}
                        </p>
                        {exp.description && <p className="mt-3 text-foreground/90 whitespace-pre-line">{exp.description}</p>}
                    </div>
                    {isOwner && (
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedExperience(exp); setIsModalOpen(true); }}><Edit size={16} /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)}><Trash2 size={16} /></Button>
                        </div>
                    )}
                </div>
              </div>
            )) : <p className="text-muted-foreground text-sm">{isOwner ? "Add your work experience." : "No experience listed."}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Experience;
