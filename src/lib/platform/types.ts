/** What a shell can do that the others cannot. Everything else in the app is shared. */
export interface Caps {
  /** Android hardware/gesture Back: closes the top screen before leaving the app. */
  backButton: boolean;
  /** The shell can hand a generated file to the user (backups). */
  saveFile: boolean;
  /** A real file dialog instead of the hidden <input> fallback. */
  fileDialogs: boolean;
}

export interface Platform {
  kind: 'web' | 'android' | 'desktop';
  caps: Caps;
  /** One-time shell wiring: back button, service worker, data-platform on <html>. */
  shell(): void;
  /** Save text as a file; resolves when the shell has taken it. */
  saveFile(name: string, text: string, mime?: string): Promise<void>;
  /** Ask for a local file; null when the user cancels. */
  pickFile(accept: string): Promise<{ name: string; text: string } | null>;
}
