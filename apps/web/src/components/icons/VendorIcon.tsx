import { LucideProps } from 'lucide-react';
import { forwardRef } from 'react';

/**
 * Refined Vendor Icon (Storefront + Person)
 * Now fully respects the 'color' prop for a monochromatic look that matches system icons.
 */
const VendorIcon = forwardRef<SVGSVGElement, LucideProps>(
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
        {/* Storefront Main Body */}
        <path
          d="M15 42 V80 C15 88, 20 93, 28 93 H65"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Right side segment */}
        <path
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          d="M85 42 V55"
        />

        {/* Awning */}
        <path
          d="M10 25 H90 V38 C90 44, 85 48, 80 48 C75 48, 70 44, 70 38 C70 44, 65 48, 60 48 C55 48, 50 44, 50 38 C50 44, 45 48, 40 48 C35 48, 30 44, 30 38 V45 C30 45, 10 45, 10 38 Z"
          stroke={color}
          strokeWidth="7"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Person Icon in bottom right */}
        <g transform="translate(75, 78)">
          <circle 
            cx="0" 
            cy="-18" 
            r="12" 
            stroke={color} 
            strokeWidth="7" 
            fill="var(--background)" 
          />
          <path 
            d="M-20 12 C-20 -2, 20 -2, 20 12" 
            stroke={color} 
            strokeWidth="7" 
            strokeLinecap="round" 
            fill="var(--background)"
          />
        </g>
      </svg>
    );
  }
);

VendorIcon.displayName = 'VendorIcon';

export default VendorIcon;
