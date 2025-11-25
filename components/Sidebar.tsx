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
  onUpdateProjectVariables: (variables: any[]) => void;
  onInsertVariable?: (variableKey: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ prompts, activePromptId, onSelectPrompt, onNewPrompt, onOpenTemplates, onUpdateProjectVariables, onInsertVariable }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copiedVarId, setCopiedVarId] = useState<string | null>(null);

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

  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [tempVarKey, setTempVarKey] = useState('');
  const [tempVarValue, setTempVarValue] = useState('');

  const handleAddVariable = () => {
    if (!activePrompt) return;
    const newVar = { id: crypto.randomUUID(), key: 'new_var', value: 'value' };
    onUpdateProjectVariables([...(activePrompt.projectVariables || []), newVar]);
    setEditingVarId(newVar.id);
    setTempVarKey(newVar.key);
    setTempVarValue(newVar.value);
  };

  const handleSaveVariable = () => {
    if (!activePrompt || !editingVarId) return;
    const updatedVars = (activePrompt.projectVariables || []).map(v =>
      v.id === editingVarId ? { ...v, key: tempVarKey, value: tempVarValue } : v
    );
    onUpdateProjectVariables(updatedVars);
    setEditingVarId(null);
  };

  const handleDeleteVariable = (id: string) => {
    if (!activePrompt) return;
    const updatedVars = (activePrompt.projectVariables || []).filter(v => v.id !== id);
    onUpdateProjectVariables(updatedVars);
  };

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

      {/* Project Variables Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-figma-muted uppercase tracking-wider">
              Project Variables
            </div>
            <button
              onClick={handleAddVariable}
              className="text-figma-muted hover:text-white transition-colors"
              title="Add Variable"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {activePrompt?.projectVariables?.map((variable) => (
              <div key={variable.id} className="group flex flex-col gap-1 p-2 rounded hover:bg-figma-bg/50 border border-transparent hover:border-figma-border transition-all">
                {editingVarId === variable.id ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={tempVarKey}
                      onChange={(e) => setTempVarKey(e.target.value)}
                      className="w-full bg-figma-bg border border-figma-border rounded px-1.5 py-1 text-xs text-white focus:border-figma-accent outline-none"
                      placeholder="Key"
                      autoFocus
                    />
                    <textarea
                      value={tempVarValue}
                      onChange={(e) => setTempVarValue(e.target.value)}
                      className="w-full bg-figma-bg border border-figma-border rounded px-1.5 py-1 text-xs text-figma-muted focus:text-white focus:border-figma-accent outline-none min-h-[60px] resize-y"
                      placeholder="Value"
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) handleSaveVariable();
                      }}
                    />
                    <div className="flex justify-end gap-1 mt-1">
                      <button onClick={() => setEditingVarId(null)} className="text-[10px] text-figma-muted hover:text-white px-1.5 py-0.5">Cancel</button>
                      <button onClick={handleSaveVariable} className="text-[10px] bg-figma-accent text-white px-1.5 py-0.5 rounded">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div
                      onClick={() => {
                        navigator.clipboard.writeText(`@{{${variable.key}}}`);
                        setCopiedVarId(variable.id);
                        setTimeout(() => setCopiedVarId(null), 2000);
                      }}
                      onDoubleClick={() => {
                        setEditingVarId(variable.id);
                        setTempVarKey(variable.key);
                        setTempVarValue(variable.value);
                      }}
                      className="flex-1 cursor-pointer hover:bg-figma-bg/70 rounded px-1 -mx-1 transition-colors"
                      title={copiedVarId === variable.id ? "Copied!" : "Click to copy, double-click to edit"}
                    >
                      <div className="text-xs font-medium text-figma-accent truncate flex items-center gap-1">
                        {variable.key}
                        {copiedVarId === variable.id && (
                          <span className="text-[10px] text-green-400">✓</span>
                        )}
                      </div>
                      <div className="text-[11px] text-figma-muted truncate">{variable.value}</div>
                    </div>
                    {onInsertVariable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertVariable(variable.key);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-figma-hover rounded transition-opacity"
                        title="Insert into editor"
                      >
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariable(variable.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-figma-muted hover:text-red-400 transition-opacity p-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11.296L10.868 12.132C10.7917 13.582 9.59228 14.75 8.14007 14.75H6.85993C5.40772 14.75 4.20827 13.582 4.13199 12.132L3.70402 4H3.5C3.22386 4 3 3.77614 3 3.5ZM4.71201 4L5.13201 12.079C5.17014 12.804 5.76987 13.3885 6.49587 13.3885H8.50413C9.23013 13.3885 9.82986 12.804 9.86799 12.079L10.288 4H4.71201Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {(!activePrompt?.projectVariables || activePrompt.projectVariables.length === 0) && (
              <div className="text-xs text-figma-muted italic px-1">No variables</div>
            )}
          </div>
        </div>
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
