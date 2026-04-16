
export const getDisplayMessage = (content: string) => {
    if (!content) return '';
    
    // Check for standard shared content format: TYPE_SHARE::JSON_DATA
    if (content.includes('_SHARE::')) {
        const type = content.split('_SHARE::')[0].toLowerCase();
        
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
    const lowerContent = content.toLowerCase();
    
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

    return content;
};

export const getNotificationIcon = (type: string) => {
    switch (type) {
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
        case 'generic': return '🔔';
        default: return '🔔';
    }
};
