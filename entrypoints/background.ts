
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
      
      // If it's an object, try to extract known text-bearing properties to avoid [object Object]
      if (typeof input === 'object') {
          const candidates = [
              input.value, 
              input.text, 
              input.examType, 
              input.word, 
              input.headword, 
              input.tran,
              input.translation,
              input.def,
              input.content,
              input.sentOrig,
              input.sentTrans
          ];
          for (const c of candidates) {
              if (c && typeof c === 'string') return c;
          }
          return '';
      }
      return '';
  };

  // --- Helpers ---
  const normalizeTags = (tags: any): string[] => {
      if (!Array.isArray(tags)) return [];
      return tags.map(t => safeString(t)).filter(t => t.trim().length > 0);
  };

  const normalizeForms = (forms: any): string[] => {
      if (!Array.isArray(forms)) return [];
      return forms.map(f => safeString(f)).filter(f => f.trim().length > 0);
  };

  // --- 1. Fetch COCA Rank (Stub) ---
  const fetchCocaRank = async (word: string): Promise<number> => {
      // User requested to leave this empty/manual for now.
      return 0;
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

      // 2. Public Info: Inflections
      // Prefer collins_primary for base forms, but wfs is often more comprehensive for simple conjugation
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

      // 3. Phrases (phrs)
      const phrases: { text: string; trans: string }[] = [];
      if (data.phrs?.phrs) {
          data.phrs.phrs.forEach((p: any) => {
              const text = safeString(p.headword);
              const trans = safeString(p.translation);
              if (text && trans) phrases.push({ text, trans });
          });
      }

      // 4. Roots (rel_word)
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

      // 5. Synonyms (syno)
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

      // 6. Pictures (pic_dict - fetch all)
      const images: string[] = [];
      if (data.pic_dict?.pic) {
          data.pic_dict.pic.forEach((p: any) => {
              const url = safeString(p.image);
              if (url) images.push(url);
          });
      }

      // 7. Video (word_video)
      let video = undefined;
      if (data.word_video?.video?.[0]) {
          const v = data.word_video.video[0];
          const url = safeString(v.url);
          const cover = safeString(v.cover);
          const title = safeString(v.title);
          if (url) {
              video = { title: title || '讲解视频', url, cover };
          }
      }

      // 8. Meaning Cards - Logic: Collins PRIMARY, fallback ExpandEC
      const meanings: DictionaryMeaningCard[] = [];
      const globalTags = normalizeTags(data.ec?.exam_type || []); // Global exams
      
      // --- Logic A: Collins Primary ---
      // We look for valid content here first.
      if (data.collins_primary?.gramcat && data.collins_primary.gramcat.length > 0) {
          const star = data.collins?.collins_entries?.[0]?.star || 0;
          
          data.collins_primary.gramcat.forEach((cat: any) => {
               const pos = safeString(cat.partofspeech);
               // Specific forms for this meaning, sometimes different from global
               const forms = normalizeForms(cat.forms || []); 
               
               if (cat.audiences) {
                   cat.audiences.forEach((aud: any) => {
                       if (aud.senses) {
                           aud.senses.forEach((sense: any) => {
                               // PATH: collins_primary.gramcat[0].senses[0].word (or chn_tran)
                               let defCn = safeString(sense.word); 
                               // Fallback if 'word' is empty (rare in this structure) or looks like English (headword repetition)
                               if (!defCn || /^[a-zA-Z\s-]+$/.test(defCn)) {
                                   defCn = safeString(sense.chn_tran);
                               }
                               
                               // PATH: collins_primary.gramcat[0].senses[0].definition
                               const defEn = safeString(sense.definition);
                               
                               // PATH: collins_primary.gramcat[0].senses[0].examples[0].example
                               const exObj = sense.examples?.[0];
                               const example = exObj ? safeString(exObj.ex) : '';
                               
                               // PATH: collins_primary.gramcat[0].senses[0].examples[0].sense.word (User Request)
                               // Standard is exObj.tran. We try User path, then Standard.
                               let exampleTrans = '';
                               if (exObj) {
                                  // User specific path attempt:
                                  exampleTrans = safeString(exObj.sense?.word); 
                                  if (!exampleTrans) {
                                      // Standard Youdao path
                                      exampleTrans = safeString(exObj.tran);
                                  }
                               }

                               // Only add if we have at least a definition
                               if (defCn || defEn) {
                                   meanings.push({
                                       partOfSpeech: pos,
                                       defCn,
                                       defEn,
                                       inflections: forms.length > 0 ? forms : inflections, // Use specific forms if avail
                                       tags: globalTags,
                                       importance: typeof star === 'number' ? star : 0,
                                       cocaRank: 0, // Default 0, user fills
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

      // --- Logic B: Expand EC (Fallback) ---
      // ONLY if meanings is empty (Collins didn't yield results)
      if (meanings.length === 0 && data.expand_ec?.word) {
          data.expand_ec.word.forEach((w: any) => {
              const pos = safeString(w.pos);
              const wfs = w.wfs ? w.wfs.map((x: any) => safeString(x.wf)).filter((s: string) => s) : [];
              
              if (w.transList) {
                  w.transList.forEach((tr: any) => {
                      // PATH: expand_ec.word[0].transList[0].trans
                      const defCn = safeString(tr.trans) || safeString(tr.content);
                      const defEn = ''; // User said leave empty if not found

                      // PATH: expand_ec.word[0].transList[0].content.sents[0].sentOrig
                      const sentObj = tr.content?.sents?.[0];
                      const example = sentObj ? safeString(sentObj.sentOrig) : '';
                      
                      // PATH: expand_ec.word[0].transList[0].content.sents[0].sentTrans
                      const exampleTrans = sentObj ? safeString(sentObj.sentTrans) : '';

                      if (defCn) {
                        meanings.push({
                            partOfSpeech: pos,
                            defCn,
                            defEn, 
                            inflections: wfs.length > 0 ? wfs : inflections,
                            tags: globalTags,
                            importance: 0,
                            cocaRank: 0, // Default 0
                            example,
                            exampleTrans
                        });
                      }
                  });
              }
          });
      }
      
      // Fallback C: If absolutely nothing found, try basic 'ec'
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
                       cocaRank: 0,
                       example: '',
                       exampleTrans: ''
                   });
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
          images,
          video,
          meanings
      };
  };

  // --- 3. Fetch Dictionary Logic ---
  const fetchAndParse = async (word: string): Promise<RichDictionaryResult | null> => {
      // Force Youdao priority for this rich modal
      const dictionaries = await dictionariesStorage.getValue();
      const youdao = dictionaries.find(d => d.id === 'youdao' && d.isEnabled) || dictionaries.find(d => d.id === 'youdao');

      if (youdao) {
          try {
              const res = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`);
              if (res.ok) {
                  const data = await res.json();
                  const cocaRank = await fetchCocaRank(word); // Likely 0
                  return parseYoudaoDeep(data, cocaRank);
              }
          } catch (e) {
              console.warn(`Dict Youdao error`, e);
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
