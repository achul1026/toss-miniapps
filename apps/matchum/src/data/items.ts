import raw from '../../../../content/matchum/items.json';

export interface Spelling {
  id: string;
  right: string; // 바른 표기
  wrong: string; // 자주 틀리는 표기
  sentence: string; // {} 자리에 표기가 들어가는 예문
  rule: string; // 왜 그런지
  tip: string; // 구별하는 요령
}

export const ITEMS: Spelling[] = raw as Spelling[];

export const fill = (s: Spelling, word: string) => s.sentence.replace('{}', word);
