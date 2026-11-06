import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import './Popovers.css';

interface ShortcutsDialogProps {
  onClose: () => void;
}

/** The list of keyboard shortcuts (opened with ?). Escape, the × or a click outside closes it. */
export const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <ul className="shortcuts-list">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label}>
              <span>{label}</span>
              <span className="shortcut-keys">
                {keys.map(k => <kbd key={k}>{k}</kbd>)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
};
