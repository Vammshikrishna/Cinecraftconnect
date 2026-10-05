import { lazy, Suspense } from 'react';
import type { EmojiClickData, PickerProps, EmojiStyle as EmojiStyleType, Theme as ThemeType } from 'emoji-picker-react';

/**
 * emoji-picker-react is ~480 KB; it used to be bundled into the entry chunk. It is now loaded only
 * the first time a picker is actually opened. These constants mirror the library's enum values so
 * callers do not need a static import of the package.
 */
const Picker = lazy(() => import('emoji-picker-react'));

export const EmojiStyle = { APPLE: 'apple', GOOGLE: 'google', TWITTER: 'twitter', FACEBOOK: 'facebook', NATIVE: 'native' } as unknown as Record<'APPLE' | 'GOOGLE' | 'TWITTER' | 'FACEBOOK' | 'NATIVE', EmojiStyleType>;
export const Theme = { DARK: 'dark', LIGHT: 'light', AUTO: 'auto' } as unknown as Record<'DARK' | 'LIGHT' | 'AUTO', ThemeType>;
export type { EmojiClickData };

const LazyEmojiPicker = (props: PickerProps) => (
  <Suspense fallback={<div style={{ width: props.width ?? 350, height: props.height ?? 400 }} />}>
    <Picker {...props} />
  </Suspense>
);

export default LazyEmojiPicker;
