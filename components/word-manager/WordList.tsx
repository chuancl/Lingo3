
import React from 'react';
import { WordEntry, WordCategory, MergeStrategyConfig, WordTab } from '../../types';
import { PlayCircle, MapPin, ExternalLink, Filter } from 'lucide-react';
import { playTextToSpeech } from '../../utils/audio';

interface WordListProps {
    groupedEntries: WordEntry[][];
    selectedWords: Set<string>;
    toggleSelectGroup: (group: WordEntry[]) => void;
    isGroupSelected: (group: WordEntry[]) => boolean;
    showConfig: { showPhonetic: boolean; showMeaning: boolean; };
    mergeConfig: MergeStrategyConfig;
    isAllWordsTab: boolean;
    searchQuery: string;
    ttsSpeed?: number;
}

export const WordList: React.FC<WordListProps> = ({ 
    groupedEntries, selectedWords, toggleSelectGroup, isGroupSelected,
    showConfig, mergeConfig, isAllWordsTab, searchQuery, ttsSpeed = 1.0 
}) => {
    
    if (groupedEntries.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
             <Filter className="w-12 h-12 text-slate-200 mb-3" />
             <p>{searchQuery ? '无匹配搜索结果' : '暂无符合条件的单词'}</p>
          </div>
        );
    }

    return (
        <div className="space-y-4">
          {groupedEntries.map(group => {
            const primary = group[0];
            const uniqueTranslations = Array.from(new Set(group.map(e => e.translation?.trim()).filter(Boolean)));
            const displayTranslation = uniqueTranslations.join('; ');
            
            // Find valid inflections from any word in the group
            const displayInflections = group.find(e => e.inflections && e.inflections.length > 0)?.inflections;

            return (
              <div key={primary.id} className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all p-5 flex gap-4 group ${isGroupSelected(group) ? 'border-blue-300 bg-blue-50/10' : 'border-slate-200'}`}>
                <div className="pt-1.5">
                    <input 
                      type="checkbox" 
                      checked={isGroupSelected(group)}
                      onChange={() => toggleSelectGroup(group)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    />
                </div>

                <div className="flex-1 space-y-4">
                    {/* Header Row: Flex container */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      
                      {/* Left: Word, Phonetic, Meaning */}
                      <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{primary.text}</h3>
                          
                          {showConfig.showPhonetic && (primary.phoneticUs || primary.phoneticUk) && (
                            <div className="flex items-center text-sm text-slate-500 space-x-3 font-mono bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              {primary.phoneticUs && (
                                  <span 
                                      className="flex items-center cursor-pointer hover:text-blue-600 transition select-none mr-2" 
                                      title="点击播放美式发音"
                                      onClick={(e) => { e.stopPropagation(); playTextToSpeech(primary.text, 'US', ttsSpeed); }}
                                  >
                                      <span className="text-[10px] mr-1 text-slate-400 font-sans">US</span> 
                                      {primary.phoneticUs} 
                                      <PlayCircle className="w-3.5 h-3.5 ml-1 opacity-50 group-hover:opacity-100"/>
                                  </span>
                              )}
                              {primary.phoneticUk && (
                                  <span 
                                      className="flex items-center cursor-pointer hover:text-blue-600 transition select-none" 
                                      title="点击播放英式发音"
                                      onClick={(e) => { e.stopPropagation(); playTextToSpeech(primary.text, 'UK', ttsSpeed); }}
                                  >
                                      <span className="text-[10px] mr-1 text-slate-400 font-sans">UK</span> 
                                      {primary.phoneticUk} 
                                      <PlayCircle className="w-3.5 h-3.5 ml-1 opacity-50 group-hover:opacity-100"/>
                                  </span>
                              )}
                            </div>
                          )}
                          
                          {/* Meaning Displayed Inline Next to Phonetic */}
                          {showConfig.showMeaning && displayTranslation && (
                            <div className="text-slate-700 font-medium px-3 py-1 bg-amber-50 text-amber-900 rounded-lg border border-amber-100 text-sm">
                              {displayTranslation}
                              {group.length > 1 && mergeConfig.strategy === 'by_word' && (
                                <span className="ml-2 text-xs text-amber-700/60 font-normal">({group.length})</span>
                              )}
                            </div>
                          )}
                      </div>

                      {/* Right: Badge (Always visible on far right) */}
                      <div className="ml-auto sm:ml-0 self-start sm:self-center">
                           <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                             primary.category === WordCategory.KnownWord ? 'bg-green-50 text-green-700 border-green-200' :
                             primary.category === WordCategory.WantToLearnWord ? 'bg-amber-50 text-amber-700 border-amber-200' :
                             'bg-red-50 text-red-700 border-red-200'
                           }`}>
                             {primary.category}
                           </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                       {mergeConfig.exampleOrder.filter(item => item.enabled).map(item => {
                          return (
                            <React.Fragment key={item.id}>
                               {/* Special Case: Inflections (Morphology) - Show ONCE per group using the best available data */}
                               {item.id === 'inflections' && displayInflections && displayInflections.length > 0 && (
                                   <div 
                                      key={`${primary.id}-inflections`}
                                      className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 relative"
                                   >
                                      <div className="absolute left-0 top-3 w-1 h-8 bg-orange-400 rounded-r"></div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 pl-2">词态变化 (Morphology)</span>
                                      <div className="flex flex-wrap gap-2 pl-2">
                                          {displayInflections.map(inf => (
                                              <span key={inf} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 font-mono">
                                                  {inf}
                                              </span>
                                          ))}
                                      </div>
                                   </div>
                               )}

                               {group.map((entry, idx) => {
                                  // For normal sentences, apply multi-example limits
                                  if (item.id === 'inflections') return null; // Already handled above
                                  if (!mergeConfig.showMultiExamples && idx > 0) return null;

                                  if (item.id === 'context' && entry.contextSentence) {
                                    return (
                                      <div 
                                        key={`${entry.id}-context`} 
                                        className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 relative group/ctx cursor-pointer hover:bg-slate-100 transition"
                                        onClick={(e) => { e.stopPropagation(); playTextToSpeech(entry.contextSentence!, 'US', ttsSpeed); }}
                                        title="点击朗读例句"
                                      >
                                        <div className="absolute left-0 top-3 w-1 h-8 bg-blue-500 rounded-r"></div>
                                        {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 pl-2">来源原句 (Context)</span>}
                                        <p className="text-sm text-slate-700 leading-relaxed pl-2 mb-2">{entry.contextSentence}</p>
                                        
                                        {mergeConfig.showContextTranslation && entry.contextSentenceTranslation && (
                                            <p className="text-xs text-slate-500 pl-2 mt-1">{entry.contextSentenceTranslation}</p>
                                        )}

                                        {entry.sourceUrl && (
                                          <div className="pl-2 mt-2 pt-2 border-t border-slate-200/50 flex items-center gap-3">
                                            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center text-xs text-blue-600 hover:underline">
                                              <MapPin className="w-3 h-3 mr-1" />
                                              来源 {group.length > 1 && `#${idx + 1}`}
                                              <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                                            </a>
                                            <span className="text-[10px] text-slate-400 ml-auto">{new Date(entry.addedAt).toLocaleDateString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (item.id === 'mixed' && entry.mixedSentence) {
                                     return (
                                       <div 
                                          key={`${entry.id}-mixed`} 
                                          className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 relative cursor-pointer hover:bg-slate-100 transition"
                                          onClick={(e) => { e.stopPropagation(); playTextToSpeech(entry.mixedSentence!, 'US', ttsSpeed); }}
                                          title="点击朗读例句"
                                       >
                                          <div className="absolute left-0 top-3 w-1 h-8 bg-purple-500 rounded-r"></div>
                                         {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 pl-2">中英混合 (Mixed)</span>}
                                         <p className="text-sm text-slate-700 leading-relaxed pl-2">{entry.mixedSentence}</p>
                                       </div>
                                     );
                                  }
                                  if (item.id === 'dictionary' && entry.dictionaryExample) {
                                     return (
                                        <div 
                                            key={`${entry.id}-dictionary`} 
                                            className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 relative cursor-pointer hover:bg-slate-100 transition"
                                            onClick={(e) => { e.stopPropagation(); playTextToSpeech(entry.dictionaryExample!, 'US', ttsSpeed); }}
                                            title="点击朗读例句"
                                        >
                                          <div className="absolute left-0 top-3 w-1 h-8 bg-emerald-500 rounded-r"></div>
                                          {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 pl-2">词典例句 (Dictionary)</span>}
                                          <p className="text-sm text-slate-600 italic leading-relaxed pl-2">{entry.dictionaryExample}</p>
                                          {mergeConfig.showExampleTranslation && entry.dictionaryExampleTranslation && (
                                              <p className="text-xs text-slate-500 pl-2 mt-1">{entry.dictionaryExampleTranslation}</p>
                                          )}
                                        </div>
                                     );
                                  }

                                  return null;
                               })}
                            </React.Fragment>
                          );
                       })}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
    );
};
