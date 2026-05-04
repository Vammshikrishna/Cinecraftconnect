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
  sm: { icon: 24, text: 'text-base', gap: 'gap-1.5' },
  md: { icon: 32, text: 'text-xl', gap: 'gap-2.5' },
  lg: { icon: 48, text: 'text-3xl', gap: 'gap-3' },
};

/**
 * CineCraft Connect branded logo component.
 * Uses the custom aperture/connect SVG icon with cinematic styling.
 */
const AppLogo = ({ showText = true, size = 'md', to = '/', className = '' }: AppLogoProps) => {
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
        <span className={`text-base sm:text-lg md:${s.text} font-black tracking-tight whitespace-nowrap select-none flex items-center gap-1 sm:gap-1.5`}>
          <span className="text-foreground">CineCraft</span>
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
