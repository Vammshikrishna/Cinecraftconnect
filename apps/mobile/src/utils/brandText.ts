import { StyleSheet, Text } from 'react-native';

/**
 * The brand orange (#FF4B33) is 3.3:1 on white: fine for fills, icons and large text, but too faint for small text.
 * In the light theme, small orange text is drawn in a deeper orange-red (5.5:1) instead. Dark mode keeps the brand
 * orange, which reads well there (5.8:1). One rule here covers every screen, since each screen declares its own orange.
 */

let lightTheme = false;
export const setBrandTextLight = (isLight: boolean) => {
  lightTheme = isLight;
};

const BRAND_ORANGES = new Set(['#ff4b33', '#f97316']);
const DEEP_ORANGE = '#C4301B';

export const installBrandTextContrast = () => {
  const T = Text as any;
  if (T.__brandTextPatched || typeof T.render !== 'function') return;
  const original = T.render;
  T.render = function brandAwareRender(props: any, ref: any) {
    if (lightTheme && props && props.style) {
      const flat: any = StyleSheet.flatten(props.style);
      const color = flat && typeof flat.color === 'string' ? flat.color.toLowerCase() : null;
      if (color && BRAND_ORANGES.has(color)) {
        const size = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
        const weight = flat.fontWeight;
        const bold = weight === 'bold' || (typeof weight === 'string' && Number(weight) >= 700);
        const large = size >= 24 || (size >= 18.66 && bold); // large text only needs 3:1
        if (!large) props = { ...props, style: [props.style, { color: DEEP_ORANGE }] };
      }
    }
    return original.call(this, props, ref);
  };
  T.__brandTextPatched = true;
};
