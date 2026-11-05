import { useEffect } from 'react';
import { translatePhrase } from '@cinecraft/core';
import { useT } from '@/hooks/useT';

/**
 * Translates the words every page already shows (buttons, labels, placeholders) from one shared dictionary, instead of
 * editing each page. Only text that exactly matches a dictionary phrase changes; names, posts and messages never do.
 * Switching back to English restores the original text.
 */
const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = 'script,style,textarea,[contenteditable="true"],[data-no-translate],.notranslate';

type Rec = { orig: string; out: string };

const PageTranslator = () => {
  const { lang } = useT();

  useEffect(() => {
    if (lang === 'en') return;
    const texts = new WeakMap<Node, Rec>();
    const attrs = new WeakMap<Element, Record<string, Rec>>();

    const doText = (n: Text) => {
      const parent = n.parentElement;
      if (!parent || parent.closest(SKIP)) return;
      const rec = texts.get(n);
      const value = n.nodeValue || '';
      if (rec && value === rec.out) return;
      const out = translatePhrase(lang, value);
      if (out !== value) {
        texts.set(n, { orig: value, out });
        n.nodeValue = out;
      } else if (rec) texts.delete(n);
    };

    const doAttrs = (el: Element) => {
      if (el.closest(SKIP)) return;
      for (const a of ATTRS) {
        const value = el.getAttribute(a);
        if (!value) continue;
        const rec = attrs.get(el)?.[a];
        if (rec && value === rec.out) continue;
        const out = translatePhrase(lang, value);
        if (out !== value) {
          const map = attrs.get(el) || {};
          map[a] = { orig: value, out };
          attrs.set(el, map);
          el.setAttribute(a, out);
        }
      }
    };

    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        doText(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      doAttrs(root as Element);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n = w.nextNode();
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
        else doAttrs(n as Element);
        n = w.nextNode();
      }
    };

    const restore = () => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n: Node | null = w.nextNode();
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) {
          const rec = texts.get(n);
          if (rec && n.nodeValue === rec.out) n.nodeValue = rec.orig;
        } else {
          const el = n as Element;
          const map = attrs.get(el);
          if (map) for (const a of Object.keys(map)) if (el.getAttribute(a) === map[a].out) el.setAttribute(a, map[a].orig);
        }
        n = w.nextNode();
      }
    };

    walk(document.body);

    let queued = false;
    const pending = new Set<Node>();
    const flush = () => {
      queued = false;
      const items = [...pending];
      pending.clear();
      items.forEach((n) => {
        if (n.isConnected) walk(n);
      });
    };
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach((n) => pending.add(n));
        else pending.add(r.target);
      }
      if (!queued) {
        queued = true;
        requestAnimationFrame(flush);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

    return () => {
      obs.disconnect();
      restore();
    };
  }, [lang]);

  return null;
};

export default PageTranslator;
