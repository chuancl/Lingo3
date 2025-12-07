
import { TranslationEngine, WordEntry, WordCategory } from "../types";
import { browser } from "wxt/browser";

interface DictionaryResult {
  text: string;
  phoneticUs: string;
  phoneticUk: string;
  usAudioUrl: string; // New
  ukAudioUrl: string; // New
  inflections?: string[];
  tags: string[]; // New
  importance: number; // New
  meanings: {
    translation: string;
    partOfSpeech?: string; 
    englishDefinition: string; // New
    contextSentence: string;
    mixedSentence: string;
    dictionaryExample: string;
    dictionaryExampleTranslation?: string; 
  }[];
}

const similarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
};

const editDistance = (s1: string, s2: string) => {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

/**
 * Core Service: Fetches rich word info using the active engine.
 */
export const fetchWordDetails = async (
  word: string, 
  preferredTranslation: string | undefined, 
  engine: TranslationEngine
): Promise<Partial<WordEntry>[]> => {
  
  const response = await browser.runtime.sendMessage({
    action: 'LOOKUP_WORD',
    engine: engine,
    text: word,
    preferredTranslation: preferredTranslation
  });

  if (!response) {
    throw new Error("后台服务未响应，请刷新页面或重新加载扩展。");
  }

  if (!response.success) {
    throw new Error(response.error || "Lookup failed");
  }

  const result: DictionaryResult = response.data;

  // 2. Filter logic
  let selectedMeanings = result.meanings;

  if (preferredTranslation && preferredTranslation.trim()) {
    const sorted = [...result.meanings].sort((a, b) => {
        const scoreA = similarity(a.translation, preferredTranslation);
        const scoreB = similarity(b.translation, preferredTranslation);
        return scoreB - scoreA;
    });
    
    if (sorted.length > 0) {
        selectedMeanings = [sorted[0]];
    }
  } else {
    selectedMeanings = selectedMeanings.filter(m => m.translation && m.translation.trim().length > 0);
  }

  const timestamp = Date.now();
  
  // Return all common fields + specific meaning fields
  return selectedMeanings.map((m, idx) => ({
    text: result.text,
    phoneticUs: result.phoneticUs,
    phoneticUk: result.phoneticUk,
    usAudioUrl: result.usAudioUrl,
    ukAudioUrl: result.ukAudioUrl,
    inflections: result.inflections || [],
    tags: result.tags || [],
    importance: result.importance || 0,
    
    // Meaning Specific
    translation: m.translation,
    englishDefinition: m.englishDefinition,
    contextSentence: m.contextSentence,
    mixedSentence: m.mixedSentence,
    dictionaryExample: m.dictionaryExample,
    dictionaryExampleTranslation: m.dictionaryExampleTranslation,
    
    addedAt: timestamp + idx
  }));
};
