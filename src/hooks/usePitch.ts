import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PitchCall {
    id: string;
    created_at: any;
    updated_at: any;
    creator_id: string;
    title: string;
    project_type: string;
    genre: string[] | null;
    subgenre: string | null;
    language: string[] | null;
    format: string | null;
    target_audience: string | null;
    budget_range: string | null;
    compensation: string | null;
    requirement_description: string;
    tone: string | null;
    ref_films: string | null;
    deadline: string | null;
    is_open_to_debut: boolean | null;
    is_regional_welcome: boolean | null;
    rights_expectation: string | null;
    nda_required: boolean | null;
    status: string | null;
    is_published: boolean | null;
    view_count: number | null;
    attachments: any | null;
    is_saved?: boolean;
    submission_count?: number;
    profiles?: {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
        craft: string | null;
        location: string | null;
        is_verified: boolean | null;
    };
}

export interface PitchSubmission {
    id: string;
    created_at: any;
    submitted_at: any;
    pitch_call_id: string;
    submitter_id: string;
    title: string;
    logline: string;
    short_synopsis: string;
    full_synopsis: string | null;
    genre: string | null;
    format: string | null;
    language: string | null;
    tone: string | null;
    why_fits: string | null;
    rights_owned: boolean | null;
    is_original_work: boolean | null;
    treatment_url: string | null;
    lookbook_url: string | null;
    moodboard_url: string | null;
    character_notes: string | null;
    pilot_outline: string | null;
    reference_links: string[] | null;
    status: string | null;
    nda_preferred: boolean | null;
    seen_at: string | null;
    reviewed_at: string | null;
    shortlisted_at: string | null;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
        username: string | null;
        craft: string | null;
        is_verified: boolean | null;
    };
    pitch_calls?: {
        title: string | null;
        project_type: string | null;
    };
}

interface FilterState {
    genre: string;
    language: string;
    format: string;
    budgetRange: string;
    compensation: string;
    openToDebut: boolean;
    regionalWelcome: boolean;
}

