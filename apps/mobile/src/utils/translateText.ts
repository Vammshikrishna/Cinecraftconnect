import { Text, TextInput } from 'react-native';
import { toLang, translatePhrase, type Lang } from '@cinecraft/core';

/**
 * Translates the words every screen already shows, in one place, instead of editing each screen.
 * Only text that exactly matches a phrase in the shared dictionary changes; names, posts and messages never do.
 */
let current: Lang = 'en';
export const setTextLanguage = (value: unknown) => {
  current = toLang(value);
};

const tr = (children: any): any => {
  if (current === 'en') return children;
  if (typeof children === 'string') return translatePhrase(current, children);
  if (Array.isArray(children)) {
    let changed = false;
    const next = children.map((c) => {
      if (typeof c !== 'string') return c;
      const t = translatePhrase(current, c);
      if (t !== c) changed = true;
      return t;
    });
    return changed ? next : children;
  }
  return children;
};

const patch = (Comp: any, flag: string, rewrite: (props: any) => any) => {
  if (!Comp || Comp[flag] || typeof Comp.render !== 'function') return;
  const original = Comp.render;
  Comp.render = function translatedRender(props: any, ref: any) {
    if (current !== 'en' && props) props = rewrite(props);
    return original.call(this, props, ref);
  };
  Comp[flag] = true;
};

export const installTextTranslation = () => {
  patch(Text, '__translatePatched', (props) => {
    const children = tr(props.children);
    return children === props.children ? props : { ...props, children };
  });
  patch(TextInput, '__translatePatched', (props) => {
    if (typeof props.placeholder !== 'string') return props;
    const placeholder = translatePhrase(current, props.placeholder);
    return placeholder === props.placeholder ? props : { ...props, placeholder };
  });
};
