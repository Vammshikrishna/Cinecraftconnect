import React from 'react';

export const CornerBrackets = ({ className = "" }: { className?: string }) => (
    <>
        <div className={`absolute top-2 left-2 w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80 ${className}`} />
        <div className={`absolute top-2 right-2 w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80 ${className}`} />
        <div className={`absolute bottom-2 left-2 w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80 ${className}`} />
        <div className={`absolute bottom-2 right-2 w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80 ${className}`} />
    </>
);