// ─── PITCH CALLS HOOK ───────────────────────────────────────────────────────
export const usePitchCalls = (filters?: Partial<FilterState>, searchQuery?: string) => {
    const { user } = useAuth();
    const [pitchCalls, setPitchCalls] = useState<PitchCall[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchPitchCalls = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('pitch_calls')
                .select(`
                    *,
                    profiles:creator_id (
                        full_name,
                        avatar_url,
                        username,
                        craft,
                        location,
                        is_verified
                    )
                `)
                .eq('status', 'open')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (filters?.genre) query = query.contains('genre', [filters.genre]);
            if (filters?.language) query = query.contains('language', [filters.language]);
            if (filters?.format) query = query.eq('format', filters.format);
            if (filters?.budgetRange) query = query.eq('budget_range', filters.budgetRange);
            if (filters?.compensation) query = query.eq('compensation', filters.compensation);
            if (filters?.openToDebut) query = query.eq('is_open_to_debut', true);
            if (filters?.regionalWelcome) query = query.eq('is_regional_welcome', true);

            if (searchQuery?.trim()) {
                query = query.or(
                    `title.ilike.%${searchQuery}%,requirement_description.ilike.%${searchQuery}%`
                );
            }

            const { data, error } = await query;
            if (error) throw error;

            // Enrich with save status and submission count
            let savedIds = new Set<string>();
            if (user) {
                const { data: saved } = await supabase
                    .from('saved_pitch_calls')
                    .select('pitch_call_id')
                    .eq('user_id', user.id);
                savedIds = new Set((saved || []).map((s: any) => s.pitch_call_id));
            }

            setPitchCalls((data || []).map(pc => ({
                ...pc,
                is_saved: savedIds.has(pc.id),
            })));
        } catch (error: any) {
            console.error('Error fetching pitch calls:', error);
            toast({ title: 'Error', description: 'Failed to load pitch calls.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user?.id, JSON.stringify(filters), searchQuery]);

    useEffect(() => {
        fetchPitchCalls();
    }, [fetchPitchCalls]);

    // ── Real-time: refresh list when any pitch call changes ──
    useEffect(() => {
        const channel = supabase
            .channel('pitch_calls_rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_calls' }, () => {
                fetchPitchCalls();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchPitchCalls]);

    const toggleSave = async (pitchCallId: string, isSaved: boolean) => {
        if (!user) return;
        if (isSaved) {
            await supabase.from('saved_pitch_calls').delete()
                .eq('user_id', user.id).eq('pitch_call_id', pitchCallId);
        } else {
            await supabase.from('saved_pitch_calls').insert({ user_id: user.id, pitch_call_id: pitchCallId });
        }
        setPitchCalls(prev => prev.map(pc =>
            pc.id === pitchCallId ? { ...pc, is_saved: !isSaved } : pc
        ));
    };

    return { pitchCalls, loading, refetch: fetchPitchCalls, toggleSave };
};

// ─── MY SUBMISSIONS HOOK ────────────────────────────────────────────────────
export const useMyPitchSubmissions = () => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState<PitchSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubmissions = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        const { data } = await supabase
            .from('pitch_submissions')
            .select(`*, pitch_calls:pitch_call_id(title, project_type)`)
            .eq('submitter_id', user.id)
            .order('created_at', { ascending: false });
        setSubmissions(data || []);
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    // ── Real-time: update status badge instantly when Call Creator reviews ──
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`my_submissions_rt_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pitch_submissions', filter: `submitter_id=eq.${user.id}` },
                (payload) => {
                    setSubmissions(prev => prev.map(s =>
                        s.id === (payload.new as any).id ? { ...s, ...(payload.new as Partial<PitchSubmission>) } : s
                    ));
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    return { submissions, loading, refetch: fetchSubmissions };
};

// ─── CALL CREATOR REVIEW HOOK ───────────────────────────────────────────────
export const useCallCreatorSubmissions = (pitchCallId?: string) => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState<PitchSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchSubmissions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            let query = supabase
                .from('pitch_submissions')
                .select(`
                    *,
                    profiles:submitter_id(full_name, avatar_url, username, craft, is_verified),
                    pitch_calls:pitch_call_id(title, project_type)
                `)
                .in(
                    'pitch_call_id',
                    pitchCallId
                        ? [pitchCallId]
                        : (await supabase
                            .from('pitch_calls')
                            .select('id')
                            .eq('creator_id', user.id)
                            .then(r => (r.data || []).map((pc: any) => pc.id)))
                )
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setSubmissions(data as any || []);
        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, pitchCallId]);

    useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

    // ── Real-time: new submissions appear instantly, status updates reflect immediately ──
    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`call_creator_submissions_rt_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'pitch_submissions' },
                () => fetchSubmissions()           // new pitch came in → reload full list
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pitch_submissions' },
                (payload) => {
                    // Optimistic update: patch just the changed row without a full reload
                    setSubmissions(prev => prev.map(s =>
                        s.id === (payload.new as any).id ? { ...s, ...(payload.new as Partial<PitchSubmission>) } : s
                    ));
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id, fetchSubmissions]);

    const updateStatus = async (submissionId: string, status: string) => {
        try {
            const updates: Record<string, any> = { status };
            if (status === 'seen') updates.seen_at = new Date().toISOString();
            if (status === 'under_review') updates.reviewed_at = new Date().toISOString();
            if (status === 'shortlisted') updates.shortlisted_at = new Date().toISOString();
            if (status === 'passed') updates.passed_at = new Date().toISOString();

            const { error } = await supabase
                .from('pitch_submissions')
                .update(updates)
                .eq('id', submissionId);
            if (error) throw error;

            setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, ...updates } : s));
            toast({ title: 'Status updated', description: `Pitch marked as ${status.replace(/_/g, ' ')}.` });

            // Log access
            await supabase.from('pitch_access_logs').insert({
                pitch_submission_id: submissionId,
                accessed_by: user!.id,
                action: 'viewed'
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
        }
    };

    return { submissions, loading, refetch: fetchSubmissions, updateStatus };
};

