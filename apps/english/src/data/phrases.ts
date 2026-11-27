import raw from '../../../../content/english/phrases.json';

export interface Phrase {
  id: string;
  en: string; // 영어 문장
  say: string; // 한글로 적은 발음
  ko: string; // 뜻
  when: string; // 쓰는 상황
  key: string; // 빈칸 문제에 쓸 핵심 단어 (en 안에 그대로 들어 있음)
  reply: [string, string]; // 상대가 흔히 하는 대답 [영어, 뜻]
}

export const PHRASES: Phrase[] = raw as Phrase[];

export const blanked = (p: Phrase) => p.en.replace(p.key, '____');
