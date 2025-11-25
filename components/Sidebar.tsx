import React from 'react';
import { PromptData } from '../types';
import { FileTextIcon, PlusIcon, BoxIcon, GridIcon, ChevronDownIcon } from './Icons';
import { useState, useRef, useEffect } from 'react';

interface SidebarProps {
  prompts: PromptData[];
  activePromptId: string | null;
  onSelectPrompt: (id: string) => void;
  onNewPrompt: () => void;
  onOpenTemplates: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ prompts, activePromptId, onSelectPrompt, onNewPrompt, onOpenTemplates }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activePrompt = prompts.find(p => p.id === activePromptId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      {/* Project Switcher Dropdown */}
      <div className="p-3 border-b border-figma-border">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-figma-bg border border-figma-border rounded text-xs text-white hover:border-figma-muted transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <BoxIcon className="w-3.5 h-3.5 text-figma-accent" />
              <span className="truncate font-medium">{activePrompt?.name || 'Select Project'}</span>
            </div>
            <ChevronDownIcon className={`w-3 h-3 text-figma-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-figma-panel border border-figma-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-bold text-figma-muted uppercase tracking-wider border-b border-figma-border sticky top-0 bg-figma-panel">
                Your Projects
              </div>
              {prompts.length === 0 && (
                <div className="px-4 py-3 text-xs text-figma-muted text-center italic">
                  No projects yet.
                </div>
              )}
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => {
                    onSelectPrompt(prompt.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-figma-hover transition-colors flex items-center gap-2 ${activePromptId === prompt.id ? 'text-figma-accent bg-figma-hover/50' : 'text-white'}`}
                >
                  <FileTextIcon className={`w-3.5 h-3.5 ${activePromptId === prompt.id ? 'text-figma-accent' : 'text-figma-muted'}`} />
                  <span className="truncate">{prompt.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spacer to push footer down if needed, or just empty space */}
      <div className="flex-1"></div>

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
