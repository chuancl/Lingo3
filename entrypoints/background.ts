
import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { callTencentTranslation } from '../utils/api';
import { dictionariesStorage } from '../utils/storage';
import { DictionaryEngine } from '../types';

// Updated interface to match new requirements
interface DictData {
    phoneticUs: string;
    phoneticUk: string;
    usAudioUrl: string;
    ukAudioUrl: string;
    definitions: { part: string; means: string[] }[]; // Chinese definitions
    englishDefinitions: string[]; // English definitions
    sentences: { orig: string; trans: string }[];
    inflections: string[];
    tags: string[]; // Levels
    importance: number; // Star rating
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

  // --- Helper: Fetch Dictionary Data with Failover ---
  const fetchEnglishDictionaryData = async (word: string): Promise<DictData | null> => {
      const allDicts = await dictionariesStorage.getValue();
      const enabledDicts = allDicts.filter(d => d.isEnabled).sort((a, b) => a.priority - b.priority);

      for (const dict of enabledDicts) {
          try {
               // --- 1. Youdao (NetEase) - PRIMARY Source now ---
              if (dict.id === 'youdao') {
                  const res = await fetch(`https://dict.youdao.com/jsonapi?q=${word}`);
                  if (!res.ok) continue;

                  const data = await res.json();
                  
                  let phoneticUs = "";
                  let phoneticUk = "";
                  let usAudioUrl = "";
                  let ukAudioUrl = "";
                  
                  // Phonetics & Audio
                  if (data.simple && data.simple.word && data.simple.word.length > 0) {
                      const w = data.simple.word[0];
                      if(w['usphone']) phoneticUs = `/${w['usphone']}/`;
                      if(w['ukphone']) phoneticUk = `/${w['ukphone']}/`;
                      if(w['usspeech']) usAudioUrl = `https://dict.youdao.com/dictvoice?audio=${w['usspeech']}`;
                      if(w['ukspeech']) ukAudioUrl = `https://dict.youdao.com/dictvoice?audio=${w['ukspeech']}`;
                  }
                  // Fallback to ec
                  if (!phoneticUs && data.ec && data.ec.word && data.ec.word.length > 0) {
                      const w = data.ec.word[0];
                      if(w['usphone']) phoneticUs = `/${w['usphone']}/`;
                      if(w['ukphone']) phoneticUk = `/${w['ukphone']}/`;
                  }
                  // If audio still missing, construct generic url
                  if (!usAudioUrl) usAudioUrl = `https://dict.youdao.com/dictvoice?audio=${word}&type=2`;
                  if (!ukAudioUrl) ukAudioUrl = `https://dict.youdao.com/dictvoice?audio=${word}&type=1`;

                  // Chinese Definitions
                  const definitions: { part: string; means: string[] }[] = [];
                  if (data.ec && data.ec.word && data.ec.word.length > 0 && data.ec.word[0].trs) {
                      data.ec.word[0].trs.forEach((trItem: any) => {
                          if (trItem.pos || trItem.tran) {
                              let pos = trItem.pos || '';
                              if (pos && !pos.endsWith('.')) pos += '.';
                              definitions.push({ part: pos, means: [trItem.tran || ''] });
                          } else if (trItem.tr && trItem.tr[0] && trItem.tr[0].l && trItem.tr[0].l.i) {
                               const raw = trItem.tr[0].l.i[0];
                               const parts = raw.match(/^([a-z]+\.)\s*(.*)/);
                               if (parts) definitions.push({ part: parts[1], means: [parts[2]] });
                               else definitions.push({ part: '', means: [raw] });
                          }
                      });
                  }

                  // English Definitions
                  const englishDefinitions: string[] = [];
                  if (data.ee && data.ee.word && data.ee.word.trs) {
                      data.ee.word.trs.forEach((tr: any) => {
                          if (tr.pos && tr.tr && tr.tr[0] && tr.tr[0].l && tr.tr[0].l.i) {
                               const pos = tr.pos;
                               const def = tr.tr[0].l.i;
                               englishDefinitions.push(`${pos} ${def}`);
                          }
                      });
                  }

                  // Sentences
                  let sentences: { orig: string; trans: string }[] = [];
                  if (data.blng_sents_part && data.blng_sents_part['sentence-pair']) {
                      sentences = data.blng_sents_part['sentence-pair'].map((pair: any) => ({
                          orig: pair.sentence || "",
                          trans: pair['sentence-translation'] || ""
                      }));
                  }
                  sentences = sentences.filter(s => s.orig.length > 8 && s.orig.includes(' ') && s.trans);

                  // Inflections
                  const inflections: string[] = [];
                  const parseExchange = (ex: any) => {
                       if (!ex) return;
                       Object.values(ex).forEach((val: any) => {
                           if (Array.isArray(val)) inflections.push(...val);
                           else if (typeof val === 'string' && val.trim()) inflections.push(val);
                       });
                  };
                  if (data.simple?.word?.[0]?.exchange) parseExchange(data.simple.word[0].exchange);
                  if (data.ec?.word?.[0]?.exchange) parseExchange(data.ec.word[0].exchange);
                  
                  // Tags / Levels
                  const tags: string[] = [];
                  if (data.ec && data.ec.exam_type) {
                      tags.push(...data.ec.exam_type); // e.g., ["CET4", "CET6", "IELTS"]
                  }

                  // Importance / Star
                  let importance = 0;
                  if (data.collins && data.collins.collins_entries && data.collins.collins_entries.length > 0) {
                      // star field often is int
                      importance = data.collins.collins_entries[0].star || 0;
                  }

                  return {
                      phoneticUs,
                      phoneticUk,
                      usAudioUrl,
                      ukAudioUrl,
                      definitions,
                      englishDefinitions,
                      sentences,
                      inflections: [...new Set(inflections)],
                      tags,
                      importance
                  };
              }

              // --- 2. ICBA (Kingsoft) ---
              if (dict.id === 'iciba') {
                  const key = "D2AE3342306915865405466432026857";
                  const res = await fetch(`https://dict-co.iciba.com/api/dictionary.php?w=${word}&type=json&key=${key}`);
                  if (!res.ok) continue;
                  
                  const data = await res.json();
                  if (!data || !data.symbols || data.symbols.length === 0) continue;

                  const symbol = data.symbols[0];
                  
                  const definitions = (symbol.parts || []).map((p: any) => ({
                      part: p.part ? (p.part.endsWith('.') ? p.part : p.part + '.') : '',
                      means: p.means || []
                  }));

                  let sentences = (data.sent || []).map((s: any) => ({
                      orig: s.orig ? s.orig.trim() : "",
                      trans: s.trans ? s.trans.trim() : ""
                  })).filter((s: any) => s.orig.length > 8 && s.orig.includes(' ') && s.trans); 
                  
                  let inflections: string[] = [];
                  if (data.exchange) {
                      Object.values(data.exchange).forEach((val: any) => {
                          if (Array.isArray(val)) inflections.push(...val);
                          else if (typeof val === 'string' && val.trim()) inflections.push(val);
                      });
                  }
                  inflections = [...new Set(inflections)];

                  // Extract audio if available
                  const usAudioUrl = symbol.ph_am_mp3 || "";
                  const ukAudioUrl = symbol.ph_en_mp3 || "";

                  return {
                      phoneticUs: symbol.ph_am ? `/${symbol.ph_am}/` : '',
                      phoneticUk: symbol.ph_en ? `/${symbol.ph_en}/` : '',
                      usAudioUrl,
                      ukAudioUrl,
                      definitions,
                      englishDefinitions: [], // ICBA basic API often lacks strict English defs
                      sentences,
                      inflections,
                      tags: [],
                      importance: 0 // API doesn't provide easily
                  };
              }

              // --- 3. Free Dictionary API (Google) ---
              if (dict.id === 'free-dict') {
                  const res = await fetch(`${dict.endpoint}${word}`);
                  if (!res.ok) continue; 
                  const data = await res.json();
                  if (!Array.isArray(data) || data.length === 0) continue;
                  
                  const entry = data[0];
                  const usPhoneticObj = entry.phonetics?.find((p: any) => p.audio?.includes('-us.mp3'));
                  const ukPhoneticObj = entry.phonetics?.find((p: any) => p.audio?.includes('-uk.mp3'));

                  const usPhonetic = usPhoneticObj?.text || entry.phonetic || '';
                  const ukPhonetic = ukPhoneticObj?.text || '';
                  const usAudioUrl = usPhoneticObj?.audio || '';
                  const ukAudioUrl = ukPhoneticObj?.audio || '';

                  const definitions: { part: string; means: string[] }[] = [];
                  const englishDefinitions: string[] = [];

                  if (entry.meanings) {
                      entry.meanings.forEach((m: any) => {
                          const means = m.definitions.map((d: any) => d.definition);
                          definitions.push({ part: m.partOfSpeech || '', means: [] }); // No CN defs here
                          // Populate EN defs
                          m.definitions.forEach((d: any) => {
                              englishDefinitions.push(`${m.partOfSpeech}: ${d.definition}`);
                          });
                      });
                  }
                  
                  const example = entry.meanings?.[0]?.definitions?.find((d: any) => d.example)?.example || '';
                  const sentences = example ? [{ orig: example, trans: '' }] : [];
                  
                  return {
                      phoneticUs: usPhonetic,
                      phoneticUk: ukPhonetic,
                      usAudioUrl,
                      ukAudioUrl,
                      definitions, // Likely empty for CN
                      englishDefinitions,
                      sentences,
                      inflections: [],
                      tags: [],
                      importance: 0
                  };
              } 
          } catch (e) {
              console.warn(`Dictionary ${dict.name} failed for ${word}`, e);
          }
      }
      return null;
  };

