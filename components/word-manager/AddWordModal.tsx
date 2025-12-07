

import React, { useState, useEffect } from 'react';
import { Loader2, Wand2, Volume2, Save, X, Search, Image as ImageIcon, Video, Layers, Hash, BarChart2, Star, Youtube, ExternalLink, Book } from 'lucide-react';
import { WordEntry, RichDictionaryResult, DictionaryMeaningCard, WordCategory } from '../../types';
import { fetchRichWordDetails } from '../../utils/dictionary-service';
import { playWordAudio } from '../../utils/audio';

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entryData: Partial<WordEntry>) => Promise<void>;
}

export const AddWordModal: React.FC<AddWordModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<RichDictionaryResult | null>(null);
  
  // Selection state: indices of meanings selected
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Editable COCA ranks (keyed by meaning index)
  const [editableCocaRanks, setEditableCocaRanks] = useState<Record<number, string>>({});

  useEffect(() => {
      if(!isOpen) {
          setInputText('');
          setSearchResult(null);
          setSelectedIndices(new Set());
          setEditableCocaRanks({});
      }
  }, [isOpen]);

  const handleLookup = async () => {
      if (!inputText.trim()) return;
      setIsSearching(true);
      setSearchResult(null);
      setSelectedIndices(new Set());
      setEditableCocaRanks({});
      try {
          const result = await fetchRichWordDetails(inputText.trim());
          setSearchResult(result);
          // Default select the first meaning
          if (result.meanings.length > 0) setSelectedIndices(new Set([0]));
          
          // Initialize COCA edits with 0 or empty
          const initialCoca: Record<number, string> = {};
          result.meanings.forEach((m, idx) => {
              initialCoca[idx] = m.cocaRank > 0 ? String(m.cocaRank) : '';
          });
          setEditableCocaRanks(initialCoca);

      } catch (e) {
          console.error(e);
          alert('查询失败，未找到单词信息');
      } finally {
          setIsSearching(false);
      }
  };

  const handleToggleCard = (index: number) => {
      const newSet = new Set(selectedIndices);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      setSelectedIndices(newSet);
  };

  const handleCocaChange = (index: number, val: string) => {
      setEditableCocaRanks(prev => ({ ...prev, [index]: val }));
  };

  const handleImport = async () => {
      if (!searchResult) return;
      const promises: Promise<void>[] = [];
      
      selectedIndices.forEach(idx => {
          const card = searchResult.meanings[idx];
          const cocaVal = parseInt(editableCocaRanks[idx]) || 0;
          
          const entry: Partial<WordEntry> = {
              text: searchResult.text,
              phoneticUk: searchResult.phoneticUk,
              phoneticUs: searchResult.phoneticUs,
              
              translation: card.defCn,
              englishDefinition: card.defEn,
              
              // Merge common inflections with specific ones
              inflections: [...new Set([...searchResult.inflections, ...card.inflections])],
              
              dictionaryExample: card.example,
              dictionaryExampleTranslation: card.exampleTrans,
              
              tags: card.tags,
              importance: card.importance,
              cocaRank: cocaVal,
              
              // Defaults
              category: WordCategory.WantToLearnWord,
              addedAt: Date.now() + idx, // offset slightly to keep order
              scenarioId: '1' 
          };
          promises.push(onConfirm(entry));
      });

      await Promise.all(promises);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Header / Search Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex gap-4 items-center shrink-0">
                <div className="relative flex-1">
                    <input 
                       type="text" 
                       className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-lg font-bold text-slate-800"
                       placeholder="输入英文单词..."
                       value={inputText}
                       onChange={e => setInputText(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleLookup()}
                       autoFocus
                    />
                    <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <button 
                   onClick={handleLookup}
                   disabled={isSearching || !inputText}
                   className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                   {isSearching ? <Loader2 className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5"/>}
                   查询
                </button>
                <div className="w-px h-8 bg-slate-300 mx-2"></div>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-6 h-6"/></button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-6 custom-scrollbar">
                {!searchResult && !isSearching && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p>输入单词开始检索详细信息</p>
                    </div>
                )}

                {searchResult && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        {/* 1. Public Info Panel */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Left: Basic Info */}
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-4 mb-2">
                                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{String(searchResult.text)}</h2>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 font-mono">
                                            {searchResult.phoneticUk && (
                                                <span className="flex items-center cursor-pointer hover:text-blue-600 transition" onClick={() => playWordAudio(searchResult.text, 'UK')}>
                                                    <span className="text-[10px] mr-1 text-slate-400 font-sans">UK</span> {String(searchResult.phoneticUk)} <Volume2 className="w-3.5 h-3.5 ml-1 opacity-50"/>
                                                </span>
                                            )}
                                            {searchResult.phoneticUs && (
                                                <span className="flex items-center cursor-pointer hover:text-blue-600 transition" onClick={() => playWordAudio(searchResult.text, 'US')}>
                                                    <span className="text-[10px] mr-1 text-slate-400 font-sans">US</span> {String(searchResult.phoneticUs)} <Volume2 className="w-3.5 h-3.5 ml-1 opacity-50"/>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inflections */}
                                    {searchResult.inflections.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {searchResult.inflections.map(f => (
                                                <span key={String(f)} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600">{String(f)}</span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Roots / Phrases / Synonyms Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        {/* Phrases */}
                                        {searchResult.phrases.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">常用短语 (Phrases)</span>
                                                <div className="flex flex-col gap-1.5">
                                                    {searchResult.phrases.slice(0, 8).map((p, i) => (
                                                        <div key={i} className="text-xs flex gap-2">
                                                            <span className="font-medium text-slate-700">{String(p.text)}</span>
                                                            <span className="text-slate-500 truncate">{String(p.trans)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Synonyms */}
                                        {searchResult.synonyms.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">近义词 (Synonyms)</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {searchResult.synonyms.slice(0, 10).map((s, i) => (
                                                        <div key={i} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded" title={String(s.trans)}>
                                                            <span className="text-slate-600">{String(s.text)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Roots (New) */}
                                    {searchResult.roots.length > 0 && (
                                        <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">词根 (Roots)</span>
                                            <div className="space-y-2">
                                                {searchResult.roots.map((r, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className="font-mono text-blue-600 font-bold mr-2">{String(r.root)}</span>
                                                        <span className="text-slate-500">
                                                            {r.words.map(w => String(w.text)).join(', ')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Media (Image & Video) */}
                                <div className="w-full md:w-72 shrink-0 flex flex-col gap-4">
                                    {/* Single Image Display as requested */}
                                    {searchResult.images.length > 0 && (
                                        <div className="w-full aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative group">
                                            <img src={searchResult.images[0]} alt="Word" className="w-full h-full object-cover" />
                                            {searchResult.images.length > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                                                    + {searchResult.images.length - 1} more
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Video Card */}
                                    {searchResult.video && (
                                        <div className="bg-slate-900 rounded-lg overflow-hidden relative group aspect-video flex items-center justify-center border border-slate-800 shadow-md">
                                             {searchResult.video.cover && <img src={searchResult.video.cover} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition"/>}
                                             <a href={searchResult.video.url} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center text-white">
                                                 <Youtube className="w-8 h-8 mb-1 drop-shadow-md" />
                                                 <span className="text-[10px] font-bold text-center px-2 line-clamp-1">{String(searchResult.video.title)}</span>
                                             </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. Meaning Cards Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                    <Layers className="w-4 h-4 mr-2"/>
                                    释义卡片 (Meanings)
                                </h3>
                                <span className="text-xs text-slate-400">勾选需要导入的义项</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                {searchResult.meanings.map((card, index) => (
                                    <div 
                                        key={index} 
                                        onClick={() => handleToggleCard(index)}
                                        className={`relative border-2 rounded-xl p-5 transition-all cursor-pointer group ${
                                            selectedIndices.has(index) 
                                            ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-50' 
                                            : 'bg-white border-slate-200 hover:border-blue-300 opacity-90'
                                        }`}
                                    >
                                        <div className="absolute top-4 right-4 z-10">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIndices.has(index)} 
                                                readOnly
                                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer pointer-events-none"
                                            />
                                        </div>

                                        <div className="pr-8">
                                            {/* Definition */}
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="font-serif font-bold text-xl text-slate-900">{String(card.partOfSpeech)}</span>
                                                <span className="text-lg text-slate-800">{String(card.defCn)}</span>
                                            </div>
                                            {card.defEn && <p className="text-sm text-slate-500 mb-3 font-medium">{String(card.defEn)}</p>}
                                            
                                            {/* Meta tags & Editable COCA */}
                                            <div className="flex flex-wrap gap-3 mb-4 items-center">
                                                {card.importance > 0 && (
                                                    <span className="flex items-center px-2 py-1 rounded text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100" title="Collins Level">
                                                        <Star className="w-3 h-3 mr-1 fill-current"/> {String(card.importance)} 星
                                                    </span>
                                                )}
                                                
                                                {/* COCA Input */}
                                                <div 
                                                    className="flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100"
                                                    onClick={(e) => e.stopPropagation()} // Prevent card toggle when typing
                                                >
                                                    <BarChart2 className="w-3 h-3 mr-1"/> 
                                                    <span className="mr-1">COCA:</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder="0"
                                                        value={editableCocaRanks[index] || ''}
                                                        onChange={(e) => handleCocaChange(index, e.target.value)}
                                                        className="w-12 bg-transparent border-b border-blue-200 text-center text-blue-700 focus:outline-none focus:border-blue-500 text-xs"
                                                    />
                                                </div>

                                                {card.tags.map(t => (
                                                    <span key={String(t)} className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
                                                        {String(t)}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Example */}
                                            {card.example && (
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-sm group/ex">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-slate-700 font-medium italic mb-1 leading-relaxed">{String(card.example)}</p>
                                                        <button 
                                                            className="text-slate-400 hover:text-blue-500 opacity-0 group-hover/ex:opacity-100 transition"
                                                            onClick={(e) => { e.stopPropagation(); playWordAudio(card.example, 'US'); }}
                                                            title="朗读例句"
                                                        >
                                                            <Volume2 className="w-3.5 h-3.5"/>
                                                        </button>
                                                    </div>
                                                    <p className="text-slate-500 text-xs">{String(card.exampleTrans)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="text-sm text-slate-500">
                    {selectedIndices.size > 0 ? `已选择 ${selectedIndices.size} 个义项` : '请选择至少一个义项'}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition">
                        取消
                    </button>
                    <button 
                        onClick={handleImport}
                        disabled={selectedIndices.size === 0} 
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md shadow-blue-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <Save className="w-4 h-4 mr-2" /> 确认导入
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
