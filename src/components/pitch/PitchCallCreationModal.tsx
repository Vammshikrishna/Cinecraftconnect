import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreatePitchCall } from '@/hooks/usePitch';
import { Megaphone, Loader2, Trash2, Calendar, DollarSign } from 'lucide-react';

interface PitchCallCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: () => void;
    initialData?: any;
    pitchCallId?: string;
}

interface PitchCallForm {
    title: string;
    project_type: string;
    format: string;
    genre: string[];
    subgenre: string;
    language: string[];
    target_audience: string;
    budget_range: string;
    compensation: string;
    requirement_description: string;
    tone: string;
    ref_films: string;
    deadline: string;
    is_open_to_debut: boolean;
    is_regional_welcome: boolean;
    rights_expectation: string;
    nda_required: boolean;
}

const GENRES = ['Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Mystery', 'Crime', 'Documentary', 'Biographical', 'Historical', 'Family', 'Animation', 'Anthology'];
const LANGUAGES = ['Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'English', 'Punjabi', 'Other'];

export const PitchCallCreationModal = ({ isOpen, onClose, onCreated, initialData, pitchCallId }: PitchCallCreationModalProps) => {
    const { createPitchCall, updatePitchCall, loading } = useCreatePitchCall();

    const [form, setForm] = useState<PitchCallForm>(initialData || {
        title: '',
        project_type: 'film',
        format: 'film',
        genre: [] as string[],
        subgenre: '',
        language: [] as string[],
        target_audience: '',
        budget_range: 'undisclosed',
        compensation: 'negotiable',
        requirement_description: '',
        tone: '',
        ref_films: '',
        deadline: '',
        is_open_to_debut: false,
        is_regional_welcome: false,
        rights_expectation: '',
        nda_required: false,
    });

    useEffect(() => {
        if (initialData) {
            setForm({
                ...initialData,
                genre: Array.isArray(initialData.genre) ? initialData.genre : [],
                language: Array.isArray(initialData.language) ? initialData.language : [],
                // Ensure other fields have safe defaults if missing
                subgenre: initialData.subgenre || '',
                target_audience: initialData.target_audience || '',
                tone: initialData.tone || '',
                ref_films: initialData.ref_films || '',
                rights_expectation: initialData.rights_expectation || '',
                deadline: initialData.deadline || ''
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let result;
        if (pitchCallId) {
            result = await updatePitchCall(pitchCallId, form);
        } else {
            result = await createPitchCall(form);
        }

        if (result) {
            onCreated?.();
            onClose();
            if (!pitchCallId) {
                setForm({
                    title: '', project_type: 'film', format: 'film', genre: [], subgenre: '', language: [],
                    target_audience: '', budget_range: 'undisclosed', compensation: 'negotiable',
                    requirement_description: '', tone: '', ref_films: '', deadline: '',
                    is_open_to_debut: false, is_regional_welcome: false, rights_expectation: '', nda_required: false,
                });
            }
        }
    };

    const addGenre = (g: string) => {
        if (g && !form.genre.includes(g)) setForm((f: PitchCallForm) => ({ ...f, genre: [...f.genre, g] }));
    };
    const addLanguage = (l: string) => {
        if (l && !form.language.includes(l)) setForm((f: PitchCallForm) => ({ ...f, language: [...f.language, l] }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        Post a Pitch Call
                    </DialogTitle>
                    <DialogDescription>
                        Define what kind of story or project you are looking for. Writers and creators will discover and pitch directly to you.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Pitch Call Title *</Label>
                        <Input
                            required
                            placeholder="e.g. Looking for psychological thrillers for OTT"
                            value={form.title}
                            onChange={e => setForm((f: PitchCallForm) => ({ ...f, title: e.target.value }))}
                        />
                    </div>

                    {/* Type + Format */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Project Type *</Label>
                            <Select value={form.project_type} onValueChange={(v: string) => setForm((f: PitchCallForm) => ({ ...f, project_type: v, format: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="film">Feature Film</SelectItem>
                                    <SelectItem value="series">Web / TV Series</SelectItem>
                                    <SelectItem value="short">Short Film</SelectItem>
                                    <SelectItem value="documentary">Documentary</SelectItem>
                                    <SelectItem value="youtube">YouTube / Digital</SelectItem>
                                    <SelectItem value="animation">Animation</SelectItem>
                                    <SelectItem value="branded">Branded / Ad Film</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Budget Range</Label>
                            <Select value={form.budget_range} onValueChange={(v: string) => setForm((f: PitchCallForm) => ({ ...f, budget_range: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="micro">Micro (&lt;10L)</SelectItem>
                                    <SelectItem value="low">Low (10L–50L)</SelectItem>
                                    <SelectItem value="mid">Mid (50L–5Cr)</SelectItem>
                                    <SelectItem value="high">High (5Cr–50Cr)</SelectItem>
                                    <SelectItem value="studio">Studio (50Cr+)</SelectItem>
                                    <SelectItem value="undisclosed">Undisclosed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Genre */}
                    <div className="space-y-2">
                        <Label>Genre (Select multiple)</Label>
                        <Select value="" onValueChange={(v) => addGenre(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Add genre..." />
                            </SelectTrigger>
                            <SelectContent>
                                {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.genre.map((g: string) => (
                                <span key={g} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-1 group">
                                    {g}
                                    <Trash2 
                                        className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" 
                                        onClick={() => setForm((f: PitchCallForm) => ({ ...f, genre: f.genre.filter((x: string) => x !== g) }))} 
                                    />
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                        <Label>Language (Select multiple)</Label>
                        <Select value="" onValueChange={(v) => addLanguage(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Add language..." />
                            </SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.language.map((l: string) => (
                                <span key={l} className="px-3 py-1 bg-secondary/50 rounded-full text-xs font-bold flex items-center gap-1 group">
                                    {l}
                                    <Trash2 
                                        className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" 
                                        onClick={() => setForm((f: PitchCallForm) => ({ ...f, language: f.language.filter((x: string) => x !== l) }))} 
                                    />
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Compensation + Deadline */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Compensation</Label>
                            <Select value={form.compensation} onValueChange={(v: string) => setForm((f: PitchCallForm) => ({ ...f, compensation: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                    <SelectItem value="development_deal">Development Deal</SelectItem>
                                    <SelectItem value="revenue_share">Revenue Share</SelectItem>
                                    <SelectItem value="negotiable">Negotiable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Submission Deadline</Label>
                            <Input
                                type="date"
                                value={form.deadline}
                                onChange={e => setForm((f: PitchCallForm) => ({ ...f, deadline: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Requirement Description */}
                    <div className="space-y-2">
                        <Label>Story Requirement *</Label>
                        <Textarea
                            required
                            rows={5}
                            placeholder="Describe what kind of story, script, or concept you're looking for. Be as specific as possible — tone, themes, format, what makes a pitch stand out to you..."
                            value={form.requirement_description}
                            onChange={e => setForm((f: PitchCallForm) => ({ ...f, requirement_description: e.target.value }))}
                        />
                    </div>

                    {/* Tone + References */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tone / Mood</Label>
                            <Input placeholder="e.g. Dark, grounded, gritty..." value={form.tone} onChange={e => setForm((f: PitchCallForm) => ({ ...f, tone: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Reference Films / Shows</Label>
                            <Input placeholder="e.g. Mirzapur, Sacred Games..." value={form.ref_films} onChange={e => setForm((f: PitchCallForm) => ({ ...f, ref_films: e.target.value }))} />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="p-4 bg-secondary/20 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold">Open to Debut Writers</p>
                                <p className="text-xs text-muted-foreground">Accept pitches from first-time writers</p>
                            </div>
                            <Switch checked={form.is_open_to_debut} onCheckedChange={(v: boolean) => setForm((f: PitchCallForm) => ({ ...f, is_open_to_debut: v }))} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold">Regional Stories Welcome</p>
                                <p className="text-xs text-muted-foreground">Open to regional language and cultural stories</p>
                            </div>
                            <Switch checked={form.is_regional_welcome} onCheckedChange={(v: boolean) => setForm((f: PitchCallForm) => ({ ...f, is_regional_welcome: v }))} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold">NDA Required</p>
                                <p className="text-xs text-muted-foreground">Require submitters to agree to an NDA</p>
                            </div>
                            <Switch checked={form.nda_required} onCheckedChange={(v: boolean) => setForm((f: PitchCallForm) => ({ ...f, nda_required: v }))} />
                        </div>
                    </div>

                    {/* Rights */}
                    <div className="space-y-2">
                        <Label>Rights Expectation</Label>
                        <Input placeholder="e.g. Full IP transfer, co-ownership, option agreement..." value={form.rights_expectation} onChange={e => setForm((f: PitchCallForm) => ({ ...f, rights_expectation: e.target.value }))} />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="px-8">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Publish Pitch Call
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
