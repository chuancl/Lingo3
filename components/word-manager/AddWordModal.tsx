

import React, { useState, useEffect } from 'react';
import { Loader2, Wand2, Volume2, Save, X, Search, Image as ImageIcon, Video, Layers, Hash, BarChart2, Star, Youtube, ExternalLink, Book, Edit3, ImageOff } from 'lucide-react';
import { WordEntry, RichDictionaryResult, DictionaryMeaningCard, WordCategory } from '../../types';
import { fetchRichWordDetails } from '../../utils/dictionary-service';
import { playWordAudio } from '../../utils/audio';

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entryData: Partial<WordEntry>) => Promise<void>;
}

// Internal State for Editable Cards
interface EditableCardState extends DictionaryMeaningCard {
    isSelected: boolean;
    selectedImage: string | null; // URL or null
}

export const AddWordModal: React.FC<AddWordModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<RichDictionaryResult | null>(null);
  
  const [cards, setCards] = useState<EditableCardState[]>([]);

  useEffect(() => {
      if(!isOpen) {
          setInputText('');
          setSearchResult(null);
          setCards([]);
      }
  }, [isOpen]);

  const handleLookup = async () => {
      if (!inputText.trim()) return;
      setIsSearching(true);
      setSearchResult(null);
      setCards([]);
      try {
          const result = await fetchRichWordDetails(inputText.trim());
          setSearchResult(result);
          
          // Initialize editable cards
          // Default: No image selected initially, or first available
          // User requested "can select blank", so default null is safer unless we want to be smart.
          // Let's default to null to let user choose.
          
          const initialCards: EditableCardState[] = result.meanings.map((m, idx) => ({
              ...m,
              isSelected: idx === 0, // Select first by default
              selectedImage: null 
          }));
          setCards(initialCards);

      } catch (e) {
          console.error(e);
          alert('查询失败，未找到单词信息');
      } finally {
          setIsSearching(false);
      }
  };

  const handleUpdateCard = (index: number, field: keyof EditableCardState, value: any) => {
      setCards(prev => prev.map((card, i) => i === index ? { ...card, [field]: value } : card));
  };

  const handleImport = async () => {
      if (!searchResult) return;
      const promises: Promise<void>[] = [];
      
      cards.forEach((card, idx) => {
          if (!card.isSelected) return;

          const entry: Partial<WordEntry> = {
              text: searchResult.text,
              phoneticUk: searchResult.phoneticUk,
              phoneticUs: searchResult.phoneticUs,
              
              translation: card.defCn,
              englishDefinition: card.defEn,
              
              inflections: [...new Set([...searchResult.inflections, ...card.inflections])],
              
              dictionaryExample: card.example,
              dictionaryExampleTranslation: card.exampleTrans,
              
              tags: card.tags,
              importance: card.importance,
              cocaRank: Number(card.cocaRank) || 0,
              
              image: card.selectedImage || undefined,
              video: searchResult.video, 
              
              // New Public Fields
              phrases: searchResult.phrases,
              roots: searchResult.roots,
              synonyms: searchResult.synonyms,
              
              // Defaults
              category: WordCategory.WantToLearnWord,
              addedAt: Date.now() + idx, 
              scenarioId: '1' 
          };
          promises.push(onConfirm(entry));
      });

      await Promise.all(promises);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-4 items-center shrink-0">
                <div className="relative flex-1 max-w-2xl">
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-6 custom-scrollbar">
                {!searchResult && !isSearching && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p>输入单词开始检索详细信息</p>
                    </div>
                )}

                {searchResult && (
                    <div className="space-y-6 max-w-6xl mx-auto">
                        {/* 1. Public Info Panel */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* Left: Word Basic & Public Data */}
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-4 mb-2">
                                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{String(searchResult.text)}</h2>
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                                        {/* Phrases */}
                                        {searchResult.phrases.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">常用短语 (Phrases)</span>
                                                <div className="flex flex-col gap-1.5">
                                                    {searchResult.phrases.map((p, i) => (
                                                        <div key={i} className="text-xs flex gap-2">
                                                            <span className="font-medium text-slate-700">{String(p.text)}</span>
                                                            <span className="text-slate-500 truncate">{String(p.trans)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Roots */}
                                        {searchResult.roots.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">词根 (Roots)</span>
                                                <div className="space-y-2">
                                                    {searchResult.roots.map((r, i) => (
                                                        <div key={i} className="text-xs">
                                                            <span className="text-slate-400 font-mono block mb-0.5">{String(r.root)}</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {r.words.map((w, wi) => (
                                                                    <span key={wi} className="bg-white border px-1 rounded text-[10px] text-slate-600" title={String(w.trans)}>{String(w.text)}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Synonyms */}
                                        {searchResult.synonyms.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">近义词 (Synonyms)</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {searchResult.synonyms.map((s, i) => (
                                                        <div key={i} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded" title={String(s.trans)}>
                                                            <span className="text-slate-600">{String(s.text)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Right: Video (If available) */}
                                {searchResult.video && (
                                    <div className="w-full lg:w-80 shrink-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">视频讲解</span>
                                        <div className="bg-slate-900 rounded-lg overflow-hidden relative group aspect-video flex items-center justify-center border border-slate-800 shadow-md">
                                             {searchResult.video.cover && <img src={searchResult.video.cover} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition"/>}
                                             <a href={searchResult.video.url} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center text-white">
                                                 <Youtube className="w-10 h-10 mb-2 drop-shadow-md text-red-600" />
                                                 <span className="text-xs font-bold text-center px-4 line-clamp-2">{String(searchResult.video.title)}</span>
                                             </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Editable Meaning Cards */}
                        <div>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                    <Layers className="w-4 h-4 mr-2"/>
                                    释义卡片 (Select & Edit)
                                </h3>
                                <div className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                    选中卡片后可直接编辑内容
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6">
                                {cards.map((card, index) => (
                                    <div 
                                        key={index} 
                                        className={`relative border-2 rounded-xl transition-all group ${
                                            card.isSelected 
                                            ? 'bg-white border-blue-500 shadow-lg ring-1 ring-blue-50' 
                                            : 'bg-white border-slate-200 opacity-90 hover:border-blue-300'
                                        }`}
                                    >
                                        {/* Selection Checkbox */}
                                        <div 
                                            className="absolute top-4 left-4 z-10"
                                            onClick={() => handleUpdateCard(index, 'isSelected', !card.isSelected)}
                                        >
                                            <div className={`w-6 h-6 rounded border flex items-center justify-center cursor-pointer transition-colors ${card.isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}`}>
                                                {card.isSelected && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-white -rotate-45 mb-0.5"></div>}
                                            </div>
                                        </div>

                                        <div className="pl-14 pr-6 py-6">
                                            {/* Top Row: POS, Definition, Star, COCA */}
                                            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                                                <div className="flex-1 space-y-4">
                                                     {/* Word & POS */}
                                                     <div className="flex items-center gap-2">
                                                         <span className="font-serif font-bold text-xl text-slate-400 w-12 text-center bg-slate-50 rounded py-1 border border-slate-100">{String(card.partOfSpeech)}</span>
                                                         
                                                         {/* Editable Definition (CN) */}
                                                         <div className="flex-1 relative group/input">
                                                             <input 
                                                                 type="text" 
                                                                 value={card.defCn} 
                                                                 onChange={(e) => handleUpdateCard(index, 'defCn', e.target.value)}
                                                                 className="w-full text-lg font-bold text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-500 focus:ring-0 px-1 py-0.5 bg-transparent"
                                                                 placeholder="中文释义"
                                                             />
                                                             <Edit3 className="w-3 h-3 text-slate-300 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 pointer-events-none"/>
                                                         </div>
                                                     </div>

                                                     {/* Editable Definition (EN) */}
                                                     <div className="relative group/input">
                                                         <input 
                                                             type="text" 
                                                             value={card.defEn}
                                                             onChange={(e) => handleUpdateCard(index, 'defEn', e.target.value)}
                                                             className="w-full text-sm text-slate-600 border-b border-dashed border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-1 py-0.5 bg-transparent"
                                                             placeholder="English Definition (Optional)"
                                                         />
                                                         <Edit3 className="w-3 h-3 text-slate-300 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 pointer-events-none"/>
                                                     </div>
                                                </div>

                                                {/* Meta Controls */}
                                                <div className="flex flex-row lg:flex-col gap-3 min-w-[200px]">
                                                    {/* Editable Importance (Star) */}
                                                    <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                                        <span className="text-xs font-bold text-amber-700 uppercase">柯林斯星级</span>
                                                        <div className="flex ml-auto">
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <Star 
                                                                    key={star} 
                                                                    className={`w-4 h-4 cursor-pointer transition-colors ${star <= card.importance ? 'fill-amber-400 text-amber-400' : 'text-amber-200'}`}
                                                                    onClick={() => handleUpdateCard(index, 'importance', star === card.importance ? 0 : star)} 
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Editable COCA */}
                                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                        <span className="text-xs font-bold text-blue-700 uppercase">COCA 排名</span>
                                                        <input 
                                                            type="number" 
                                                            value={card.cocaRank || ''}
                                                            onChange={(e) => handleUpdateCard(index, 'cocaRank', parseInt(e.target.value))}
                                                            placeholder="-"
                                                            className="w-16 ml-auto bg-white border border-blue-200 rounded text-center text-sm text-blue-800 focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Middle Row: Example */}
                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 mb-6">
                                                <div className="mb-2 flex items-start gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">例句</span>
                                                    <div className="flex-1 relative group/input">
                                                        <textarea 
                                                            rows={2}
                                                            value={card.example}
                                                            onChange={(e) => handleUpdateCard(index, 'example', e.target.value)}
                                                            className="w-full text-sm text-slate-700 font-medium italic bg-transparent border-none focus:ring-0 p-0 resize-none leading-relaxed"
                                                            placeholder="Enter an example sentence..."
                                                        />
                                                        <Edit3 className="w-3 h-3 text-slate-300 absolute right-0 top-2 opacity-0 group-hover/input:opacity-100 pointer-events-none"/>
                                                    </div>
                                                    <button 
                                                        className="text-slate-400 hover:text-blue-500 transition"
                                                        onClick={() => playWordAudio(card.example, 'US')}
                                                        title="朗读例句"
                                                    >
                                                        <Volume2 className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                                <div className="flex items-start gap-2 border-t border-slate-200 pt-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">翻译</span>
                                                    <div className="flex-1 relative group/input">
                                                        <input 
                                                            type="text"
                                                            value={card.exampleTrans}
                                                            onChange={(e) => handleUpdateCard(index, 'exampleTrans', e.target.value)}
                                                            className="w-full text-xs text-slate-500 bg-transparent border-none focus:ring-0 p-0"
                                                            placeholder="例句翻译"
                                                        />
                                                        <Edit3 className="w-3 h-3 text-slate-300 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 pointer-events-none"/>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Row: Image Selection (PER CARD) */}
                                            {searchResult.images.length > 0 && (
                                                <div className="space-y-2">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">选择配图</span>
                                                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-center">
                                                        {/* None Option */}
                                                        <div 
                                                            onClick={() => handleUpdateCard(index, 'selectedImage', null)}
                                                            className={`shrink-0 w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition ${card.selectedImage === null ? 'border-red-500 bg-red-50 text-red-500' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                                        >
                                                            <ImageOff className="w-6 h-6 mb-1"/>
                                                            <span className="text-[10px]">无图</span>
                                                        </div>

                                                        {searchResult.images.map((imgUrl, imgIdx) => (
                                                            <div 
                                                                key={imgIdx}
                                                                onClick={() => handleUpdateCard(index, 'selectedImage', imgUrl)}
                                                                className={`shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden cursor-pointer relative group/img ${card.selectedImage === imgUrl ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                                                            >
                                                                <img src={imgUrl} alt="Choice" className="w-full h-full object-cover" />
                                                                {card.selectedImage === imgUrl && (
                                                                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                                        <div className="bg-blue-600 rounded-full p-1"><div className="w-2 h-2 bg-white rounded-full"></div></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
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

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="text-sm text-slate-500">
                    已选择 {cards.filter(c => c.isSelected).length} 个义项
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition">
                        取消
                    </button>
                    <button 
                        onClick={handleImport}
                        disabled={cards.filter(c => c.isSelected).length === 0} 
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
