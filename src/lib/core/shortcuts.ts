// Every keyboard action is a named command with a default key and a scope. Users can rebind them in Settings.
export type Scope = 'global' | 'solve' | 'train' | 'library' | 'drills';
export interface Command { id: string; label: string; scope: Scope; def: string; alt?: string }

export const COMMANDS: Command[] = [
  { id: 'timer', label: 'Start / stop the timer', scope: 'global', def: 'Space' },
  { id: 'back', label: 'Go back / close', scope: 'global', def: 'Escape' },
  { id: 'goSolve', label: 'Go to Solve', scope: 'global', def: 'Digit3' },
  { id: 'goTrain', label: 'Go to Train', scope: 'global', def: 'Digit1' },
  { id: 'goLibrary', label: 'Go to Library', scope: 'global', def: 'Digit2' },
  { id: 'goDrills', label: 'Go to Drills', scope: 'global', def: 'Digit4' },
  { id: 'goSettings', label: 'Go to Settings', scope: 'global', def: 'Digit5' },
  { id: 'cube', label: 'Show / hide the scramble cube', scope: 'global', def: 'End' },
  { id: 'tabPrev', label: 'Previous tab', scope: 'global', def: 'KeyQ' },
  { id: 'tabNext', label: 'Next tab', scope: 'global', def: 'KeyE' },
  { id: 'plus2', label: '+2 on the last solve', scope: 'solve', def: 'KeyZ', alt: 'KeyP' },
  { id: 'dnf', label: 'DNF on the last solve', scope: 'solve', def: 'KeyX' },
  { id: 'deleteLast', label: 'Delete the last solve', scope: 'solve', def: 'KeyC' },
  { id: 'history', label: 'Open history', scope: 'solve', def: 'KeyD' },
  { id: 'sessions', label: 'Open sessions', scope: 'solve', def: 'KeyA' },
  { id: 'scramble', label: 'New scramble', scope: 'solve', def: 'KeyS', alt: 'KeyW' },
  { id: 'split', label: 'Mark a phase split (while solving)', scope: 'solve', def: 'Slash' },
  { id: 'nextCase', label: 'Next case (new scramble)', scope: 'train', def: 'KeyW' },
  { id: 'trainPrev', label: 'Previous case set', scope: 'train', def: 'KeyA' },
  { id: 'trainNext', label: 'Next case set', scope: 'train', def: 'KeyD' },
  { id: 'trainHistory', label: 'Open training history', scope: 'train', def: 'KeyS' },
  { id: 'drillNext', label: 'Next drill scramble', scope: 'drills', def: 'KeyW', alt: 'KeyS' },
  { id: 'drillTwoLook', label: 'One look / two look', scope: 'drills', def: 'KeyF' },
  { id: 'hints', label: 'Type a case code to open it', scope: 'library', def: 'KeyF' },
  { id: 'libPrev', label: 'Previous case set', scope: 'library', def: 'KeyA' },
  { id: 'libNext', label: 'Next case set', scope: 'library', def: 'KeyD' },
];
export const SCOPE_NAMES: Record<Scope, string> = { global: 'Everywhere', solve: 'Solve screen', train: 'Train screen', library: 'Library screen', drills: 'Drills screen' };

export const command = (id: string): Command | undefined => COMMANDS.find(c => c.id === id);
export const keyFor = (id: string, overrides: Record<string, string>): string =>
  overrides[id] ?? command(id)?.def ?? '';

const clash = (a: Scope, b: Scope) => a === 'global' || b === 'global' || a === b;
/** The command that already uses `code` in an overlapping scope, if any. */
export function conflictFor(id: string, code: string, overrides: Record<string, string>): Command | null {
  const me = command(id);
  if (!me) return null;
  // a stock alias counts too, otherwise binding another key to KeyP/KeyW would fire two commands
  const uses = (c: Command) => keyFor(c.id, overrides) === code || (!overrides[c.id] && c.alt === code);
  return COMMANDS.find(c => c.id !== id && uses(c) && clash(me.scope, c.scope)) ?? null;
}

const NOT_ALLOWED = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab', 'Enter', 'CapsLock']);
export const canBind = (code: string) => !NOT_ALLOWED.has(code) && code.length > 0;

// A punctuation key reads as the character it types, not as its DOM name ("Slash" is not a keycap).
const PUNCT: Record<string, string> = {
  Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Backquote: '`',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
};

export function codeLabel(code: string): string {
  if (PUNCT[code]) return PUNCT[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5) + ' arrow';
  return code;
}

export type KeyLike = { code: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };
export const hasModifier = (e: KeyLike) => !!(e.ctrlKey || e.altKey || e.metaKey);

/** True when the event matches the command's key. `alt` is a stock-layout convenience: it stands down
 *  as soon as the command is rebound, so a custom layout is never shadowed by an old default. */
export function matches(e: KeyLike, id: string, overrides: Record<string, string>): boolean {
  if (hasModifier(e)) return false;
  const c = command(id);
  if (!c) return false;
  if (e.code === (overrides[id] ?? c.def)) return true;
  return !overrides[id] && !!c.alt && e.code === c.alt;
}
