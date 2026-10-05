import { useState, useEffect } from 'react';

export interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    highlight: string;
}

export function useDominantColors(imageSrc: string | null) {
    const [palette, setPalette] = useState<ColorPalette | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!imageSrc) {
            setPalette(null);
            return;
        }

        setLoading(true);
        setError(null);

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error('Could not get canvas context');
                }

                // Sample image at low res to get dominant colors
                canvas.width = 30;
                canvas.height = 30;
                ctx.drawImage(img, 0, 0, 30, 30);
                
                const imageData = ctx.getImageData(0, 0, 30, 30).data;
                const colorCounts: { [color: string]: number } = {};

                // Step through pixels
                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];

                    if (a < 128) continue; // Skip transparent

                    // Reduce color space to avoid slight variations
                    const rd = Math.round(r / 16) * 16;
                    const gd = Math.round(g / 16) * 16;
                    const bd = Math.round(b / 16) * 16;
                    
                    const hex = `#${((1 << 24) + (rd << 16) + (gd << 8) + bd).toString(16).slice(1)}`;
                    colorCounts[hex] = (colorCounts[hex] || 0) + 1;
                }

                const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);

                if (sortedColors.length > 0) {
                    setPalette({
                        primary: sortedColors[0] || '#f97316',
                        secondary: sortedColors[1] || '#78716c',
                        accent: sortedColors[2] || '#ea580c',
                        background: sortedColors[3] || '#1c1917',
                        highlight: sortedColors[4] || '#fed7aa',
                    });
                } else {
                    setPalette({
                        primary: '#f97316',
                        secondary: '#78716c',
                        accent: '#ea580c',
                        background: '#1c1917',
                        highlight: '#fed7aa',
                    });
                }
                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to extract dominant colors');
                setLoading(false);
            }
        };

        img.onerror = () => {
            setError('Failed to load image for dominant color extraction');
            setLoading(false);
        };

        img.src = imageSrc;
    }, [imageSrc]);

    return { palette, loading, error };
}
