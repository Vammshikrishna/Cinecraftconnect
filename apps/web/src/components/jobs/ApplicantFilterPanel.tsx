import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Filter, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface ApplicantFilters {
    skills: string[];
    location: string;
    availability: string;
    rateMax: number | null;
    union: string[];
    minCredits: number;
}

interface ApplicantFilterPanelProps {
    jobId: string;
    filters: ApplicantFilters;
    onFilterChange: (filters: ApplicantFilters) => void;
}

const COMMON_SKILLS = ['Directing', 'Cinematography', 'Editing', 'Sound Design', 'VFX', 'Color Grading'];
const UNION_OPTIONS = ['SAG-AFTRA', 'DGA', 'WGA', 'PGA', 'IATSE', 'Teamsters', 'Non-Union'];

export const ApplicantFilterPanel: React.FC<ApplicantFilterPanelProps> = ({ jobId, filters, onFilterChange }) => {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');

    const handleSaveSearch = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Must be logged in to save searches");

            const { error } = await (supabase.from as any)('job_saved_searches').insert({
                user_id: user.id,
                job_id: jobId,
                name: `Search: ${filters.skills.join(', ') || 'All Talent'}`,
                filters: filters as any
            });
            
            if (error) throw error;
            
            toast({
                title: "Search Saved",
                description: "You'll be notified when new applicants match these criteria.",
            });
        } catch (error: any) {
            console.error('Error saving search:', error);
            toast({
                title: "Error",
                description: "Failed to save search.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSkill = (skill: string) => {
        const newSkills = filters.skills.includes(skill)
            ? filters.skills.filter(s => s !== skill)
            : [...filters.skills, skill];
        onFilterChange({ ...filters, skills: newSkills });
    };

    const toggleUnion = (union: string) => {
        const newUnions = filters.union.includes(union)
            ? filters.union.filter(u => u !== union)
            : [...filters.union, union];
        onFilterChange({ ...filters, union: newUnions });
    };

    return (
        <Card className="bg-card/40 backdrop-blur-xl border border-border/50 shadow-lg rounded-[2rem] overflow-hidden mb-8">
            <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6 border-b border-border/50 pb-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-black tracking-tight">Advanced Filtering</h3>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="font-bold border-primary/20 hover:bg-primary/10 text-primary"
                        onClick={handleSaveSearch}
                        disabled={isSaving}
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        Save & Alert
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Skills Filter */}
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Skills Match</Label>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_SKILLS.map(skill => (
                                <Badge 
                                    key={skill}
                                    variant={filters.skills.includes(skill) ? "default" : "outline"}
                                    className="cursor-pointer font-bold hover:opacity-80 border-border/50 transition-all"
                                    onClick={() => toggleSkill(skill)}
                                >
                                    {skill}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Location & Rate */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Location</Label>
                            <Input 
                                placeholder="e.g. Los Angeles" 
                                value={filters.location}
                                onChange={(e) => onFilterChange({ ...filters, location: e.target.value })}
                                className="bg-background/50 border-border/50 rounded-xl"
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                                <span>Max Day Rate</span>
                                <span className="text-primary">${filters.rateMax || 'Any'}</span>
                            </Label>
                            <Slider
                                value={[filters.rateMax || 2000]}
                                min={100}
                                max={2000}
                                step={50}
                                onValueChange={(val) => onFilterChange({ ...filters, rateMax: val[0] === 2000 ? null : val[0] })}
                                className="py-2"
                            />
                        </div>
                    </div>

                    {/* Meta Filters */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Availability</Label>
                            <Select 
                                value={filters.availability} 
                                onValueChange={(val) => onFilterChange({ ...filters, availability: val })}
                            >
                                <SelectTrigger className="bg-background/50 border-border/50 rounded-xl font-bold">
                                    <SelectValue placeholder="Any Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">Any Status</SelectItem>
                                    <SelectItem value="available">Available Now</SelectItem>
                                    <SelectItem value="busy">Currently Busy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Union Affiliation</Label>
                            <div className="flex flex-wrap gap-2">
                                {UNION_OPTIONS.map(union => (
                                    <Badge 
                                        key={union}
                                        variant={filters.union.includes(union) ? "secondary" : "outline"}
                                        className="cursor-pointer font-bold border-border/50 hover:bg-muted"
                                        onClick={() => toggleUnion(union)}
                                    >
                                        {union}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
