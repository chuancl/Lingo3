
import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { callTencentTranslation } from '../utils/api';
import { dictionariesStorage } from '../utils/storage';
import { DictionaryEngine } from '../types';

interface DictData {
    phoneticUs: string;
    phoneticUk: string;
    definitions: { 
        part: string; 
        means: string[]; 
        examples: { orig: string; trans: string; audio?: string }[] 
    }[]; 
    englishDefinitions: string[]; 
    inflections: string[];
    tags: string[]; 
    importance: number; 
    cocaRank: number; // Fetched separately
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('ContextLingo Extension Installed');
  });

  browser.action.onClicked.addListener(() => {
    const url = (browser.runtime as any).getURL('/options.html');
    browser.tabs.create({ url });
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === 'translate-page') {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'TRIGGER_TRANSLATION' });
        }
      });
    }
  });

  // --- 1. Fetch COCA Rank (Separate Request) ---
  const fetchCocaRank = async (word: string): Promise<number> => {
      try {
          // Placeholder for real COCA source. 
          // Since the user didn't provide the specific COCA URL they use, 
          // we will try to infer it from a public mirror or fallback to Youdao's own 'rank' data if available.
          // For now, returning 0. 
          // TODO: Replace this URL with the specific COCA endpoint provided by user.
          // const res = await fetch(`https://some-coca-mirror.com/api?word=${word}`);
          // const data = await res.json();
          // return data.rank;
          return 0;
      } catch (e) {
          console.warn("COCA fetch failed", e);
          return 0;
      }
  };

  // --- 2. Fetch Dictionary Data ---
  const fetchEnglishDictionaryData = async (word: string): Promise<DictData | null> => {
      const allDicts = await dictionariesStorage.getValue();
      const enabledDicts = allDicts.filter(d => d.isEnabled).sort((a, b) => a.priority - b.priority);

      // Fetch COCA concurrently (Request #2)
      const cocaPromise = fetchCocaRank(word);

      for (const dict of enabledDicts) {
          try {
              // --- A. Youdao (Deep Parsing) ---
              if (dict.id === 'youdao') {
                  const res = await fetch(`https://dict.youdao.com/jsonapi?q=${word}`);
                  if (!res.ok) continue;

                  const data = await res.json();
                  const cocaRank = await cocaPromise; // Await the second request

                  // 1. Phonetics
                  let phoneticUs = "";
                  let phoneticUk = "";
                  if (data.simple?.word?.[0]) {
                      const w = data.simple.word[0];
                      if(w['usphone']) phoneticUs = `/${w['usphone']}/`;
                      if(w['ukphone']) phoneticUk = `/${w['ukphone']}/`;
                  } else if (data.ec?.word?.[0]) {
                      const w = data.ec.word[0];
                      if(w['usphone']) phoneticUs = `/${w['usphone']}/`;
                      if(w['ukphone']) phoneticUk = `/${w['ukphone']}/`;
                  }

                  // 2. Inflections (WFS)
                  const inflections: string[] = [];
                  // Method A: Root level wfs
                  if (data.wfs) {
                      data.wfs.forEach((item: any) => {
                          if (item.wf) {
                              // item.wf might be { name: '复数', value: 'books' }
                              if (item.wf.value) inflections.push(item.wf.value);
                          }
                      });
                  }
                  // Method B: Nested exchange
                  if (inflections.length === 0) {
                      const parseExchange = (ex: any) => {
                           if (!ex) return;
                           Object.values(ex).forEach((val: any) => {
                               if (Array.isArray(val)) inflections.push(...val);
                               else if (typeof val === 'string' && val.trim()) inflections.push(val);
                           });
                      };
                      if (data.simple?.word?.[0]?.exchange) parseExchange(data.simple.word[0].exchange);
                  }

                  // 3. Definitions & Examples (Deep Parse expand_ec)
                  const definitions: { part: string; means: string[]; examples: {orig: string, trans: string, audio?: string}[] }[] = [];
                  
                  // Primary Source: expand_ec (Detailed POS breakdown)
                  if (data.expand_ec && data.expand_ec.word) {
                      data.expand_ec.word.forEach((w: any) => {
                          const part = w.pos || '';
                          const means = (w.trans || []).map((t: any) => t.content || t);
                          // Examples specific to this POS? Usually expand_ec doesn't nest examples well, 
                          // but sometimes it does. If not, we map global examples later.
                          definitions.push({ part, means, examples: [] });
                      });
                  }
                  
                  // Fallback Source: ec (Concise)
                  if (definitions.length === 0 && data.ec && data.ec.word?.[0]?.trs) {
                      data.ec.word[0].trs.forEach((tr: any) => {
                          // Try to split "n. meaning"
                          const raw = tr.tr?.[0]?.l?.i?.[0] || "";
                          const match = raw.match(/^([a-z]+\.)\s*(.*)/);
                          if (match) {
                              definitions.push({ part: match[1], means: [match[2]], examples: [] });
                          } else {
                              definitions.push({ part: '', means: [raw], examples: [] });
                          }
                      });
                  }

                  // 4. Global Examples (blng_sents_part is best for audio)
                  // We will try to distribute these examples to the definitions if possible, or just keep them handy.
                  const globalExamples: {orig: string, trans: string, audio?: string}[] = [];
                  
                  // Source A: Bilingual Sentences (Has Audio!)
                  if (data.blng_sents_part && data.blng_sents_part['sentence-pair']) {
                      data.blng_sents_part['sentence-pair'].forEach((pair: any) => {
                          if (pair.sentence && pair['sentence-translation']) {
                              globalExamples.push({
                                  orig: pair.sentence,
                                  trans: pair['sentence-translation'],
                                  // Determine audio URL. 
                                  // sometimes pair['sentence-speech'] gives a relative or full url.
                                  audio: pair['sentence-speech']
                              });
                          }
                      });
                  }
                  // Source B: Collins Examples (High Quality, no audio usually)
                  if (data.collins?.collins_entries?.[0]?.entries?.entry) {
                       const entry = data.collins.collins_entries[0].entries.entry;
                       entry.forEach((e: any) => {
                           if (e.tran_entry) {
                               e.tran_entry.forEach((te: any) => {
                                   if (te.exam_sents?.sent) {
                                       te.exam_sents.sent.forEach((s: any) => {
                                           if (s.eng_sent && s.chn_sent) {
                                               globalExamples.push({ orig: s.eng_sent, trans: s.chn_sent });
                                           }
                                       });
                                   }
                               });
                           }
                       });
                  }

                  // 5. English Definitions
                  const englishDefinitions: string[] = [];
                  if (data.ee && data.ee.word && data.ee.word.trs) {
                      data.ee.word.trs.forEach((tr: any) => {
                          const pos = tr.pos || '';
                          const def = tr.tr?.[0]?.l?.i || '';
                          if (def) englishDefinitions.push(`${pos} ${def}`);
                      });
                  }

                  // 6. Tags & Importance
                  const tags: string[] = [];
                  if (data.ec?.exam_type) tags.push(...data.ec.exam_type);
                  
                  let importance = 0;
                  if (data.collins?.collins_entries?.[0]?.star) {
                      importance = data.collins.collins_entries[0].star;
                  }

                  return {
                      phoneticUs,
                      phoneticUk,
                      definitions: definitions.map(d => ({...d, examples: globalExamples})), // Pass global examples to all for now, optimized later
                      englishDefinitions,
                      inflections: [...new Set(inflections)],
                      tags,
                      importance,
                      cocaRank
                  };
              }

              // --- B. ICBA (Secondary) ---
              // Only runs if Youdao fails or is disabled.
              if (dict.id === 'iciba') {
                  const key = "D2AE3342306915865405466432026857";
                  const res = await fetch(`https://dict-co.iciba.com/api/dictionary.php?w=${word}&type=json&key=${key}`);
                  if (!res.ok) continue;
                  
                  const data = await res.json();
                  const cocaRank = await cocaPromise;
                  if (!data || !data.symbols || data.symbols.length === 0) continue;

                  const symbol = data.symbols[0];
                  
                  const definitions = (symbol.parts || []).map((p: any) => ({
                      part: p.part ? (p.part.endsWith('.') ? p.part : p.part + '.') : '',
                      means: p.means || [],
                      examples: []
                  }));

                  // Global examples
                  let examples = (data.sent || []).map((s: any) => ({
                      orig: s.orig ? s.orig.trim() : "",
                      trans: s.trans ? s.trans.trim() : "",
                      audio: "" // ICBA sent API structure varies, assuming no easy audio link here
                  })).filter((s: any) => s.orig.length > 8 && s.orig.includes(' ') && s.trans);

                  let inflections: string[] = [];
                  if (data.exchange) {
                      Object.values(data.exchange).forEach((val: any) => {
                          if (Array.isArray(val)) inflections.push(...val);
                          else if (typeof val === 'string' && val.trim()) inflections.push(val);
                      });
                  }

                  return {
                      phoneticUs: symbol.ph_am ? `/${symbol.ph_am}/` : '',
                      phoneticUk: symbol.ph_en ? `/${symbol.ph_en}/` : '',
                      definitions: definitions.map(d => ({...d, examples})),
                      englishDefinitions: [], 
                      inflections: [...new Set(inflections)],
                      tags: [],
                      importance: 0,
                      cocaRank
                  };
              }

              // --- C. Free Dict (Fallback) ---
              if (dict.id === 'free-dict') {
                  const res = await fetch(`${dict.endpoint}${word}`);
                  if (!res.ok) continue; 
                  const data = await res.json();
                  const cocaRank = await cocaPromise;
                  if (!Array.isArray(data) || data.length === 0) continue;
                  
                  const entry = data[0];
                  const usPhoneticObj = entry.phonetics?.find((p: any) => p.audio?.includes('-us.mp3'));
                  const ukPhoneticObj = entry.phonetics?.find((p: any) => p.audio?.includes('-uk.mp3'));

                  const definitions: { part: string; means: string[]; examples: any[] }[] = [];
                  const englishDefinitions: string[] = [];

                  if (entry.meanings) {
                      entry.meanings.forEach((m: any) => {
                          definitions.push({ part: m.partOfSpeech || '', means: [], examples: [] });
                          m.definitions.forEach((d: any) => {
                              englishDefinitions.push(`${m.partOfSpeech}: ${d.definition}`);
                          });
                      });
                  }
                  
                  const ex = entry.meanings?.[0]?.definitions?.find((d: any) => d.example)?.example || '';
                  const examples = ex ? [{ orig: ex, trans: '', audio: '' }] : [];
                  
                  return {
                      phoneticUs: usPhoneticObj?.text || entry.phonetic || '',
                      phoneticUk: ukPhoneticObj?.text || '',
                      definitions: definitions.map(d => ({...d, examples})),
                      englishDefinitions,
                      inflections: [],
                      tags: [],
                      importance: 0,
                      cocaRank
                  };
              } 
          } catch (e) {
              console.warn(`Dictionary ${dict.name} failed for ${word}`, e);
          }
      }
      return null;
  };

  const smartAssignExample = (
      allExamples: { orig: string; trans: string; audio?: string }[], 
      definitionKeywords: string[]
  ) => {
      if (!allExamples || allExamples.length === 0) return { orig: '', trans: '', audio: '' };
      
      // Simple keyword match
      for (const ex of allExamples) {
          if (!ex.trans) continue;
          for (const keyword of definitionKeywords) {
              if (keyword.length > 0 && ex.trans.includes(keyword)) {
                  return ex;
              }
          }
      }
      // Fallback to first valid
      return allExamples[0];
  };

  const extractKeywords = (means: string[]) => {
      return means.flatMap(m => m.split(/[,，;；]/))
          .map(s => s.replace(/^[a-z]+\.\s*/, ''))
          .map(s => s.replace(/[（(].*?[)）]/g, ''))
          .map(s => s.replace(/[\[【].*?[\]】]/g, ''))
          .map(s => s.trim())
          .filter(s => s.length > 0);
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRANSLATE_TEXT') {
      (async () => {
        try {
          if (message.engine.id === 'tencent') {
             const result = await callTencentTranslation(message.engine, message.text, message.target);
             sendResponse({ success: true, data: result });
          } else if (message.engine.id === 'custom-mock') {
             sendResponse({ success: true, data: { Response: { TargetText: `Simulated translation for: ${message.text}` } } });
          } else {
             throw new Error(`Engine ${message.engine.name} not supported in background proxy yet.`);
          }
        } catch (error: any) {
          console.error('ContextLingo Background Error:', error);
          sendResponse({ success: false, error: error.message || String(error) });
        }
      })();
      return true; 
    }

    if (message.action === 'LOOKUP_WORD') {
      (async () => {
        try {
          const { engine, text, preferredTranslation } = message;

          // 1. Fetch Real Dictionary Data
          const dictData = await fetchEnglishDictionaryData(text);

          // 2. Prepare Meanings
          let meanings: { 
              translation: string; 
              partOfSpeech?: string;
              englishDefinition: string;
              contextSentence: string; 
              mixedSentence: string; 
              dictionaryExample: string;
              dictionaryExampleTranslation: string;
              dictionaryExampleAudioUrl?: string;
          }[] = [];

          if (dictData && dictData.definitions.length > 0) {
              meanings = dictData.definitions.map((def, idx) => {
                  const formattedTranslation = def.part ? `${def.part} ${def.means.join('; ')}` : def.means.join('; ');
                  
                  // Try to find best example
                  const keywords = extractKeywords(def.means);
                  const example = smartAssignExample(def.examples, keywords);
                  
                  // English Definition (try to match index or just take first)
                  const engDef = dictData.englishDefinitions[idx] || (dictData.englishDefinitions.length > 0 ? dictData.englishDefinitions[0] : "");

                  return {
                      translation: formattedTranslation.trim(),
                      partOfSpeech: def.part,
                      englishDefinition: engDef,
                      contextSentence: '',
                      mixedSentence: '',
                      dictionaryExample: example.orig,
                      dictionaryExampleTranslation: example.trans,
                      dictionaryExampleAudioUrl: example.audio
                  };
              });
          } else if (engine.id === 'tencent') {
              const res = await callTencentTranslation(engine, text, 'zh');
              const trans = res.Response?.TargetText || "API Error";
              meanings.push({
                  translation: trans,
                  englishDefinition: '',
                  contextSentence: '',
                  mixedSentence: '',
                  dictionaryExample: '',
                  dictionaryExampleTranslation: ''
              });
          }

          const result = {
              text: text,
              phoneticUs: dictData?.phoneticUs || '',
              phoneticUk: dictData?.phoneticUk || '',
              inflections: dictData?.inflections || [],
              tags: dictData?.tags || [],
              importance: dictData?.importance || 0,
              cocaRank: dictData?.cocaRank || 0,
              meanings: meanings
          };
          sendResponse({ success: true, data: result });

        } catch (error: any) {
          console.error('ContextLingo Background Error:', error);
          sendResponse({ success: false, error: error.message || String(error) });
        }
      })();
      return true;
    }
  });
});
