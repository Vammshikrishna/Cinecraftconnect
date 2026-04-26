import { Link } from 'react-router-dom';

interface AppLogoProps {
  /** Show the full text alongside the icon */
  showText?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className for the container */
  className?: string;
  /** Link destination */
  to?: string;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-sm', gap: 'gap-1.5' },
  md: { icon: 32, text: 'text-lg', gap: 'gap-2' },
  lg: { icon: 44, text: 'text-2xl', gap: 'gap-3' },
};

/**
 * CineCraft Connect branded logo component.
 * Uses the custom aperture/connect SVG icon with cinematic styling.
 */
const AppLogo = ({ showText = true, size = 'md', to = '/', className = '' }: AppLogoProps) => {
  const s = sizeMap[size];

  const LogoIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={s.icon}
      height={s.icon}
      className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[15deg]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(7, 100%, 60%)" />
          <stop offset="50%" stopColor="hsl(16, 100%, 66%)" />
          <stop offset="100%" stopColor="hsl(30, 100%, 64%)" />
        </linearGradient>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(0, 0%, 6%)" />
          <stop offset="100%" stopColor="hsl(0, 0%, 10%)" />
        </linearGradient>
        <radialGradient id="logoGlow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="hsl(7, 100%, 60%)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id="playGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="64" height="64" rx="14" fill="url(#logoBg)" />
      <rect width="64" height="64" rx="14" fill="url(#logoGlow)" />
      <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.35" />

      {/* Aperture + connect icon */}
      <g transform="translate(32, 30)">
        {/* Outer lens ring */}
        <circle cx="0" cy="0" r="17" fill="none" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.4" />

        {/* Aperture blades */}
        <path d="M0,-13 L7.5,-6.5 L3,-1.5 Z" fill="url(#logoGrad)" opacity="0.7" />
        <path d="M7.5,-6.5 L11,3.5 L4.5,2 Z" fill="url(#logoGrad)" opacity="0.55" />
        <path d="M11,3.5 L3.5,11 L1.5,4.5 Z" fill="url(#logoGrad)" opacity="0.7" />
        <path d="M3.5,11 L-7.5,6.5 L-3,1.5 Z" fill="url(#logoGrad)" opacity="0.55" />
        <path d="M-7.5,6.5 L-11,-3.5 L-4.5,-2 Z" fill="url(#logoGrad)" opacity="0.7" />
        <path d="M-11,-3.5 L-3.5,-11 L-1.5,-4.5 Z" fill="url(#logoGrad)" opacity="0.55" />

        {/* Inner hexagonal opening */}
        <polygon
          points="0,-5 4.3,-2.5 4.3,2.5 0,5 -4.3,2.5 -4.3,-2.5"
          fill="hsl(0, 0%, 6%)"
          stroke="url(#logoGrad)"
          strokeWidth="0.6"
        />

        {/* Play triangle */}
        <polygon points="-1.8,-3 -1.8,3 3.5,0" fill="url(#logoGrad)" filter="url(#playGlow)" />

        {/* Connection nodes */}
        <circle cx="0" cy="-14.5" r="1.8" fill="url(#logoGrad)" opacity="0.9" />
        <circle cx="12.6" cy="7.25" r="1.8" fill="url(#logoGrad)" opacity="0.9" />
        <circle cx="-12.6" cy="7.25" r="1.8" fill="url(#logoGrad)" opacity="0.9" />
        <circle cx="12.6" cy="-7.25" r="1.8" fill="url(#logoGrad)" opacity="0.9" />
        <circle cx="-12.6" cy="-7.25" r="1.8" fill="url(#logoGrad)" opacity="0.9" />
        <circle cx="0" cy="14.5" r="1.8" fill="url(#logoGrad)" opacity="0.9" />

        {/* Connection lines */}
        <line x1="0" y1="-14.5" x2="12.6" y2="-7.25" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
        <line x1="12.6" y1="-7.25" x2="12.6" y2="7.25" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
        <line x1="12.6" y1="7.25" x2="0" y2="14.5" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
        <line x1="0" y1="14.5" x2="-12.6" y2="7.25" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
        <line x1="-12.6" y1="7.25" x2="-12.6" y2="-7.25" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
        <line x1="-12.6" y1="-7.25" x2="0" y2="-14.5" stroke="url(#logoGrad)" strokeWidth="0.6" opacity="0.25" />
      </g>
    </svg>
  );

  const content = (
    <span className={`flex items-center ${s.gap} group ${className}`}>
      {LogoIcon}
      {showText && (
        <span className={`${s.text} font-bold text-gradient whitespace-nowrap select-none`}>
          <span className="hidden xl:inline">CineCraft Connect</span>
          <span className="xl:hidden">CCC</span>
        </span>
      )}
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="flex items-center flex-shrink-0 min-w-0" aria-label="CineCraft Connect Home">
        {content}
      </Link>
    );
  }

  return content;
};

export default AppLogo;
