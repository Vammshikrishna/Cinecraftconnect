
export const getGradientForString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const c1 = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const c2 = ((hash * 123) & 0x00FFFFFF).toString(16).toUpperCase();

    const color1 = '#' + '00000'.substring(0, 6 - c1.length) + c1;
    const color2 = '#' + '00000'.substring(0, 6 - c2.length) + c2;

    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
};
