export type CaseSet = 'PLL' | 'OLL' | 'F2L' | 'ZBLL';
export type Slot = 'FR' | 'BR' | 'BL' | 'FL';
export interface CaseDef { id: string; set: CaseSet; name: string; alg: string; group?: string; slot?: Slot; nick?: string }
