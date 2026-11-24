import raw from '../../../../content/saja/idioms.json';

export interface Idiom {
  id: string;
  hanja: string;
  hangul: string;
  meaning: string;
  chars: [string, string][];
  story: string;
  example: string;
}

export const IDIOMS: Idiom[] = raw as Idiom[];
