import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface WatermarkedContentProps {
    children: React.ReactNode;
    label?: string;
    className?: string;
}

/**
 * WatermarkedContent
 * Wraps protected pitch content (full synopsis, character notes, etc.) in a
 * CSS repeating diagonal watermark overlay. The watermark embeds the viewer's
 * name, the date, and "CONFIDENTIAL" to deter unauthorized sharing.
 *
 * Evidence value: If a screenshot of the protected content is leaked, the
 * watermark immediately identifies the producer who accessed it and when.
 */
export const WatermarkedContent = ({ children, label, className = '' }: WatermarkedContentProps) => {
    const { profile } = useAuth();
    const viewerName = (profile as any)?.full_name || 'Viewer';
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const watermarkText = label || `${viewerName} • ${today} • CONFIDENTIAL • CineCraft`;

    return (
        <div className={`relative select-none ${className}`}>
            {/* Diagonal repeating watermark overlay */}
            <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
                style={{ userSelect: 'none' }}
            >
                {/* Grid of rotated watermark text spans */}
                <div
                    style={{
                        position: 'absolute',
                        inset: '-40px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gridTemplateRows: 'repeat(6, 1fr)',
                        gap: 0,
                        transform: 'rotate(-30deg)',
                        transformOrigin: 'center center',
                    }}
                >
                    {Array.from({ length: 18 }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px',
                                whiteSpace: 'nowrap',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'rgba(249, 115, 22, 0.10)',
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        >
                            {watermarkText}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actual content, rendered below the overlay but fully readable */}
            <div className="relative z-0">
                {children}
            </div>
        </div>
    );
};

export default WatermarkedContent;
