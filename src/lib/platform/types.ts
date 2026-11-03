export interface Caps {
  backButton: boolean;
  saveFile: boolean;
  fileDialogs: boolean;
  openLinks: boolean;
  /** the shell can reach the release feed; Android cannot, it declares no INTERNET permission */
  updateCheck: boolean;
}

export interface Platform {
  kind: 'web' | 'android' | 'desktop';
  caps: Caps;
  shell(): void;
  saveFile(name: string, text: string, mime?: string): Promise<void>;
  pickFile(accept: string): Promise<{ name: string; text: string } | null>;
}
