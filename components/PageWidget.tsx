
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PageWidgetConfig, WordEntry, WordCategory, WordTab } from '../types';
import { entriesStorage } from '../utils/storage';
import { FloatingBall } from './page-widget/FloatingBall';
import { WidgetWindow } from './page-widget/WidgetWindow';

interface PageWidgetProps {
  config: PageWidgetConfig;
  setConfig: (config: PageWidgetConfig) => void;
  pageWords: WordEntry[];
  setPageWords: React.Dispatch<React.SetStateAction<WordEntry[]>>;
}

export const PageWidget: React.FC<PageWidgetProps> = ({ config, setConfig, pageWords }) => {
  // Local UI State to prevent storage trashing during drag
  const [localConfig, setLocalConfig] = useState<PageWidgetConfig>(config);
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WordTab>('all');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [dismissedWordIds, setDismissedWordIds] = useState<Set<string>>(new Set());

  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingBall, setIsDraggingBall] = useState(false);
  
  const [draggedConfigIndex, setDraggedConfigIndex] = useState<number | null>(null);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const ballDragOffset = useRef({ x: 0, y: 0 });
  const ballDragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (config.x === 0 && config.y === 0) {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const initialX = Math.max(20, winW - 100);
      const initialY = Math.max(20, winH - 150);
      
      const newConfig = {
         ...config,
         x: initialX,
         y: initialY,
         modalPosition: { x: Math.max(0, winW / 2 - 250), y: Math.max(0, winH / 2 - 300) }
      };
      setLocalConfig(newConfig);
      setConfig(newConfig);
    }
  }, []);

  useEffect(() => {
    if (!isDraggingBall && !isDraggingModal && !isResizing) {
      setLocalConfig(config);
    }
  }, [config, isDraggingBall, isDraggingModal, isResizing]);

  const availableTabs = useMemo(() => {
    // "All" tab is mandatory
    const tabs: WordTab[] = ['all'];
    if (localConfig.showSections.want) tabs.push(WordCategory.WantToLearnWord);
    if (localConfig.showSections.learning) tabs.push(WordCategory.LearningWord);
    if (localConfig.showSections.known) tabs.push(WordCategory.KnownWord);
    return tabs;
  }, [localConfig.showSections]);

  useEffect(() => {
     if (activeTab !== 'all' && !availableTabs.includes(activeTab)) {
        setActiveTab('all');
     }
  }, [availableTabs, activeTab]);

  const filteredWords = useMemo(() => {
    return pageWords.filter(w => {
       if (dismissedWordIds.has(w.id)) return false;
       
       // Check if this category is enabled in config
       let isCategoryEnabled = false;
       if (w.category === WordCategory.WantToLearnWord) isCategoryEnabled = localConfig.showSections.want;
       else if (w.category === WordCategory.LearningWord) isCategoryEnabled = localConfig.showSections.learning;
       else if (w.category === WordCategory.KnownWord) isCategoryEnabled = localConfig.showSections.known;
       
       // If the category itself is hidden, do not show word even in 'All' tab
       if (!isCategoryEnabled) return false;

       if (activeTab === 'all') return true;
       return w.category === activeTab;
    });
  }, [pageWords, activeTab, dismissedWordIds, localConfig.showSections]);

  const toggleSelectAll = () => {
    const isAllSelected = filteredWords.length > 0 && filteredWords.every(w => selectedWordIds.has(w.id));
    if (isAllSelected) {
      setSelectedWordIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredWords.forEach(w => newSet.add(w.id));
      setSelectedWordIds(newSet);
    }
  };

  const toggleSelectWord = (id: string) => {
    const newSet = new Set(selectedWordIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedWordIds(newSet);
  };

  const handleBatchSetToLearning = async () => {
    if (selectedWordIds.size === 0) return;
    const allEntries = await entriesStorage.getValue();
    const updatedEntries = allEntries.map(entry => {
       if (selectedWordIds.has(entry.id)) {
          return { ...entry, category: WordCategory.LearningWord };
       }
       return entry;
    });
    await entriesStorage.setValue(updatedEntries);
    setSelectedWordIds(new Set());
  };

  const handleBatchDismiss = () => {
    if (selectedWordIds.size === 0) return;
    const newDismissed = new Set(dismissedWordIds);
    selectedWordIds.forEach(id => newDismissed.add(id));
    setDismissedWordIds(newDismissed);
    setSelectedWordIds(new Set());
  };

  // Drag Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingBall) {
        setLocalConfig(prev => ({
          ...prev,
          x: e.clientX - ballDragOffset.current.x,
          y: e.clientY - ballDragOffset.current.y
        }));
      } else if (isDraggingModal) {
        setLocalConfig(prev => ({
          ...prev,
          modalPosition: {
            x: e.clientX - dragOffset.current.x,
            y: e.clientY - dragOffset.current.y
          }
        }));
      } else if (isResizing) {
        setLocalConfig(prev => ({
          ...prev,
          modalSize: {
            width: Math.max(320, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
            height: Math.max(400, resizeStart.current.h + (e.clientY - resizeStart.current.y))
          }
        }));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingBall || isDraggingModal || isResizing) {
        setIsDraggingBall(false);
        setIsDraggingModal(false);
        setIsResizing(false);
        setConfig(localConfig);
      }
    };

    if (isDraggingBall || isDraggingModal || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingBall, isDraggingModal, isResizing, localConfig]);

  const startDragBall = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingBall(true);
    ballDragOffset.current = { x: e.clientX - localConfig.x, y: e.clientY - localConfig.y };
    ballDragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleBallClick = (e: React.MouseEvent) => {
    const dist = Math.hypot(e.clientX - ballDragStartPos.current.x, e.clientY - ballDragStartPos.current.y);
    if (dist < 5) {
        setIsOpen(!isOpen);
    }
  };

  const startDragModal = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingModal(true);
    dragOffset.current = { x: e.clientX - localConfig.modalPosition.x, y: e.clientY - localConfig.modalPosition.y };
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: localConfig.modalSize.width,
      h: localConfig.modalSize.height
    };
  };

  const updateSetting = (updater: (prev: PageWidgetConfig) => PageWidgetConfig) => {
     const newVal = updater(localConfig);
     setLocalConfig(newVal);
     setConfig(newVal);
  };

  // Config DnD
  const handleConfigDragStart = (idx: number) => setDraggedConfigIndex(idx);
  const handleConfigDragOver = (e: React.DragEvent, idx: number) => {
     e.preventDefault();
     if(draggedConfigIndex === null || draggedConfigIndex === idx) return;
     const newOrder = [...localConfig.cardDisplay];
     const item = newOrder[draggedConfigIndex];
     newOrder.splice(draggedConfigIndex, 1);
     newOrder.splice(idx, 0, item);
     const newConf = {...localConfig, cardDisplay: newOrder};
     setLocalConfig(newConf);
     setDraggedConfigIndex(idx);
  };
  const handleConfigDragEnd = () => {
      setDraggedConfigIndex(null);
      setConfig(localConfig);
  };

  if (!localConfig.enabled) return null;

  return (
    <div 
      className="reset-shadow-dom" 
      style={{
        all: 'initial', 
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.5',
        color: '#0f172a'
      }}
    > 
      <FloatingBall 
         config={localConfig} 
         badgeCount={filteredWords.length}
         isDragging={isDraggingBall}
         onMouseDown={startDragBall}
         onClick={handleBallClick}
      />

      {isOpen && (
         <WidgetWindow 
            config={localConfig}
            filteredWords={filteredWords}
            availableTabs={availableTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedWordIds={selectedWordIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectWord={toggleSelectWord}
            handleBatchSetToLearning={handleBatchSetToLearning}
            handleBatchDismiss={handleBatchDismiss}
            onClose={() => setIsOpen(false)}
            onMouseDownHeader={startDragModal}
            onMouseDownResize={startResize}
            isConfigOpen={isConfigOpen}
            setIsConfigOpen={setIsConfigOpen}
            updateSetting={updateSetting}
            handleConfigDragStart={handleConfigDragStart}
            handleConfigDragOver={handleConfigDragOver}
            handleConfigDragEnd={handleConfigDragEnd}
            draggedConfigIndex={draggedConfigIndex}
         />
      )}
    </div>
  );
};
