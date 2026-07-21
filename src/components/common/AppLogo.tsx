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
  /** Explicit text color variant for custom backgrounds */
  textColor?: 'foreground' | 'ink' | 'cream';
}

const sizeMap = {
  sm: { icon: 20, text: 'text-sm', gap: 'gap-1' },
  md: { icon: 28, text: 'text-base', gap: 'gap-1.5' },
  lg: { icon: 40, text: 'text-2xl', gap: 'gap-2' },
};

/**
 * CineCraft Connect branded logo component.
 * Uses the custom aperture/connect SVG icon with cinematic styling.
 */
const AppLogo = ({ showText = true, size = 'md', to = '/', className = '', textColor = 'foreground' }: AppLogoProps) => {
  const s = sizeMap[size];

  const LogoIcon = (
    <img
      src="/logo.png"
      alt="CineCraft Connect Logo"
      className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110 object-contain rounded-full shadow-sm"
      style={{ width: s.icon, height: s.icon }}
    />
  );

  const content = (
    <span className={`flex items-center ${s.gap} group ${className}`}>
      {LogoIcon}
      {showText && (
        <span className={`text-[13px] sm:text-base md:${s.text} font-serif font-bold uppercase tracking-tight whitespace-nowrap select-none flex items-center gap-0.5 sm:gap-1`}>
          <span className={textColor === 'ink' ? 'text-[#0D0D0D]' : textColor === 'cream' ? 'text-[#F8F5F0]' : 'text-foreground'}>CineCraft</span>
          <span className="text-primary">Connect</span>
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