// ─── CREATE PITCH CALL HOOK ─────────────────────────────────────────────────
export const useCreatePitchCall = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const createPitchCall = async (data: Partial<PitchCall>) => {
        if (!user) return null;
        setLoading(true);
        try {
            const { data: created, error } = await supabase
                .from('pitch_calls')
                .insert({ ...data, creator_id: user.id } as any)
                .select()
                .single();
            if (error) throw error;
            toast({ title: 'Pitch Call Published!', description: 'Your pitch call is now live.' });
            return created;
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to create pitch call.', variant: 'destructive' });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const updatePitchCall = async (id: string, data: Partial<PitchCall>) => {
        if (!user) return null;
        setLoading(true);
        try {
            // Sanitize data to only include writable fields
            const { 
                id: _id, 
                created_at: _ca, 
                updated_at: _ua, 
                creator_id: _cid, 
                profiles: _p, 
                is_saved: _is, 
                submission_count: _sc,
                view_count: _vc,
                ...writableData 
            } = data;

            const { data: updated, error } = await supabase
                .from('pitch_calls')
                .update(writableData)
                .eq('id', id)
                .eq('creator_id', user.id)
                .select()
                .single();
            if (error) throw error;
            toast({ title: 'Pitch Call Updated!', description: 'Your changes have been saved.' });
            return updated;
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update pitch call.', variant: 'destructive' });
            return null;
        } finally {
            setLoading(false);
        }
    };

    return { createPitchCall, updatePitchCall, loading };
};

// ─── SUBMIT PITCH HOOK ──────────────────────────────────────────────────────
export const useSubmitPitch = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const submitPitch = async (data: Partial<PitchSubmission>) => {
        if (!user) return null;
        setLoading(true);
        try {
            const { data: created, error } = await supabase
                .from('pitch_submissions')
                .insert({ ...data, submitter_id: user.id, submitted_at: new Date().toISOString() } as any)
                .select()
                .single();
            if (error) throw error;
            toast({ title: 'Pitch Submitted!', description: 'Your pitch has been securely submitted. Good luck!' });
            return created;
        } catch (error: any) {
            if (error.code === '23505') {
                toast({ title: 'Already submitted', description: 'You have already submitted a pitch to this call.', variant: 'destructive' });
            } else {
                toast({ title: 'Error', description: error.message || 'Failed to submit pitch.', variant: 'destructive' });
            }
            return null;
        } finally {
            setLoading(false);
        }
    };

    return { submitPitch, loading };
};

// Constants
export const PITCH_ROLE_CAN_CREATE = ['producer', 'studio', 'production house', 'executive producer', 'creative head', 'showrunner'];
export const PITCH_ROLE_CAN_SUBMIT = ['writer', 'screenwriter', 'director', 'creator', 'story developer', 'filmmaker'];

export const canCreatePitchCall = (_craft?: string, accountType?: string): boolean => {
    // Only Creator Pro (handled as 'creator' in DB) and Studio accounts can create pitch calls.
    return accountType === 'studio' || accountType === 'creator';
};

export const canSubmitPitch = (craft?: string, accountType?: string): boolean => {
    if (accountType === 'creator') return true;
    if (!craft) return false;
    return PITCH_ROLE_CAN_SUBMIT.some(r => craft.toLowerCase().includes(r.toLowerCase()));
};

export const PITCH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    submitted: { label: 'Submitted', color: 'text-blue-500 bg-blue-500/10' },
    seen: { label: 'Seen', color: 'text-purple-500 bg-purple-500/10' },
    under_review: { label: 'Under Review', color: 'text-amber-500 bg-amber-500/10' },
    shortlisted: { label: 'Shortlisted', color: 'text-green-500 bg-green-500/10' },
    interested: { label: 'Interested', color: 'text-emerald-500 bg-emerald-500/10' },
    request_full_deck: { label: 'Full Deck Requested', color: 'text-primary bg-primary/10' },
    invite_to_discuss: { label: 'Invited to Discuss', color: 'text-primary bg-primary/10' },
    passed: { label: 'Passed', color: 'text-muted-foreground bg-muted' },
    closed: { label: 'Closed', color: 'text-muted-foreground bg-muted' },
    collaborating: { label: 'Collaborating', color: 'text-green-500 bg-green-500/10' },
};
