export interface StudioDraft {
    layers: any[];
    canvasConfig: {
        width: number;
        height: number;
        backgroundColor: string;
        gradientName?: string;
        fontFamily?: string;
        aspectRatio: '1:1' | '4:5' | '16:9' | '9:16';
    };
    timestamp: number;
}

const DRAFT_KEY = 'cinecraft_studio_draft_v1';

export const draftManager = {
    saveDraft(layers: any[], canvasConfig: any) {
        try {
            const draft: StudioDraft = {
                layers,
                canvasConfig,
                timestamp: Date.now()
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (e) {
            console.error('Error saving studio draft:', e);
        }
    },

    getDraft(): StudioDraft | null {
        try {
            const item = localStorage.getItem(DRAFT_KEY);
            if (!item) return null;
            return JSON.parse(item) as StudioDraft;
        } catch (e) {
            console.error('Error loading studio draft:', e);
            return null;
        }
    },

    clearDraft() {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (e) {
            console.error('Error clearing studio draft:', e);
        }
    }
};
