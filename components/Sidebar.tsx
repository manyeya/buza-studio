import React from 'react';
import { PromptData } from '../types';
import { FileTextIcon, PlusIcon, BoxIcon, GridIcon } from './Icons';

interface SidebarProps {
  prompts: PromptData[];
  activePromptId: string | null;
  onSelectPrompt: (id: string) => void;
  onNewPrompt: () => void;
  onOpenTemplates: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ prompts, activePromptId, onSelectPrompt, onNewPrompt, onOpenTemplates }) => {
  return (
    <div className="w-64 h-full bg-figma-panel border-r border-figma-border flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-figma-border flex items-center justify-between px-4">
        <div className="font-semibold text-sm flex items-center gap-2.5">
          {/* Buza Logo: Speech Bubble with 'B' */}
          <div className="relative group">
            <div className="w-6 h-6 bg-gradient-to-br from-[#1DB954] to-[#14803a] rounded-t-lg rounded-bl-lg rounded-br-none flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105">
                <span className="text-[11px] font-black text-black leading-none mt-[1px] ml-[1px]">B</span>
            </div>
            {/* Small tail for the speech bubble effect */}
            <div className="absolute -bottom-[3px] right-0 w-2 h-2 bg-[#14803a] clip-path-triangle transform rotate-180"></div>
          </div>
          <span className="tracking-tight text-white">Buza Studio</span>
        </div>
      </div>

      {/* Tools / Sections */}
      <div className="p-2 border-b border-figma-border">
         <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-figma-hover cursor-pointer text-xs font-medium text-figma-text">
            <BoxIcon className="w-4 h-4 text-figma-muted" />
            <span>All Prompts</span>
         </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-2 text-[10px] font-bold text-figma-muted uppercase tracking-wider">
          Your Projects
        </div>
        
        {prompts.length === 0 && (
          <div className="px-4 py-4 text-xs text-figma-muted text-center italic">
            No prompts yet. Create one!
          </div>
        )}

        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt.id)}
            className={`group px-3 py-1.5 mx-2 rounded cursor-pointer flex items-center gap-2 text-xs mb-0.5 transition-colors
              ${activePromptId === prompt.id ? 'bg-figma-accent text-black font-medium' : 'text-figma-muted hover:bg-figma-hover hover:text-white'}
            `}
          >
            <FileTextIcon className={`w-3.5 h-3.5 ${activePromptId === prompt.id ? 'text-black' : 'text-figma-muted group-hover:text-white'}`} />
            <span className="truncate">{prompt.name}</span>
          </div>
        ))}
      </div>

      {/* Footer / Add New */}
      <div className="p-3 border-t border-figma-border space-y-2">
        <button
          onClick={onNewPrompt}
          className="w-full flex items-center justify-center gap-2 bg-figma-hover hover:bg-[#444] border border-figma-border text-xs text-white py-1.5 rounded transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New Prompt
        </button>
        <button
          onClick={onOpenTemplates}
          className="w-full flex items-center justify-center gap-2 text-figma-muted hover:text-white hover:bg-figma-hover border border-transparent text-xs py-1.5 rounded transition-colors"
        >
          <GridIcon className="w-3.5 h-3.5" />
          Explore Templates
        </button>
      </div>
      
      {/* Styles for the logo tail */}
      <style>{`
        .clip-path-triangle {
            clip-path: polygon(100% 0, 0 0, 100% 100%);
        }
      `}</style>
    </div>
  );
};

export default Sidebar;