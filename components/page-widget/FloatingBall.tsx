
import React from 'react';
import { AppWindow } from 'lucide-react';
import { PageWidgetConfig } from '../../types';

interface FloatingBallProps {
    config: PageWidgetConfig;
    badgeCount: number;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
}

export const FloatingBall: React.FC<FloatingBallProps> = ({ config, badgeCount, isDragging, onMouseDown, onClick }) => {
    return (
        <div 
            className={`fixed z-[2147483647] cursor-move transition-transform shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-105 active:scale-95 group rounded-full select-none ${isDragging ? 'scale-105 cursor-grabbing' : ''}`}
            style={{ left: config.x, top: config.y }}
            onMouseDown={onMouseDown}
            onClick={onClick}
        >
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 rounded-full flex items-center justify-center border-2 border-white/20 text-white shadow-inner relative backdrop-blur-sm overflow-hidden">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <AppWindow className="w-6 h-6 drop-shadow-md" />
                
                {badgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 bg-red-500 rounded-full text-[12px] font-bold flex items-center justify-center border-2 border-white shadow-sm z-10 font-sans leading-none">
                    {badgeCount}
                </span>
                )}
            </div>
        </div>
    );
};
