export const APP_CONFIG = {
  APP_NAME: 'CineCraft Connect',
  APP_ID: 'com.cinecraftconnect.app',
  SCHEME: 'cinecraftconnect',
  WEB_DOMAIN: 'https://cinecraftconnect.com',
  DEFAULT_AVATAR: '',
} as const;

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatCallDuration = (startedAt: string | number, endedAt: string | number = Date.now()): string => {
  const start = typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt;
  const end = typeof endedAt === 'string' ? new Date(endedAt).getTime() : endedAt;
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  return formatDuration(diffSec);
};

export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

export const truncateString = (str: string, maxLength: number): string => {
  if (!str || str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
};

export const getInitials = (name?: string | null): string => {
  if (!name) return 'CC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export class Logger {
  private static prefix = '[CineCraft]';

  static info(...args: unknown[]): void {
    console.log(this.prefix, ...args);
  }

  static warn(...args: unknown[]): void {
    console.warn(this.prefix, ...args);
  }

  static error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }

  static debug(...args: unknown[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.prefix, ...args);
    }
  }
}

export * from './jobs';
export * from './help';
