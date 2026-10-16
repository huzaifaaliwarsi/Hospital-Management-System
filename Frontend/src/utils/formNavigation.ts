import React from 'react';

/**
 * Activates an element when focus lands on it.
 * - Text/number inputs: text is selected for rapid overwriting.
 * - Select dropdowns: automatically opens the native picker so the user can immediately
 *   navigate options with Up/Down arrows and select with Enter.
 */
function activateFocusableElement(el: HTMLElement) {
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
  } else if (el instanceof HTMLSelectElement) {
    (el as any)._pickerOpen = true;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
      }
    } catch {
      // Browser policy or unsupported environment
    }
  }
}

/**
 * Moves focus from `current` to the next focusable field (input/select/textarea/[data-nav-item])
 * within `container`, in DOM order.
 * If at the last field, gracefully focuses the primary submit/register button.
 */
export function focusNextField(current: HTMLElement, container?: HTMLElement | null) {
  const root: ParentNode = container || current.closest('form') || current.closest('[data-form-container]') || document;
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [data-nav-item="true"]:not(:disabled)'
    )
  ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);

  let idx = focusable.indexOf(current);

  if (idx === -1) {
    // If current element isn't in focusable array directly, find the first focusable following it in DOM
    idx = focusable.findIndex((el) =>
      Boolean(current.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (idx > -1) {
      const next = focusable[idx];
      activateFocusableElement(next);
      return;
    }
  } else if (idx < focusable.length - 1) {
    const next = focusable[idx + 1];
    activateFocusableElement(next);
    return;
  }

  // If at the end of the fields, focus the primary submit / action button
  const submitBtn = root.querySelector<HTMLElement>(
    'button[type="submit"]:not(:disabled), button#btn-register-encounter:not(:disabled), button#btn-save-admission:not(:disabled), button[data-submit-btn]:not(:disabled)'
  );
  if (submitBtn) {
    submitBtn.focus();
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Moves focus to the next focusable field within `container`
 * when Enter is pressed, instead of submitting the form or doing nothing.
 * Shift+Enter in textareas still inserts a newline.
 * Select dropdowns:
 * - If closed, Enter opens the options list (showPicker) so user can navigate with arrows.
 * - If open / after selecting an option, Enter moves to the next field.
 */
export function focusNextFieldOnEnter(
  e: React.KeyboardEvent<HTMLElement>,
  container?: HTMLElement | null
) {
  if (e.key !== 'Enter') return;
  const target = e.target as HTMLElement;

  // Allow Shift+Enter inside textarea for multi-line notes
  if (target.tagName === 'TEXTAREA' && e.shiftKey) return;

  // If already on the primary action button, let Enter trigger its click
  if (target.tagName === 'BUTTON' && (target.id === 'btn-register-encounter' || target.id === 'btn-save-admission' || (target as HTMLButtonElement).type === 'submit')) {
    return;
  }

  // Select dropdown logic
  if (target instanceof HTMLSelectElement) {
    if (!(target as any)._pickerOpen) {
      (target as any)._pickerOpen = true;
      try {
        if (typeof target.showPicker === 'function') {
          target.showPicker();
          e.preventDefault();
          return;
        }
      } catch {
        // Fallback if showPicker throws
      }
    } else {
      (target as any)._pickerOpen = false;
    }
  }

  e.preventDefault();
  focusNextField(target, container);
}

