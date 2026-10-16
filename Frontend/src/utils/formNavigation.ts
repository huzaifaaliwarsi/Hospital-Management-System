import React from 'react';

/**
 * Moves focus from `current` to the next focusable field (input/select/textarea)
 * within `container`, in DOM order.
 */
export function focusNextField(current: HTMLElement, container?: HTMLElement | null) {
  const root: ParentNode = container || document;
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'
    )
  ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);

  const idx = focusable.indexOf(current);
  if (idx > -1 && idx < focusable.length - 1) {
    const next = focusable[idx + 1];
    next.focus();
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
      next.select();
    }
  }
}

/**
 * Moves focus to the next focusable field (input/select) within `container`
 * when Enter is pressed, instead of submitting the form or doing nothing.
 * Textareas are skipped so Enter still inserts a newline there.
 */
export function focusNextFieldOnEnter(
  e: React.KeyboardEvent<HTMLElement>,
  container?: HTMLElement | null
) {
  if (e.key !== 'Enter') return;
  const target = e.target as HTMLElement;
  if (target.tagName === 'TEXTAREA') return;

  e.preventDefault();
  focusNextField(target, container);
}