  const smartAssignSentence = (
      sentences: { orig: string; trans: string }[], 
      definitionKeywords: string[],
      usedIndices: Set<number>,
      isPrimaryMeaning: boolean
  ) => {
      if (!sentences || sentences.length === 0) return { orig: '', trans: '' };
      
      for (let i = 0; i < sentences.length; i++) {
          if (usedIndices.has(i)) continue; 
          const sent = sentences[i];
          if (!sent.trans) continue;

          for (const keyword of definitionKeywords) {
              if (keyword.length > 0 && sent.trans.includes(keyword)) {
                  usedIndices.add(i);
                  return sent;
              }
          }
      }
      if (isPrimaryMeaning) {
           for (let i = 0; i < sentences.length; i++) {
                if (!usedIndices.has(i)) {
                    usedIndices.add(i);
                    return sentences[i];
                }
           }
      }
      return { orig: '', trans: '' };
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
          }[] = [];

          if (dictData && dictData.definitions.length > 0) {
              const validSentences = dictData.sentences;
              const usedIndices = new Set<number>();
              
              // Map all definitions
              meanings = dictData.definitions.map((def, idx) => {
                  const formattedTranslation = def.part ? `${def.part} ${def.means.join('; ')}` : def.means.join('; ');
                  const keywords = extractKeywords(def.means);
                  const sent = smartAssignSentence(validSentences, keywords, usedIndices, idx === 0);
                  
                  // Try to find matching english definition roughly by index or fallback
                  const engDef = dictData.englishDefinitions[idx] || (dictData.englishDefinitions.length > 0 ? dictData.englishDefinitions[0] : "");

                  return {
                      translation: formattedTranslation.trim(),
                      partOfSpeech: def.part,
                      englishDefinition: engDef,
                      contextSentence: '',
                      mixedSentence: '',
                      dictionaryExample: sent.orig,
                      dictionaryExampleTranslation: sent.trans
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
              usAudioUrl: dictData?.usAudioUrl || '',
              ukAudioUrl: dictData?.ukAudioUrl || '',
              inflections: dictData?.inflections || [],
              tags: dictData?.tags || [],
              importance: dictData?.importance || 0,
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
