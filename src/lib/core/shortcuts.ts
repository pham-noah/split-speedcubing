// Every keyboard action is a named command with a default key and a scope. Users can rebind them in Settings.
export type Scope = 'global' | 'solve' | 'train' | 'library';
export interface Command { id: string; label: string; scope: Scope; def: string }

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
  { id: 'plus2', label: '+2 on the last solve', scope: 'solve', def: 'KeyZ' },
  { id: 'dnf', label: 'DNF on the last solve', scope: 'solve', def: 'KeyX' },
  { id: 'deleteLast', label: 'Delete the last solve', scope: 'solve', def: 'KeyC' },
  { id: 'history', label: 'Open history', scope: 'solve', def: 'KeyD' },
  { id: 'sessions', label: 'Open sessions', scope: 'solve', def: 'KeyA' },
  { id: 'scramble', label: 'New scramble', scope: 'solve', def: 'KeyS' },
  { id: 'nextCase', label: 'Next case (new scramble)', scope: 'train', def: 'KeyW' },
  { id: 'trainPrev', label: 'Previous case set', scope: 'train', def: 'KeyA' },
  { id: 'trainNext', label: 'Next case set', scope: 'train', def: 'KeyD' },
  { id: 'trainHistory', label: 'Open training history', scope: 'train', def: 'KeyS' },
  { id: 'hints', label: 'Type a case code to open it', scope: 'library', def: 'KeyF' },
  { id: 'libPrev', label: 'Previous case set', scope: 'library', def: 'KeyA' },
  { id: 'libNext', label: 'Next case set', scope: 'library', def: 'KeyD' },
];
export const SCOPE_NAMES: Record<Scope, string> = { global: 'Everywhere', solve: 'Solve screen', train: 'Train screen', library: 'Library screen' };

export const keyFor = (id: string, overrides: Record<string, string>): string =>
  overrides[id] ?? COMMANDS.find(c => c.id === id)!.def;

const clash = (a: Scope, b: Scope) => a === 'global' || b === 'global' || a === b;
/** The command that already uses `code` in an overlapping scope, if any. */
export function conflictFor(id: string, code: string, overrides: Record<string, string>): Command | null {
  const me = COMMANDS.find(c => c.id === id)!;
  return COMMANDS.find(c => c.id !== id && keyFor(c.id, overrides) === code && clash(me.scope, c.scope)) ?? null;
}

const NOT_ALLOWED = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab', 'Enter', 'CapsLock']);
export const canBind = (code: string) => !NOT_ALLOWED.has(code) && code.length > 0;

export function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5) + ' arrow';
  return code;
}

export type KeyLike = { code: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };
export const hasModifier = (e: KeyLike) => !!(e.ctrlKey || e.altKey || e.metaKey);
export const matches = (e: KeyLike, id: string, overrides: Record<string, string>) => !hasModifier(e) && e.code === keyFor(id, overrides);
