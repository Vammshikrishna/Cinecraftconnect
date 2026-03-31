
export const getDisplayMessage = (content: string) => {
    if (!content) return '';
    if (content.includes('POST_SHARE::')) return 'Shared a post';
    if (content.includes('MARKETPLACE_SHARE::')) return 'Shared a marketplace listing';
    if (content.includes('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
    if (content.includes('VENDOR_SHARE::')) return 'Shared a vendor profile';
    if (content.includes('PROJECT_SHARE::')) return 'Shared a project';
    if (content.includes('DISCUSSION_SHARE::')) return 'Shared a discussion room';
    if (content.includes('JOB_SHARE::')) return 'Shared a job';
    return content;
};
