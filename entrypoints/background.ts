
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

  // --- 1. Fetch COCA Rank (Separate Request) ---
  const fetchCocaRank = async (word: string): Promise<number> => {
      try {
          // Placeholder for real COCA source. 
          // Youdao sometimes returns 'rank' in ec/collins but COCA is distinct.
          // If the user configures a proxy for COCA, it would go here.
          // For now, returning 0 to act as "not found" or "no API configured".
          // Example: const res = await fetch(`https://some-coca-api.com/${word}`);
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
          phoneticUs = simpleWord['usphone'] ? `/${simpleWord['usphone']}/` : '';
          phoneticUk = simpleWord['ukphone'] ? `/${simpleWord['ukphone']}/` : '';
      } else if (ecWord) {
          phoneticUs = ecWord['usphone'] ? `/${ecWord['usphone']}/` : '';
          phoneticUk = ecWord['ukphone'] ? `/${ecWord['ukphone']}/` : '';
      }

      // 2. Public Info
      // Inflections
      let inflections: string[] = [];
      if (data.collins_primary?.words?.indexforms) {
           inflections = data.collins_primary.words.indexforms;
      } else if (data.wfs) {
           data.wfs.forEach((item: any) => { if (item.wf?.value) inflections.push(item.wf.value); });
      }

      // Phrases
      const phrases: { text: string; trans: string }[] = [];
      if (data.phrs?.phrs) {
          data.phrs.phrs.forEach((p: any) => {
              if (p.headword && p.translation) phrases.push({ text: p.headword, trans: p.translation });
          });
      }

      // Roots (Rel Word)
      const roots: { root: string; words: { text: string; trans: string }[] }[] = [];
      if (data.rel_word?.rels) {
          data.rel_word.rels.forEach((rel: any) => {
              const rootWords: { text: string; trans: string }[] = [];
              if (rel.rel?.words) {
                   rel.rel.words.forEach((w: any) => {
                       if (w.word && w.tran) rootWords.push({ text: w.word, trans: w.tran });
                   });
              }
              if (rootWords.length > 0) {
                  roots.push({ root: rel.rel?.pos || 'Root', words: rootWords });
              }
          });
      }

      // Synonyms
      const synonyms: { text: string; trans: string }[] = [];
      if (data.syno?.synos) {
          data.syno.synos.forEach((group: any) => {
              if (group.ws) {
                  group.ws.forEach((w: any) => {
                       if (w.w && w.tran) synonyms.push({ text: w.w, trans: w.tran });
                  });
              }
          });
      }

      // Picture
      const picUrl = data.pic_dict?.pic?.[0]?.image || undefined;

      // Video
      let video = undefined;
      if (data.word_video?.video?.[0]) {
          const v = data.word_video.video[0];
          if (v.url && v.cover) {
              video = { title: v.title || 'Video', url: v.url, cover: v.cover };
          }
      }

      // 3. Meaning Cards
      const meanings: DictionaryMeaningCard[] = [];
      
      // Strategy A: Collins Primary (High Quality)
      if (data.collins_primary?.gramcat) {
          data.collins_primary.gramcat.forEach((cat: any) => {
               const pos = cat.partofspeech || '';
               const forms = cat.forms || []; // Specific forms for this meaning
               
               if (cat.audiences) {
                   cat.audiences.forEach((aud: any) => {
                       if (aud.senses) {
                           aud.senses.forEach((sense: any) => {
                               const defCn = sense.chn_tran || '';
                               const defEn = sense.def || '';
                               const exObj = sense.examples?.[0];
                               const example = exObj?.ex || '';
                               const exampleTrans = exObj?.tran || '';
                               
                               // Collins star
                               const star = data.collins?.collins_entries?.[0]?.star || 0;
                               
                               meanings.push({
                                   partOfSpeech: pos,
                                   defCn,
                                   defEn,
                                   inflections: forms,
                                   tags: data.ec?.exam_type || [],
                                   importance: star,
                                   cocaRank,
                                   example,
                                   exampleTrans
                               });
                           });
                       }
                   });
               }
          });
      }
      
      // Strategy B: Expand EC (Fallback or Complement)
      if (meanings.length === 0 && data.expand_ec?.word) {
          data.expand_ec.word.forEach((w: any) => {
              const pos = w.pos || '';
              // Specific forms in expand_ec?
              const wfs = w.wfs ? w.wfs.map((x: any) => x.wf?.value).filter(Boolean) : [];
              
              if (w.transList) {
                  w.transList.forEach((tr: any) => {
                      const defCn = tr.content || tr.trans || '';
                      
                      // Try to match an example from global examples (blng_sents_part) that matches this meaning keyword
                      // Simplified: Just grab the first bilingual sentence not used yet, or empty
                      // Ideally we'd search data.blng_sents_part
                      let example = '';
                      let exampleTrans = '';

                      // Try to find an example in the same POS group? 
                      // expand_ec doesn't nest examples well. We'll use a placeholder.
                      
                      meanings.push({
                          partOfSpeech: pos,
                          defCn,
                          defEn: '', // expand_ec often lacks EN defs per meaning
                          inflections: wfs,
                          tags: data.ec?.exam_type || [],
                          importance: 0,
                          cocaRank,
                          example,
                          exampleTrans
                      });
                  });
              }
          });
      }

      // Strategy C: Basic EC (Last Resort)
      if (meanings.length === 0 && data.ec?.word?.[0]?.trs) {
           data.ec.word[0].trs.forEach((tr: any) => {
               const raw = tr.tr?.[0]?.l?.i?.[0] || "";
               meanings.push({
                   partOfSpeech: '',
                   defCn: raw,
                   defEn: '',
                   inflections: [],
                   tags: data.ec?.exam_type || [],
                   importance: 0,
                   cocaRank,
                   example: '',
                   exampleTrans: ''
               });
           });
      }

      // Post-Processing: Fill missing examples from global `blng_sents_part` if available
      if (data.blng_sents_part?.['sentence-pair']) {
          const globalExs = data.blng_sents_part['sentence-pair'];
          let exIndex = 0;
          meanings.forEach(m => {
              if (!m.example && exIndex < globalExs.length) {
                  m.example = globalExs[exIndex].sentence;
                  m.exampleTrans = globalExs[exIndex]['sentence-translation'];
                  exIndex++;
              }
          });
      }

      return {
          text: data.simple?.word?.[0]?.['return-phrase'] || data.input || "",
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
              // Add other dict handlers (ICBA) here if needed, similar logic
              // For brevity, defaulting to Youdao as it has the rich structure requested.
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
