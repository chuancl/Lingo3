

import React, { useEffect, useState, useRef } from 'react';
import { WordEntry, WordInteractionConfig, WordCategory } from '../types';
import { Volume2, Plus, Check } from 'lucide-react';
import { playTextToSpeech, stopAudio } from '../utils/audio';

interface WordBubbleProps {
  entry: WordEntry | null;
  originalText: string;
  targetRect: DOMRect | null;
  config: WordInteractionConfig;
  isVisible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onAddWord: (id: string) => void;
  ttsSpeed?: number; // Optional prop for global speed setting
}

export const WordBubble: React.FC<WordBubbleProps> = ({ 
    entry, 
    originalText, 
    targetRect, 
    config, 
    isVisible, 
    onMouseEnter, 
    onMouseLeave, 
    onAddWord,
    ttsSpeed = 1.0
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [placedSide, setPlacedSide] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isAdded, setIsAdded] = useState(false);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    if (entry) {
        setIsAdded(entry.category === WordCategory.LearningWord || entry.category === WordCategory.KnownWord);
    }
  }, [entry]);

  // Fix: Reset auto-play flag whenever the entry ID changes (Handling "Hot Swap" between words)
  useEffect(() => {
      hasAutoPlayedRef.current = false;
  }, [entry?.id]);

  // Stop audio immediately if bubble becomes invisible or UNMOUNTS
  useEffect(() => {
    if (!isVisible) {
      stopAudio();
      hasAutoPlayedRef.current = false;
    }
    // Cleanup on unmount
    return () => {
       stopAudio();
    };
  }, [isVisible]);

  // Handle Auto Pronounce
  useEffect(() => {
      // Check if visible, has entry, config allows, AND we haven't played THIS specific entry yet.
      if (isVisible && entry && config.autoPronounceCount > 0 && !hasAutoPlayedRef.current) {
          playTextToSpeech(entry.text, config.autoPronounceAccent, ttsSpeed, config.autoPronounceCount);
          hasAutoPlayedRef.current = true;
      }
  }, [isVisible, entry, config.autoPronounceCount, config.autoPronounceAccent, ttsSpeed]);

  const handleAdd = (e: React.MouseEvent) => {
      e.stopPropagation();
      if(entry) {
          onAddWord(entry.id);
          setIsAdded(true);
      }
  };

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entry) return;
    playTextToSpeech(entry.text, config.autoPronounceAccent, ttsSpeed, 1);
  };

  const playSentence = (text: string) => {
     playTextToSpeech(text, config.autoPronounceAccent, ttsSpeed, 1);
  };

  useEffect(() => {
    if (isVisible && targetRect && bubbleRef.current) {
      const bubbleRect = bubbleRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const gap = 12; // Increased gap for arrow space
      
      let finalTop = 0;
      let finalLeft = 0;
      let side = config.bubblePosition;

      // --- Helper Logic ---
      const getPos = (s: string) => {
          switch (s) {
              case 'top':
                  return {
                      t: targetRect.top - bubbleRect.height - gap,
                      l: targetRect.left + (targetRect.width / 2) - (bubbleRect.width / 2)
                  };
              case 'bottom':
                  return {
                      t: targetRect.bottom + gap,
                      l: targetRect.left + (targetRect.width / 2) - (bubbleRect.width / 2)
                  };
              case 'left':
                  return {
                      t: targetRect.top + (targetRect.height / 2) - (bubbleRect.height / 2),
                      l: targetRect.left - bubbleRect.width - gap
                  };
              case 'right':
                  return {
                      t: targetRect.top + (targetRect.height / 2) - (bubbleRect.height / 2),
                      l: targetRect.right + gap
                  };
              default: return { t: 0, l: 0 };
          }
      };

      // --- 1. Calculate Primary Preference ---
      let { t, l } = getPos(side);
      finalTop = t;
      finalLeft = l;

      // --- 2. Flip Logic (Vertical) ---
      if (side === 'bottom') {
          // If overflows bottom, check if top has space
          if (finalTop + bubbleRect.height > viewportHeight - 10) {
              const topSpace = targetRect.top - gap - 10;
              if (topSpace > bubbleRect.height) {
                  side = 'top';
                  const res = getPos('top');
                  finalTop = res.t;
                  finalLeft = res.l;
              }
          }
      } else if (side === 'top') {
           // If overflows top, check if bottom has space
           if (finalTop < 10) {
               const bottomSpace = viewportHeight - (targetRect.bottom + gap) - 10;
               if (bottomSpace > bubbleRect.height) {
                   side = 'bottom';
                   const res = getPos('bottom');
                   finalTop = res.t;
                   finalLeft = res.l;
               }
           }
      }

      // --- 3. Clamp (Safety) ---
      // Horizontal Clamp
      if (finalLeft < 10) finalLeft = 10;
      if (finalLeft + bubbleRect.width > viewportWidth - 10) finalLeft = viewportWidth - bubbleRect.width - 10;
      
      // Vertical Clamp (Hard limit)
      if (finalTop < 10) finalTop = 10;
      if (finalTop + bubbleRect.height > viewportHeight - 10) finalTop = viewportHeight - bubbleRect.height - 10;

      setPosition({ top: finalTop, left: finalLeft });
      setPlacedSide(side as any);
    }
  }, [isVisible, targetRect, entry, config.bubblePosition]);

  if (!entry || !isVisible) return null;

  // --- Inline Styles (Strict Isolation) ---
  const containerStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 2147483647,
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      border: '1px solid #e2e8f0',
      padding: '20px',
      width: '280px',
      boxSizing: 'border-box',
      top: position?.top ?? -9999, 
      left: position?.left ?? -9999,
      opacity: position ? 1 : 0,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: 'auto',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: '16px',
      lineHeight: '1.5',
      color: '#0f172a',
      textAlign: 'left'
  };

  const arrowSize = 12;
  const arrowStyle: React.CSSProperties = {
      position: 'absolute',
      width: `${arrowSize}px`,
      height: `${arrowSize}px`,
      backgroundColor: '#ffffff',
      transform: 'rotate(45deg)',
      border: '1px solid #e2e8f0',
      zIndex: -1,
  };

  // Adjust arrow borders based on side to blend with card
  if (placedSide === 'top') {
      Object.assign(arrowStyle, { bottom: '-6px', left: 'calc(50% - 6px)', borderTopColor: 'transparent', borderLeftColor: 'transparent' });
  } else if (placedSide === 'bottom') {
      Object.assign(arrowStyle, { top: '-6px', left: 'calc(50% - 6px)', borderBottomColor: 'transparent', borderRightColor: 'transparent' });
  } else if (placedSide === 'left') {
      Object.assign(arrowStyle, { right: '-6px', top: 'calc(50% - 6px)', borderBottomColor: 'transparent', borderLeftColor: 'transparent' });
  } else if (placedSide === 'right') {
      Object.assign(arrowStyle, { left: '-6px', top: 'calc(50% - 6px)', borderTopColor: 'transparent', borderRightColor: 'transparent' });
  }

  const headerStyle: React.CSSProperties = {
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      marginBottom: '12px',
      lineHeight: 1
  };

  const wordStyle: React.CSSProperties = {
      fontSize: '20px', 
      fontWeight: '700', 
      color: '#0f172a', 
      margin: '0 0 4px 0',
      lineHeight: '1.2'
  };

  const phoneticStyle: React.CSSProperties = {
      fontSize: '12px', 
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      color: '#94a3b8',
      display: 'block'
  };

  const btnStyle: React.CSSProperties = {
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '6px', 
      borderRadius: '9999px', 
      border: 'none', 
      background: 'transparent',
      cursor: 'pointer',
      color: '#94a3b8',
      transition: 'background-color 0.2s, color 0.2s'
  };

  const addBtnStyle: React.CSSProperties = {
      ...btnStyle,
      backgroundColor: isAdded ? '#f0fdf4' : '#eff6ff',
      color: isAdded ? '#16a34a' : '#2563eb',
  };

  const meaningStyle: React.CSSProperties = {
      fontSize: '14px', 
      fontWeight: '500', 
      color: '#334155', 
      marginBottom: '12px',
      lineHeight: '1.4'
  };

  const originalBoxStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      fontSize: '12px',
      backgroundColor: '#f8fafc',
      padding: '6px 12px',
      borderRadius: '6px',
      marginBottom: '12px',
      border: '1px solid #f1f5f9',
      color: '#334155'
  };

  const exampleStyle: React.CSSProperties = {
      fontSize: '12px', 
      fontStyle: 'italic', 
      color: '#475569', 
      borderLeft: '3px solid #60a5fa', 
      paddingLeft: '12px', 
      marginTop: '4px',
      lineHeight: '1.5',
      cursor: 'pointer' // Add cursor pointer to indicate clickability
  };

  // Helper for hover effects via onMouseEnter/Leave on individual elements isn't ideal with inline styles in React without state.
  // Kept simple for now.

  return (
    <div 
      ref={bubbleRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={containerStyle}
    >
        {/* Arrow */}
        <div style={arrowStyle}></div>
        
        {/* Header */}
        <div style={headerStyle}>
            <div>
                <h4 style={wordStyle}>{entry.text}</h4>
                {config.showPhonetic && (entry.phoneticUs || entry.phoneticUk) && (
                    <span style={phoneticStyle}>{entry.phoneticUs || entry.phoneticUk}</span>
                )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                    onClick={playAudio} 
                    style={btnStyle}
                    title="播放发音"
                >
                    <Volume2 size={18} />
                </button>
                {/* Only show Add button if not already Learning/Known, OR show Checked state if added */}
                <button 
                    onClick={handleAdd}
                    style={addBtnStyle}
                    title={isAdded ? "已添加" : "添加到正在学"}
                >
                    {isAdded ? <Check size={18} /> : <Plus size={18} />}
                </button>
            </div>
        </div>
        
        {config.showDictTranslation && (
            <div style={meaningStyle}>
                {entry.translation}
            </div>
        )}

        {config.showOriginalText && (
            <div style={originalBoxStyle}>
                <span style={{ marginRight: '8px', color: '#94a3b8', userSelect: 'none' }}>原文:</span>
                <span style={{ fontWeight: '500' }}>{originalText || '...'}</span>
            </div>
        )}

        {/* Clickable Sentences */}
        {config.showDictExample && entry.dictionaryExample && (
            <div 
                style={exampleStyle} 
                onClick={() => playSentence(entry.dictionaryExample!)}
                title="点击朗读例句"
            >
                {entry.dictionaryExample}
            </div>
        )}
    </div>
  );
};
