import { LucideProps } from 'lucide-react';
import { forwardRef } from 'react';

/**
 * Custom Studio Page Icon for Company/Studio Pages.
 * Represents a professional production studio or agency building.
 * Fully respects the 'color' prop to ensure consistency with standard UI icons.
 */
const StudioPageIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className = '', color = 'currentColor', ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        {/* Foundation/Main Building Structure */}
        <path
          d="M15 85 H85 V30 C85 24, 80 20, 74 20 H50"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left tall tower section */}
        <path
          d="M15 85 V25 C15 19, 20 15, 26 15 H50 V85"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Windows - Left Tower */}
        <line x1="28" y1="30" x2="38" y2="30" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.4" />
        <line x1="28" y1="45" x2="38" y2="45" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.4" />
        <line x1="28" y1="60" x2="38" y2="60" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.4" />

        {/* Windows - Main Building */}
        <line x1="62" y1="35" x2="72" y2="35" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.4" />
        <line x1="62" y1="50" x2="72" y2="50" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.4" />

        {/* Entrance Gate */}
        <path
          d="M42 85 V70 C42 66, 45 62, 50 62 C55 62, 58 66, 58 70 V85"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Studio Antenna/Detail */}
        <path
          d="M26 15 V8"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="26" cy="5" r="3" fill={color} />
      </svg>
    );
  }
);

StudioPageIcon.displayName = 'StudioPageIcon';

export default StudioPageIcon;
