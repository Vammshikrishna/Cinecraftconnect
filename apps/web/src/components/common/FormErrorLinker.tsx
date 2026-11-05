import { useEffect } from 'react';

/**
 * Links each field to the error message shown under it, for screen readers: the field gets aria-invalid and
 * aria-describedby, and the message is announced as an alert when it appears.
 *
 * Most forms here show their own error text under the input. This keeps that working for all of them without
 * changing each one: it looks for a short, red message after a field inside the field's own wrapper.
 * A field that already sets aria-invalid itself is left alone.
 */

const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select';
const ERROR_CLASS = /(^|\s)(text-destructive|text-red-[3-6]00|text-rose-[3-6]00)(\s|$)/;
const SIZE_CLASS = /(^|\s)(text-xs|text-sm|text-\[\d+px\])(\s|$)/;
const LINKED = 'data-err-linked';

let counter = 0;

const findError = (field: Element): HTMLElement | null => {
  let container: Element | null = field.parentElement;
  for (let depth = 0; depth < 2 && container; depth++, container = container.parentElement) {
    if (container.querySelectorAll(FIELD).length !== 1) return null;
    const candidates = container.querySelectorAll<HTMLElement>('p, span, div');
    for (const el of Array.from(candidates)) {
      if (!ERROR_CLASS.test(el.className?.toString() || '') || !SIZE_CLASS.test(el.className?.toString() || '')) continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 200) continue;
      if (el.querySelector(FIELD + ', button, a') || el.closest('label, button, a')) continue;
      if (!(field.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) continue;
      return el;
    }
  }
  return null;
};

const clear = (field: Element) => {
  const id = field.getAttribute(LINKED);
  field.removeAttribute(LINKED);
  field.removeAttribute('aria-invalid');
  if (id) {
    const rest = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== id).join(' ');
    if (rest) field.setAttribute('aria-describedby', rest);
    else field.removeAttribute('aria-describedby');
  }
};

const sync = () => {
  document.querySelectorAll(FIELD).forEach((field) => {
    const mine = field.hasAttribute(LINKED);
    if (!mine && field.hasAttribute('aria-invalid')) return; // the form handles it itself
    const err = findError(field);
    if (!err) {
      if (mine) clear(field);
      return;
    }
    if (!err.id) err.id = `field-error-${++counter}`;
    if (!err.getAttribute('role') && !err.hasAttribute('aria-live')) err.setAttribute('role', 'alert');
    if (mine && field.getAttribute(LINKED) !== err.id) clear(field);
    field.setAttribute('aria-invalid', 'true');
    const described = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!described.includes(err.id)) field.setAttribute('aria-describedby', [...described, err.id].join(' '));
    field.setAttribute(LINKED, err.id);
  });
};

export const FormErrorLinker = () => {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };
    schedule();
    // only content changes are watched (not attributes), so setting the links above cannot trigger another run
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
};

export default FormErrorLinker;
