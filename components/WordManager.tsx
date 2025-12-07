
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WordCategory, WordEntry, MergeStrategyConfig, WordTab, Scenario } from '../types';
import { DEFAULT_MERGE_STRATEGY } from '../constants';
import { Upload, Download, Filter, Settings2, List, Search, Plus, Trash2, CheckSquare, Square, ArrowRight, BookOpen, GraduationCap, CheckCircle, RotateCcw, HelpCircle } from 'lucide-react';
import { MergeConfigModal } from './word-manager/MergeConfigModal';
import { AddWordModal } from './word-manager/AddWordModal';
import { WordList } from './word-manager/WordList';
import { Toast, ToastMessage } from './ui/Toast';
import { entriesStorage, enginesStorage } from '../utils/storage';
import { fetchWordDetails } from '../utils/dictionary-service';

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  return (
    <div className="group relative flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 whitespace-pre-line text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};

interface WordManagerProps {
  scenarios: Scenario[];
  entries: WordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<WordEntry[]>>;
  ttsSpeed?: number;
}

export const WordManager: React.FC<WordManagerProps> = ({ scenarios, entries, setEntries, ttsSpeed = 1.0 }) => {
  const [activeTab, setActiveTab] = useState<WordTab>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  // Modal States
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Configs
  const [showConfig, setShowConfig] = useState({
    showPhonetic: true,
    showMeaning: true,
  });
  
  const [mergeConfig, setMergeConfig] = useState<MergeStrategyConfig>(DEFAULT_MERGE_STRATEGY);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  useEffect(() => {
     const savedConfigStr = localStorage.getItem('context-lingo-merge-config');
     if (savedConfigStr) {
         try {
             const saved = JSON.parse(savedConfigStr);
             let needsUpdate = false;
             if (saved.exampleOrder && !saved.exampleOrder.some((item: any) => item.id === 'inflections')) {
                 saved.exampleOrder.push({ id: 'inflections', label: '词态变化 (Morphology)', enabled: true });
                 needsUpdate = true;
             }
             if (typeof saved.showExampleTranslation === 'undefined') { saved.showExampleTranslation = true; needsUpdate = true; }
             if (typeof saved.showContextTranslation === 'undefined') { saved.showContextTranslation = true; needsUpdate = true; }

             if (needsUpdate) {
                 localStorage.setItem('context-lingo-merge-config', JSON.stringify(saved));
             }
             setMergeConfig(saved);
         } catch (e) {
             console.error("Failed to load merge config", e);
             setMergeConfig(DEFAULT_MERGE_STRATEGY);
         }
     } else {
         setMergeConfig(DEFAULT_MERGE_STRATEGY);
         localStorage.setItem('context-lingo-merge-config', JSON.stringify(DEFAULT_MERGE_STRATEGY));
     }
  }, []);

  useEffect(() => {
      localStorage.setItem('context-lingo-merge-config', JSON.stringify(mergeConfig));
  }, [mergeConfig]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedWords(new Set());
  }, [activeTab, selectedScenarioId]);

  useEffect(() => {
    if (selectedScenarioId !== 'all' && !scenarios.find(s => s.id === selectedScenarioId)) {
      setSelectedScenarioId('all');
    }
  }, [scenarios, selectedScenarioId]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      setToast({ id: Date.now(), message, type });
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (activeTab !== 'all') {
        if (activeTab === WordCategory.WantToLearnWord) {
           if (e.category !== WordCategory.WantToLearnWord && e.category !== WordCategory.LearningWord) return false;
        } else {
           if (e.category !== activeTab) return false;
        }
      }
      if (selectedScenarioId !== 'all') {
         if (e.scenarioId !== selectedScenarioId) return false;
      }
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        const matchText = e.text.toLowerCase().includes(lowerQ);
        const matchTrans = e.translation?.includes(lowerQ) || false;
        if (!matchText && !matchTrans) return false;
      }
      return true; 
    });
  }, [entries, activeTab, selectedScenarioId, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, WordEntry[]> = {};
    filteredEntries.forEach(entry => {
      let key = entry.text.toLowerCase().trim();
      if (mergeConfig.strategy === 'by_word_and_meaning') {
        key = `${key}::${entry.translation?.trim()}`;
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });
    const sortedGroups = Object.values(groups).map(group => {
       return group.sort((a, b) => b.addedAt - a.addedAt);
    });
    return sortedGroups.sort((a, b) => {
       const maxA = a[0].addedAt; 
       const maxB = b[0].addedAt;
       return maxB - maxA;
    });
  }, [filteredEntries, mergeConfig.strategy]);

  const allVisibleIds = useMemo(() => filteredEntries.map(e => e.id), [filteredEntries]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedWords.has(id));
  const isAllWordsTab = activeTab === 'all';

  const toggleSelectAll = () => {
    if (allSelected) {
      const newSet = new Set(selectedWords);
      allVisibleIds.forEach(id => newSet.delete(id));
      setSelectedWords(newSet);
    } else {
      const newSet = new Set(selectedWords);
      allVisibleIds.forEach(id => newSet.add(id));
      setSelectedWords(newSet);
    }
  };

  const toggleSelectGroup = (group: WordEntry[]) => {
    const newSet = new Set(selectedWords);
    const groupIds = group.map(g => g.id);
    const isGroupSelected = groupIds.every(id => newSet.has(id));

    if (isGroupSelected) {
      groupIds.forEach(id => newSet.delete(id));
    } else {
      groupIds.forEach(id => newSet.add(id));
    }
    setSelectedWords(newSet);
  };

  const isGroupSelected = (group: WordEntry[]) => {
    return group.every(e => selectedWords.has(e.id));
  };

  const handleDeleteSelected = () => {
    if (selectedWords.size === 0) return;

    if (activeTab === WordCategory.LearningWord) {
        if (confirm(`确定不再将选中的 ${selectedWords.size} 个单词标记为“正在学”吗？\n它们将保留在“想学习”列表 (子集关系)。`)) {
            const newEntries = entries.map(e => {
                if (selectedWords.has(e.id)) {
                    return { ...e, category: WordCategory.WantToLearnWord };
                }
                return e;
            });
            setEntries(newEntries);
            setSelectedWords(new Set());
            showToast('已移回“想学习”列表', 'success');
        }
        return;
    }

    let confirmMsg = `确定从当前列表删除选中的 ${selectedWords.size} 个单词吗？`;
    if (activeTab === WordCategory.WantToLearnWord) {
        confirmMsg = `确定彻底删除选中的 ${selectedWords.size} 个单词吗？\n注意：“正在学”是“想学习”的子集，删除后将同步从“正在学”中移除。`;
    }

    if (confirm(confirmMsg)) {
      setEntries(prev => prev.filter(e => !selectedWords.has(e.id)));
      setSelectedWords(new Set());
      showToast('删除成功', 'success');
    }
  };

  const handleBatchMove = (targetCategory: WordCategory) => {
      if (selectedWords.size === 0) return;
      const newEntries = entries.map(e => {
          if (selectedWords.has(e.id)) {
              return { ...e, category: targetCategory };
          }
          return e;
      });
      setEntries(newEntries);
      setSelectedWords(new Set());
      showToast('移动成功', 'success');
  };

  const handleExport = () => {
     let dataToExport: WordEntry[];
     if (selectedWords.size > 0) {
        dataToExport = entries.filter(e => selectedWords.has(e.id));
     } else {
        dataToExport = filteredEntries;
     }

     if (dataToExport.length === 0) {
        showToast('当前列表为空，无法导出', 'warning');
        return;
     }

     const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     const prefix = selectedWords.size > 0 ? 'selected' : activeTab;
     a.download = `contextlingo_export_${prefix}_${dataToExport.length}words_${Date.now()}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     showToast(`成功导出 ${dataToExport.length} 个单词`, 'success');
  };

  const triggerImport = () => {
     if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = async (event) => {
        const text = event.target?.result as string;
        let candidates: { text: string, translation?: string }[] = [];
        
        try {
           const json = JSON.parse(text);
           if (Array.isArray(json)) {
               candidates = json.map(item => ({ text: item.text, translation: item.translation || item.preferredTranslation }));
           }
        } catch (err) {
           const parts = text.split(/[\n,，]+/).filter(p => p.trim());
           candidates = parts.map(part => {
               const cleaned = part.trim();
               const match = cleaned.match(/^([a-zA-Z0-9\-\s]+?)(?:\s+([\u4e00-\u9fa5].*))?$/);
               if (match) {
                   return { text: match[1].trim(), translation: match[2]?.trim() };
               }
               return { text: cleaned };
           });
        }

        const targetCategory = activeTab === 'all' ? WordCategory.WantToLearnWord : activeTab;
        const engines = await enginesStorage.getValue();
        const activeEngine = engines.find(e => e.isEnabled);
        
        if (!activeEngine) {
            showToast("未启用任何翻译引擎，无法完成智能导入", "error");
            return;
        }

        let successCount = 0;
        let failCount = 0;

        showToast(`开始处理 ${candidates.length} 个单词，请稍候...`, 'info');
        const newEntriesToAdd: WordEntry[] = [];

        // Note: Batch import relies on standard fetcher. If user needs specific manual overrides, they use AddWordModal.
        // This is simplified to prevent timeouts on large imports.
        for (const candidate of candidates) {
            if (!candidate.text) continue;
            try {
                const detailsList = await fetchWordDetails(candidate.text, candidate.translation, activeEngine);
                for (const details of detailsList) {
                     if (!details.text) continue;
                     
                     // Avoid duplicates simply by text check for batch import
                     if (entries.some(e => e.text.toLowerCase() === details.text!.toLowerCase())) continue;
                     if (newEntriesToAdd.some(e => e.text.toLowerCase() === details.text!.toLowerCase())) continue;

                     newEntriesToAdd.push({
                        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        text: details.text!,
                        translation: details.translation || '',
                        phoneticUs: details.phoneticUs,
                        phoneticUk: details.phoneticUk,
                        contextSentence: details.contextSentence,
                        mixedSentence: details.mixedSentence,
                        dictionaryExample: details.dictionaryExample,
                        dictionaryExampleTranslation: details.dictionaryExampleTranslation,
                        inflections: details.inflections || [], 
                        tags: details.tags || [],
                        importance: details.importance || 0,
                        englishDefinition: details.englishDefinition,
                        category: targetCategory,
                        addedAt: Date.now(),
                        scenarioId: selectedScenarioId === 'all' ? '1' : selectedScenarioId,
                     });
                     successCount++;
                }
            } catch (err) {
                console.error(`Failed to import ${candidate.text}:`, err);
                failCount++;
            }
        }

        if (newEntriesToAdd.length > 0) {
            setEntries(prev => [...prev, ...newEntriesToAdd]);
            showToast(`导入完成: 新增 ${successCount}, 失败/重复 ${failCount}`, 'success');
        } else {
             showToast(`没有新增单词`, 'warning');
        }
     };
     reader.readAsText(file);
     e.target.value = ''; 
  };

  // UPDATED: Handle the Rich Object from Modal
  const handleAddWord = async (entryData: Partial<WordEntry>) => {
      try {
          const targetCategory = activeTab === 'all' ? WordCategory.WantToLearnWord : activeTab;

          // Simple duplicate check based on Text & Category
          const exists = entries.some(e => e.text.toLowerCase() === entryData.text?.toLowerCase() && e.category === targetCategory);
          if (exists) {
              showToast('该单词已在当前列表中', 'warning');
              return;
          }

          const newEntry: WordEntry = {
              id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              text: entryData.text!,
              translation: entryData.translation,
              englishDefinition: entryData.englishDefinition,
              phoneticUs: entryData.phoneticUs,
              phoneticUk: entryData.phoneticUk,
              contextSentence: entryData.contextSentence, // Manual add usually lacks context unless user types it
              mixedSentence: entryData.mixedSentence,
              dictionaryExample: entryData.dictionaryExample,
              dictionaryExampleTranslation: entryData.dictionaryExampleTranslation,
              inflections: entryData.inflections || [],
              tags: entryData.tags || [],
              importance: entryData.importance || 0,
              category: targetCategory,
              addedAt: Date.now(),
              scenarioId: selectedScenarioId === 'all' ? '1' : selectedScenarioId,
          };

          setEntries(prev => [newEntry, ...prev]);
          showToast('添加成功', 'success');

      } catch (e: any) {
          console.error(e);
          showToast('添加失败', 'error');
      }
  };

  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newOrder = [...mergeConfig.exampleOrder];
    const draggedItem = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setMergeConfig({ ...mergeConfig, exampleOrder: newOrder });
    setDraggedItemIndex(index);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);
  
  const getTabLabel = (tab: WordTab) => tab === 'all' ? '所有单词' : tab;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative min-h-[600px]">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json,.txt" onChange={handleImportFile} />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="border-b border-slate-200 px-6 py-5 bg-slate-50 rounded-t-xl flex justify-between items-center flex-wrap gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-800">词汇库管理</h2>
           <p className="text-sm text-slate-500 mt-1">管理、筛选及编辑您的个性化词库</p>
        </div>
        <div>
           <Tooltip text="配置合并策略、显示内容及顺序">
              <button 
                onClick={() => setIsMergeModalOpen(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm shadow-blue-200"
              >
                <Settings2 className="w-4 h-4 mr-2" /> 显示配置
              </button>
           </Tooltip>
        </div>
      </div>
      
      <AddWordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onConfirm={handleAddWord} 
      />

      <MergeConfigModal 
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        mergeConfig={mergeConfig}
        setMergeConfig={setMergeConfig}
        showConfig={showConfig}
        setShowConfig={setShowConfig}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDragEnd={handleDragEnd}
        draggedItemIndex={draggedItemIndex}
      />

      <div className="border-b border-slate-200 bg-white p-4 space-y-4">
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          {(['all', ...Object.values(WordCategory)] as WordTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all flex items-center ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab === 'all' && <List className="w-4 h-4 mr-2" />}
              {getTabLabel(tab)}
            </button>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
           <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center">
                 <button onClick={toggleSelectAll} className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 select-none">
                    {allSelected ? <CheckSquare className="w-5 h-5 mr-2 text-blue-600"/> : <Square className="w-5 h-5 mr-2 text-slate-400"/>}
                    全选
                 </button>
              </div>
              
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select 
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer hover:bg-slate-100 rounded"
                  >
                    <option value="all">所有场景</option>
                    {scenarios.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
              </div>

              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4 flex-1 max-w-xs">
                 <Search className="w-4 h-4 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="搜索单词或释义..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-sm border-none bg-transparent focus:ring-0 text-slate-700 placeholder:text-slate-400"
                 />
              </div>
           </div>

           <div className="flex gap-2 items-center">
              {selectedWords.size > 0 ? (
                 <>
                    {activeTab === WordCategory.KnownWord && (
                        <>
                           <button onClick={() => handleBatchMove(WordCategory.WantToLearnWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition animate-in slide-in-from-right-2">
                              <RotateCcw className="w-4 h-4 mr-2" /> 移至想学
                           </button>
                           <button onClick={() => handleBatchMove(WordCategory.LearningWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition animate-in slide-in-from-right-2">
                              <BookOpen className="w-4 h-4 mr-2" /> 移至正在学
                           </button>
                        </>
                    )}
                    {activeTab === WordCategory.WantToLearnWord && (
                        <>
                            <button onClick={() => handleBatchMove(WordCategory.LearningWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition animate-in slide-in-from-right-2">
                               <ArrowRight className="w-4 h-4 mr-2" /> 开始学习
                            </button>
                            <button onClick={() => handleBatchMove(WordCategory.KnownWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition animate-in slide-in-from-right-2">
                               <CheckCircle className="w-4 h-4 mr-2" /> 设为已掌握
                            </button>
                        </>
                    )}
                    {activeTab === WordCategory.LearningWord && (
                         <>
                            <button onClick={() => handleBatchMove(WordCategory.WantToLearnWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition animate-in slide-in-from-right-2">
                               <RotateCcw className="w-4 h-4 mr-2" /> 移回想学
                            </button>
                            <button onClick={() => handleBatchMove(WordCategory.KnownWord)} className="flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition animate-in slide-in-from-right-2">
                               <GraduationCap className="w-4 h-4 mr-2" /> 设为已掌握
                            </button>
                         </>
                    )}
                    <div className="w-px h-6 bg-slate-300 mx-2"></div>
                    <button onClick={handleExport} className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition animate-in slide-in-from-right-2">
                        <Download className="w-4 h-4 mr-2" /> 导出 ({selectedWords.size})
                    </button>
                    <button onClick={handleDeleteSelected} className="flex items-center px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition animate-in slide-in-from-right-2">
                        <Trash2 className="w-4 h-4 mr-2" /> 删除 ({selectedWords.size})
                    </button>
                 </>
              ) : (
                  <>
                    {!isAllWordsTab && (
                        <>
                        <Tooltip text={`手动添加单词至"${getTabLabel(activeTab)}"`}>
                            <button 
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                            >
                                <Plus className="w-4 h-4 mr-2" /> 新增
                            </button>
                        </Tooltip>

                        <Tooltip text="支持 JSON 或 TXT 文件">
                            <button 
                                onClick={triggerImport}
                                className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                            >
                            <Upload className="w-4 h-4 mr-2" /> 导入
                            </button>
                        </Tooltip>
                        </>
                    )}

                    <Tooltip text="导出当前列表">
                        <button 
                            onClick={handleExport}
                            className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                        >
                        <Download className="w-4 h-4 mr-2" /> 导出
                        </button>
                    </Tooltip>
                  </>
              )}
           </div>
        </div>
      </div>

      <div className="bg-slate-50 p-4 space-y-4 flex-1">
        <WordList 
           groupedEntries={groupedEntries}
           selectedWords={selectedWords}
           toggleSelectGroup={toggleSelectGroup}
           isGroupSelected={isGroupSelected}
           showConfig={showConfig}
           mergeConfig={mergeConfig}
           isAllWordsTab={isAllWordsTab}
           searchQuery={searchQuery}
           ttsSpeed={ttsSpeed}
        />
      </div>
    </div>
  );
};
