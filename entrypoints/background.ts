
import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { callTencentTranslation } from '../utils/api';
import { dictionariesStorage } from '../utils/storage';
import { RichDictionaryResult, DictionaryMeaningCard } from '../types';

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

  // --- Aggressive Sanitization Helper ---
  const safeString = (input: any): string => {
      if (input === null || input === undefined) return '';
      if (typeof input === 'string') return input;
      if (typeof input === 'number') return String(input);
      
      // If it's an object, try to extract known text-bearing properties
      if (typeof input === 'object') {
          // Common Youdao keys
          const candidates = [
              input.value, 
              input.text, 
              input.examType, 
              input.word, 
              input.headword, 
              input.tran,
              input.translation
          ];
          
          for (const c of candidates) {
              if (c && typeof c === 'string') return c;
          }
          // If no known string property found, ignore it to prevent rendering [object Object]
          return '';
      }
      return '';
  };

  // --- Helpers for Youdao Data Normalization ---
  
  const normalizeTags = (tags: any): string[] => {
      if (!Array.isArray(tags)) return [];
      return tags.map(t => safeString(t)).filter(t => t.trim().length > 0);
  };

  const normalizeForms = (forms: any): string[] => {
      if (!Array.isArray(forms)) return [];
      return forms.map(f => safeString(f)).filter(f => f.trim().length > 0);
  };

  // --- 1. Fetch COCA Rank (Separate Request) ---
  const fetchCocaRank = async (word: string): Promise<number> => {
      try {
          // Placeholder for real COCA source. 
          return 0;
      } catch (e) {
          return 0;
      }
  };

  // --- 2. Deep Parse Youdao JSON ---
  const parseYoudaoDeep = (data: any, cocaRank: number): RichDictionaryResult => {
      // 1. Phonetics
      let phoneticUs = "";
      let phoneticUk = "";
      const simpleWord = data.simple?.word?.[0];
      const ecWord = data.ec?.word?.[0];
      
      if (simpleWord) {
          phoneticUs = simpleWord['usphone'] ? `/${safeString(simpleWord['usphone'])}/` : '';
          phoneticUk = simpleWord['ukphone'] ? `/${safeString(simpleWord['ukphone'])}/` : '';
      } else if (ecWord) {
          phoneticUs = ecWord['usphone'] ? `/${safeString(ecWord['usphone'])}/` : '';
          phoneticUk = ecWord['ukphone'] ? `/${safeString(ecWord['ukphone'])}/` : '';
      }

      // 2. Public Info
      // Inflections
      let inflections: string[] = [];
      if (data.collins_primary?.words?.indexforms) {
           inflections = normalizeForms(data.collins_primary.words.indexforms);
      } else if (data.wfs) {
           data.wfs.forEach((item: any) => { 
               if (item.wf) {
                   const val = safeString(item.wf);
                   if (val) inflections.push(val);
               }
           });
      }

      // Phrases
      const phrases: { text: string; trans: string }[] = [];
      if (data.phrs?.phrs) {
          data.phrs.phrs.forEach((p: any) => {
              const text = safeString(p.headword);
              const trans = safeString(p.translation);
              if (text && trans) phrases.push({ text, trans });
          });
      }

      // Roots (Rel Word)
      const roots: { root: string; words: { text: string; trans: string }[] }[] = [];
      if (data.rel_word?.rels) {
          data.rel_word.rels.forEach((rel: any) => {
              const rootWords: { text: string; trans: string }[] = [];
              if (rel.rel?.words) {
                   rel.rel.words.forEach((w: any) => {
                       const text = safeString(w.word);
                       const trans = safeString(w.tran);
                       if (text && trans) rootWords.push({ text, trans });
                   });
              }
              if (rootWords.length > 0) {
                  roots.push({ root: safeString(rel.rel?.pos) || 'Root', words: rootWords });
              }
          });
      }

      // Synonyms
      const synonyms: { text: string; trans: string }[] = [];
      if (data.syno?.synos) {
          data.syno.synos.forEach((group: any) => {
              if (group.ws) {
                  group.ws.forEach((w: any) => {
                       const text = safeString(w.w);
                       const trans = safeString(w.tran);
                       if (text && trans) synonyms.push({ text, trans });
                  });
              }
          });
      }

      // Picture
      const picUrl = data.pic_dict?.pic?.[0]?.image ? safeString(data.pic_dict.pic[0].image) : undefined;

      // Video
      let video = undefined;
      if (data.word_video?.video?.[0]) {
          const v = data.word_video.video[0];
          const url = safeString(v.url);
          const cover = safeString(v.cover);
          const title = safeString(v.title);
          if (url && cover) {
              video = { title: title || 'Video', url, cover };
          }
      }

      // 3. Meaning Cards
      const meanings: DictionaryMeaningCard[] = [];
      
      // Global Tags (Exam Types)
      // data.ec.exam_type can be ["CET4"] or [{examType: "CET4"}]
      const globalTags = normalizeTags(data.ec?.exam_type || []);

      // Strategy A: Collins Primary (High Quality)
      if (data.collins_primary?.gramcat) {
          data.collins_primary.gramcat.forEach((cat: any) => {
               const pos = safeString(cat.partofspeech);
               const forms = normalizeForms(cat.forms || []); 
               
               if (cat.audiences) {
                   cat.audiences.forEach((aud: any) => {
                       if (aud.senses) {
                           aud.senses.forEach((sense: any) => {
                               const defCn = safeString(sense.chn_tran);
                               const defEn = safeString(sense.def);
                               
                               const exObj = sense.examples?.[0];
                               const example = exObj ? safeString(exObj.ex) : '';
                               const exampleTrans = exObj ? safeString(exObj.tran) : '';
                               
                               const star = data.collins?.collins_entries?.[0]?.star || 0;
                               
                               if (defCn || defEn) {
                                   meanings.push({
                                       partOfSpeech: pos,
                                       defCn,
                                       defEn,
                                       inflections: forms,
                                       tags: globalTags,
                                       importance: typeof star === 'number' ? star : 0,
                                       cocaRank,
                                       example,
                                       exampleTrans
                                   });
                               }
                           });
                       }
                   });
               }
          });
      }
      
      // Strategy B: Expand EC (Fallback or Complement)
      if (meanings.length === 0 && data.expand_ec?.word) {
          data.expand_ec.word.forEach((w: any) => {
              const pos = safeString(w.pos);
              const wfs = w.wfs ? w.wfs.map((x: any) => safeString(x.wf)).filter((s: string) => s) : [];
              
              if (w.transList) {
                  w.transList.forEach((tr: any) => {
                      const defCn = safeString(tr.content) || safeString(tr.trans);
                      let example = '';
                      let exampleTrans = '';
                      
                      if (defCn) {
                        meanings.push({
                            partOfSpeech: pos,
                            defCn,
                            defEn: '', 
                            inflections: wfs,
                            tags: globalTags,
                            importance: 0,
                            cocaRank,
                            example,
                            exampleTrans
                        });
                      }
                  });
              }
          });
      }

      // Strategy C: Basic EC (Last Resort)
      if (meanings.length === 0 && data.ec?.word?.[0]?.trs) {
           data.ec.word[0].trs.forEach((tr: any) => {
               const raw = safeString(tr.tr?.[0]?.l?.i?.[0]);
               if (raw) {
                   meanings.push({
                       partOfSpeech: '',
                       defCn: raw,
                       defEn: '',
                       inflections: [],
                       tags: globalTags,
                       importance: 0,
                       cocaRank,
                       example: '',
                       exampleTrans: ''
                   });
               }
           });
      }

      // Post-Processing: Fill missing examples from global `blng_sents_part` if available
      if (data.blng_sents_part?.['sentence-pair']) {
          const globalExs = data.blng_sents_part['sentence-pair'];
          let exIndex = 0;
          meanings.forEach(m => {
              if (!m.example && exIndex < globalExs.length) {
                  m.example = safeString(globalExs[exIndex].sentence);
                  m.exampleTrans = safeString(globalExs[exIndex]['sentence-translation']);
                  exIndex++;
              }
          });
      }

      return {
          text: safeString(data.simple?.word?.[0]?.['return-phrase'] || data.input),
          phoneticUs,
          phoneticUk,
          inflections,
          phrases,
          roots,
          synonyms,
          picUrl,
          video,
          meanings
      };
  };

  // --- 3. Fetch Dictionary Logic ---
  const fetchAndParse = async (word: string): Promise<RichDictionaryResult | null> => {
      const allDicts = await dictionariesStorage.getValue();
      const enabledDicts = allDicts.filter(d => d.isEnabled).sort((a, b) => a.priority - b.priority);
      
      const cocaPromise = fetchCocaRank(word);

      for (const dict of enabledDicts) {
          try {
              if (dict.id === 'youdao') {
                  const res = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`);
                  if (res.ok) {
                      const data = await res.json();
                      const cocaRank = await cocaPromise;
                      return parseYoudaoDeep(data, cocaRank);
                  }
              }
          } catch (e) {
              console.warn(`Dict ${dict.name} error`, e);
          }
      }
      return null;
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRANSLATE_TEXT') {
      (async () => {
        try {
          if (message.engine.id === 'tencent') {
             const result = await callTencentTranslation(message.engine, message.text, message.target);
             sendResponse({ success: true, data: result });
          } else {
             sendResponse({ success: true, data: { Response: { TargetText: `Simulated: ${message.text}` } } });
          }
        } catch (error: any) {
          sendResponse({ success: false, error: error.message || String(error) });
        }
      })();
      return true; 
    }

    if (message.action === 'LOOKUP_WORD_RICH') {
      (async () => {
        try {
          const result = await fetchAndParse(message.text);
          if (result) {
              sendResponse({ success: true, data: result });
          } else {
              sendResponse({ success: false, error: "No data found" });
          }
        } catch (error: any) {
          console.error('Lookup Error:', error);
          sendResponse({ success: false, error: error.message || String(error) });
        }
      })();
      return true;
    }
  });
});
