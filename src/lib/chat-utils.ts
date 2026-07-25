export const generateDirectRoomId = (userId1: string, userId2: string): string => {
    const [id1, id2] = [userId1, userId2].sort();
    if (id1?.length === 36 && id2?.length === 36) {
        return id1.slice(0, 18) + id2.slice(18);
    }
    return `${id1}-${id2}`.slice(0, 36);
};

export const getDisplayMessage = (content: string) => {
    if (!content) return '';
    
    let cleanText = content;
    if (cleanText.startsWith('FORWARDED::')) {
        cleanText = cleanText.replace('FORWARDED::', '');
    }
    
    // Pending decryption state
    if (cleanText === '__PENDING_DECRYPT__') return '🔑 Decrypting...';
    
    // Check for E2EE payload structure
    if (cleanText.includes('__e2ee') || cleanText.includes('__e2ee_group')) {
        return '🔒 Encrypted Message';
    }
    
    // Check for standard shared content format: TYPE_SHARE::JSON_DATA
    if (cleanText.includes('_SHARE::')) {
        const type = cleanText.split('_SHARE::')[0].toLowerCase();
        
        // Custom labels for types that need more than just direct mapping
        const labels: Record<string, string> = {
            'post': 'Shared a post',
            'marketplace': 'Shared a marketplace listing',
            'announcement': 'Shared an announcement',
            'vendor': 'Shared a vendor profile',
            'project': 'Shared a project',
            'discussion': 'Shared a discussion room',
            'job': 'Shared a job',
            'craft': 'Shared a craft',
            'profile': 'Shared a profile'
        };

        return labels[type] || `Shared a ${type}`;
    }

    // Check for direct image/video links or markdown images
    const lowerContent = cleanText.toLowerCase();
    
    // Markdown image: ![alt](url)
    if (lowerContent.startsWith('![') && lowerContent.includes('](')) {
        return '📷 Photo';
    }

    // File extensions
    if (lowerContent.match(/\.(jpg|jpeg|png|gif|webp|svg|heic)(\?.*)?$/)) {
        return '📷 Photo';
    }
    
    if (lowerContent.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/)) {
        return '🎥 Video';
    }

    return cleanText;
};

export const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'new_message':
        case 'message':
            return '💬';
        case 'like': return '❤️';
        case 'comment': return '💬';
        case 'new_follower': return '👤';
        case 'job_application': return '💼';
        case 'job_alert': return '🎯';
        case 'project_application': return '🚀';
        case 'project_invite': return '✉️';
        case 'mention': return '@';
        case 'system_announcement': return '📢';
        case 'network_suggestion': return '🤝';
        case 'new_post': return '🎬';
        // Pitch status notifications
        case 'pitch_status_request_full_deck': return '📄';
        case 'pitch_status_shortlisted': return '⭐';
        case 'pitch_status_interested': return '🎉';
        case 'pitch_status_invite_to_discuss': return '💬';
        case 'pitch_status_passed': return '👍';
        case 'generic': return '🔔';
        default: return '🔔';
    }
};
