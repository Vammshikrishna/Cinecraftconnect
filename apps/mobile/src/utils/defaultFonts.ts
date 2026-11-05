import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * Same type system as the web app: Work Sans for body text, labels and buttons, Lora for titles (the web's "font-serif").
 *
 * React only applies a default font to a <Text> that has NO style at all, and almost every <Text> has one, so the default
 * never reached them and the phone drew them in the system font (Roboto). This puts the rule where every <Text> passes:
 *   - no font family (or a system one)      -> Work Sans, in the weight the style asks for
 *   - the generic "serif" / "Georgia"       -> Lora, in the weight the style asks for
 * Text that names a real font (Work Sans, Lora, Inconsolata) is left exactly as it is.
 */

const SANS: Record<string, string> = {
  '100': 'WorkSans-Regular', '200': 'WorkSans-Regular', '300': 'WorkSans-Regular', '400': 'WorkSans-Regular', normal: 'WorkSans-Regular',
  '500': 'WorkSans-Medium',
  '600': 'WorkSans-SemiBold',
  '700': 'WorkSans-Bold', bold: 'WorkSans-Bold',
  '800': 'WorkSans-ExtraBold', '900': 'WorkSans-ExtraBold',
};

const SERIF: Record<string, string> = {
  '100': 'Lora-Regular', '200': 'Lora-Regular', '300': 'Lora-Regular', '400': 'Lora-Regular', normal: 'Lora-Regular',
  '500': 'Lora-Medium',
  '600': 'Lora-SemiBold',
  '700': 'Lora-Bold', bold: 'Lora-Bold',
  '800': 'Lora-Bold', '900': 'Lora-Bold',
};

const SYSTEM_FAMILIES = new Set(['system', 'system font', 'sans-serif', 'sans-serif-medium', 'roboto', 'helvetica', 'helvetica neue', 'arial', 'san francisco']);
const SERIF_FAMILIES = new Set(['serif', 'georgia', 'times', 'times new roman']);

/**
 * The in-app Font Size setting (Settings > Appearance): 0.9 / 1 / 1.15. It scales every number font size that passes through
 * the text layer, together with an explicit lineHeight so lines do not collide. The OS font scale (capped at 1.5 in App.tsx)
 * still applies on top. Screens re-render with the setting (they read it through the settings context), so it takes effect at once.
 */
let fontScale = 1;
export const setFontScale = (scale: number) => {
  fontScale = scale > 0 ? scale : 1;
};

/** Wraps a component's render so text without a real font gets Work Sans (or Lora for the generic serif). */
const patchRender = (Component: any, flag: string) => {
  if (!Component || Component[flag] || typeof Component.render !== 'function') return;
  const original = Component.render;
  Component.render = function fontAwareRender(props: any, ref: any) {
    const flat: any = props && props.style ? StyleSheet.flatten(props.style) : null;
    const family: string | undefined = flat && typeof flat.fontFamily === 'string' ? flat.fontFamily : undefined;
    const lower = family ? family.toLowerCase() : undefined;
    let chosen: string | undefined;
    if (!family || (lower && SYSTEM_FAMILIES.has(lower))) {
      chosen = SANS[String(flat?.fontWeight ?? '400')] || 'WorkSans-Regular';
    } else if (lower && SERIF_FAMILIES.has(lower)) {
      chosen = SERIF[String(flat?.fontWeight ?? '400')] || 'Lora-Regular';
    }
    if (chosen || (fontScale !== 1 && flat && typeof flat.fontSize === 'number')) {
      const extra: any = {};
      // the file already is the right weight: do not let Android thicken it again
      if (chosen) { extra.fontFamily = chosen; extra.fontWeight = 'normal'; }
      if (fontScale !== 1 && flat && typeof flat.fontSize === 'number') {
        extra.fontSize = Math.round(flat.fontSize * fontScale * 10) / 10;
        if (typeof flat.lineHeight === 'number') extra.lineHeight = Math.round(flat.lineHeight * fontScale * 10) / 10;
      }
      props = { ...props, style: [props?.style, extra] };
    }
    return original.call(this, props, ref);
  };
  Component[flag] = true;
};

export const installDefaultFonts = () => {
  patchRender(Text, '__defaultFontsPatched');
  // typed text and placeholders in inputs (message boxes, search fields) follow the same rule
  patchRender(TextInput, '__defaultFontsPatched');
};
