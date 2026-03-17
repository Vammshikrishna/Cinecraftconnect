
export const getDisplayMessage = (content: string) => {
    if (!content) return '';
    if (content.startsWith('POST_SHARE::')) return 'Shared a post';
    if (content.startsWith('MARKETPLACE_SHARE::')) return 'Shared a marketplace listing';
    if (content.startsWith('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
    if (content.startsWith('VENDOR_SHARE::')) return 'Shared a vendor profile';
    return content;
};
