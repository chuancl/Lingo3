
import React, { useState, useEffect } from 'react';
import { Loader2, Wand2, Volume2, Save, X, BookOpen, Star, Hash, Mic2, BarChart2 } from 'lucide-react';
import { WordEntry, TranslationEngine } from '../../types';
import { enginesStorage } from '../../utils/storage';
import { fetchWordDetails } from '../../utils/dictionary-service';
import { playWordAudio } from '../../utils/audio';

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entryData: Partial<WordEntry>) => Promise<void>;
  isLoading?: boolean;
}

export const AddWordModal: React.FC<AddWordModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [activeEngine, setActiveEngine] = useState<TranslationEngine | null>(null);

  // Form State matching the new rich structure
  const [formData, setFormData] = useState<{
      text: string;
      phoneticUk: string;
      phoneticUs: string;
      translation: string;
      englishDefinition: string;
      inflections: string; 
      dictionaryExample: string;
      dictionaryExampleTranslation: string;
      tags: string; 
      importance: number;
      cocaRank: number; // New
  }>({
      text: '',
      phoneticUk: '',
      phoneticUs: '',
      translation: '',
      englishDefinition: '',
      inflections: '',
      dictionaryExample: '',
      dictionaryExampleTranslation: '',
      tags: '',
      importance: 0,
      cocaRank: 0
  });

  useEffect(() => {
      enginesStorage.getValue().then(engines => {
          const active = engines.find(e => e.isEnabled);
          setActiveEngine(active || null);
      });
  }, [isOpen]);

  useEffect(() => {
      if(!isOpen) {
          // Reset form on close
          setFormData({
            text: '', phoneticUk: '', phoneticUs: '',
            translation: '', englishDefinition: '', inflections: '',
            dictionaryExample: '', dictionaryExampleTranslation: '', tags: '', importance: 0, cocaRank: 0
          });
      }
  }, [isOpen]);

  const handleSmartLookup = async () => {
      if (!formData.text.trim() || !activeEngine) return;
      setIsSearching(true);
      try {
          const results = await fetchWordDetails(formData.text, undefined, activeEngine);
          if (results && results.length > 0) {
              const best = results[0]; 
              
              const allTranslations = results.map(r => r.translation).filter(Boolean).join('\n');
              const allEngDefs = results.map(r => r.englishDefinition).filter(Boolean).join('\n');

              setFormData({
                  text: best.text || formData.text,
                  phoneticUk: best.phoneticUk || '',
                  phoneticUs: best.phoneticUs || '',
                  translation: allTranslations,
                  englishDefinition: allEngDefs,
                  inflections: (best.inflections || []).join(', '),
                  dictionaryExample: best.dictionaryExample || '',
                  dictionaryExampleTranslation: best.dictionaryExampleTranslation || '',
                  tags: (best.tags || []).join(', '),
                  importance: best.importance || 0,
                  cocaRank: best.cocaRank || 0
              });
          }
      } catch (e) {
          console.error(e);
          alert('查询失败，请检查网络或引擎配置');
      } finally {
          setIsSearching(false);
      }
  };

  const handleSubmit = async () => {
      if (!formData.text.trim()) return;
      
      const entryData: Partial<WordEntry> = {
          text: formData.text,
          phoneticUk: formData.phoneticUk,
          phoneticUs: formData.phoneticUs,
          translation: formData.translation,
          englishDefinition: formData.englishDefinition,
          inflections: formData.inflections.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          dictionaryExample: formData.dictionaryExample,
          dictionaryExampleTranslation: formData.dictionaryExampleTranslation,
          tags: formData.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          importance: Number(formData.importance) || 0,
          cocaRank: Number(formData.cocaRank) || 0,
      };

      await onConfirm(entryData);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <Wand2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">添加新单词</h3>
                        <p className="text-xs text-slate-500">输入单词后点击查询，自动填充详细信息</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* 1. Main Input & Lookup */}
                <div className="flex gap-4 mb-8">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-700 mb-1">英文单词 <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full text-lg border-2 border-slate-300 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition outline-none font-bold" 
                            autoFocus 
                            value={formData.text} 
                            onChange={e => setFormData({...formData, text: e.target.value})} 
                            placeholder="例如: serendipity"
                            onKeyDown={e => e.key === 'Enter' && handleSmartLookup()}
                        />
                    </div>
                    <div className="flex items-end">
                         <button 
                            onClick={handleSmartLookup} 
                            disabled={isSearching || !formData.text.trim()}
                            className="h-[54px] px-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                         >
                            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            智能查询
                         </button>
                    </div>
                </div>

                {/* Grid Layout for Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Basics & Audio */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">发音与形态</h4>
                        
                        {/* UK Phonetic */}
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">英式音标 (UK)</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-600" 
                                    value={formData.phoneticUk} onChange={e => setFormData({...formData, phoneticUk: e.target.value})} placeholder="/.../" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => playWordAudio(formData.text, 'UK')} disabled={!formData.text} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 disabled:opacity-50" title="试听">
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                         {/* US Phonetic */}
                         <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">美式音标 (US)</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-600" 
                                    value={formData.phoneticUs} onChange={e => setFormData({...formData, phoneticUs: e.target.value})} placeholder="/.../" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => playWordAudio(formData.text, 'US')} disabled={!formData.text} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 disabled:opacity-50" title="试听">
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Inflections */}
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">词态变化 (Morphology)</label>
                             <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                                value={formData.inflections} onChange={e => setFormData({...formData, inflections: e.target.value})} placeholder="例如: eating, ate, eaten" />
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Hash className="w-3 h-3 mr-1"/> 词汇等级 (Tags)</label>
                                 <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" 
                                    value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="CET4, IELTS..." />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><Star className="w-3 h-3 mr-1 text-amber-500"/> 重要程度 (1-5)</label>
                                 <input type="number" min="0" max="5" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" 
                                    value={formData.importance} onChange={e => setFormData({...formData, importance: parseInt(e.target.value)})} />
                             </div>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><BarChart2 className="w-3 h-3 mr-1 text-blue-500"/> COCA 词频排名</label>
                             <input type="number" min="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" 
                                value={formData.cocaRank} onChange={e => setFormData({...formData, cocaRank: parseInt(e.target.value)})} placeholder="例如: 120" />
                        </div>
                    </div>

                    {/* Right Column: Definitions & Context */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">释义与例句</h4>

                        {/* Chinese Def */}
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">中文释义 (多条请换行)</label>
                             <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.translation} onChange={e => setFormData({...formData, translation: e.target.value})} placeholder="n. 巧合..." />
                        </div>

                        {/* English Def */}
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">英文释义 (English Definition)</label>
                             <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" 
                                value={formData.englishDefinition} onChange={e => setFormData({...formData, englishDefinition: e.target.value})} placeholder="Definition in English..." />
                        </div>
                        
                        {/* Example */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                             <div className="mb-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center"><BookOpen className="w-3 h-3 mr-1"/> 英文例句</label>
                                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-16 resize-none focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={formData.dictionaryExample} onChange={e => setFormData({...formData, dictionaryExample: e.target.value})} placeholder="Sentence..." />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">例句翻译</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                                    value={formData.dictionaryExampleTranslation} onChange={e => setFormData({...formData, dictionaryExampleTranslation: e.target.value})} placeholder="中文翻译..." />
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                 <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition">
                     取消
                 </button>
                 <button onClick={handleSubmit} disabled={!formData.text.trim()} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md shadow-blue-200 flex items-center disabled:opacity-50">
                     <Save className="w-4 h-4 mr-2" /> 保存单词
                 </button>
            </div>
        </div>
    </div>
  );
};
