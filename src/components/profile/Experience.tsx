
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';

// Manual type definition for experience
interface Experience {
  id: number;
  user_id: string;
  title: string;
  company: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

const Experience = ({ userId, isOwner }: { userId: string, isOwner: boolean }) => {
  const { user } = useAuth();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  // State for adding/editing would be here

  const fetchExperience = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_experience')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setExperiences(data || []);
    } catch (error) {
      console.error('Error fetching experience:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExperience();
  }, [fetchExperience]);

  // Handlers for add, edit, delete would be here

  if (loading) {
    return <div>Loading experience...</div>;
  }

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Experience</h3>
        {isOwner && (
          <Button variant="outline"><Plus size={16} className="mr-2" /> Add Experience</Button>
        )}
      </div>
      <div className="space-y-6">
        {experiences.map(exp => (
          <div key={exp.id} className="relative pl-8 border-l-2 border-gray-700">
            <div className="absolute -left-3 top-0 h-5 w-5 bg-gray-600 rounded-full"></div>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-lg">{exp.title}</h4>
                    <p className="text-md text-gray-400">{exp.company}</p>
                    <p className="text-sm text-gray-500">
                        {new Date(exp.start_date).getFullYear()} - {exp.end_date ? new Date(exp.end_date).getFullYear() : 'Present'}
                    </p>
                    {exp.description && <p className="mt-2 text-gray-300">{exp.description}</p>}
                </div>
                {isOwner && (
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon"><Edit size={16} /></Button>
                        <Button variant="ghost" size="icon"><Trash2 size={16} /></Button>
                    </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Experience;
