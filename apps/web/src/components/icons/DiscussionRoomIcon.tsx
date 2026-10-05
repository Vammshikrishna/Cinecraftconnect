import { LucideProps } from 'lucide-react';
import { forwardRef } from 'react';

/**
 * Redesigned Discussion Room Icon (Solid Style)
 * Fixed geometry to ensure it matches the user's provided artwork precisely.
 * Avoids nested transforms for better rendering consistency.
 */
const DiscussionRoomIcon = forwardRef<SVGSVGElement, LucideProps>(
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
        {/* Right Background Speech Bubble */}
        <path
          d="M45 28 C45 18, 56 10, 70 10 C84 10, 95 18, 95 28 C95 38, 84 46, 70 46 L70 54 L62 46 C52 46, 45 38, 45 28 Z"
          fill={color}
          opacity="0.8"
        />

        {/* Left Foreground Speech Bubble */}
        <path
          d="M5 32 C5 21, 16 12, 30 12 C44 12, 55 21, 55 32 C55 43, 44 52, 30 52 L30 62 L20 52 C10 52, 5 43, 5 32 Z"
          fill={color}
          stroke="var(--background, white)"
          strokeWidth="3"
        />

        {/* Speech Bubble Lines (White decorative lines) */}
        <path d="M15 28 H45 M15 36 H45 M15 44 H30" stroke="var(--background, white)" strokeWidth="3" strokeLinecap="round" />

        {/* Group of People silhouettes */}
        {/* Background Left Person */}
        <circle cx="25" cy="72" r="8" fill={color} opacity="0.7" />
        <path d="M5 100 C5 85, 45 85, 45 100" fill={color} opacity="0.7" />

        {/* Background Right Person */}
        <circle cx="75" cy="72" r="8" fill={color} opacity="0.7" />
        <path d="M55 100 C55 85, 95 85, 95 100" fill={color} opacity="0.7" />

        {/* Center Foreground Person */}
        <circle 
            cx="50" 
            cy="68" 
            r="11" 
            fill={color} 
            stroke="var(--background, white)" 
            strokeWidth="3" 
        />
        <path 
            d="M20 100 C20 80, 80 80, 80 100" 
            fill={color} 
            stroke="var(--background, white)" 
            strokeWidth="3" 
        />
      </svg>
    );
  }
);

DiscussionRoomIcon.displayName = 'DiscussionRoomIcon';

export default DiscussionRoomIcon;
