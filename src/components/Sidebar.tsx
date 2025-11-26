import React from 'react';
import { PromptData } from '../../types';
import { FileTextIcon, PlusIcon, BoxIcon, GridIcon, ChevronDownIcon, SearchIcon, SortAscIcon, SortDescIcon, HistoryIcon, TrashIcon } from './Icons';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';

interface SidebarProps {
  prompts: PromptData[];
  activePromptId: string | null;
  onSelectPrompt: (id: string) => void;
  onNewPrompt: () => void;
  onOpenTemplates: () => void;
  onUpdateProjectVariables: (variables: any[]) => void;
  onInsertVariable?: (variableKey: string) => void;
  onDeleteProject: (projectName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ prompts, activePromptId, onSelectPrompt, onNewPrompt, onOpenTemplates, onUpdateProjectVariables, onInsertVariable, onDeleteProject }) => {
  const [copiedVarId, setCopiedVarId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [tempVarKey, setTempVarKey] = useState('');
  const [tempVarValue, setTempVarValue] = useState('');

  const activePrompt = prompts.find(p => p.id === activePromptId);

  // Filter and sort projects
  const filteredAndSortedPrompts = React.useMemo(() => {
    let filtered = prompts.filter(prompt =>
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        // Use real timestamps - sort by updatedAt for recent activity
        comparison = (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [prompts, searchQuery, sortBy, sortOrder]);

  const handleStartEditProject = (project: PromptData) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleSaveProjectName = () => {
    if (!editingProjectId || !editingProjectName.trim()) return;

    const project = prompts.find(p => p.id === editingProjectId);
    if (project && project.name !== editingProjectName.trim()) {
      // This would need to be connected to the update project functionality
      console.log(`Rename project from "${project.name}" to "${editingProjectName.trim()}"`);
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleCancelEditProject = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

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
          </div>
          <span className="tracking-tight text-white">Buza Studio</span>
        </div>
      </div>

      {/* Projects Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Projects Header */}
        <div className="px-4 border-b border-figma-border">
          <div className="h-8 flex items-center justify-between">
            <div className="text-[10px] font-bold text-figma-muted uppercase tracking-wider">
              Projects ({filteredAndSortedPrompts.length})
            </div>
            <button
              onClick={onNewPrompt}
              className="text-figma-muted hover:text-white transition-colors"
              title="New Project"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search and Sort Controls */}
          <div className="py-2 space-y-2">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-figma-muted" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-2 py-1 bg-figma-bg border border-figma-border rounded text-xs text-white placeholder-figma-muted focus:border-figma-accent outline-none"
              />
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy(sortBy === 'name' ? 'date' : 'name')}
                className="flex items-center gap-1 text-[10px] text-figma-muted hover:text-white transition-colors"
                title={`Sort by ${sortBy === 'name' ? 'date' : 'name'}`}
              >
                {sortBy === 'name' ? <SortAscIcon className="w-3 h-3" /> : <HistoryIcon className="w-3 h-3" />}
                {sortBy === 'name' ? 'Name' : 'Date'}
              </button>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1 text-[10px] text-figma-muted hover:text-white transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortOrder === 'asc' ? <SortAscIcon className="w-3 h-3" /> : <SortDescIcon className="w-3 h-3" />}
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </button>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAndSortedPrompts.length === 0 && (
            <div className="px-4 py-6 text-xs text-figma-muted text-center italic">
              {searchQuery ? 'No projects found matching your search.' : 'No projects yet. Create your first project!'}
            </div>
          )}

          <div className="">
            {filteredAndSortedPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`group transition-colors ${activePromptId === prompt.id
                  ? 'bg-figma-hover'
                  : 'hover:bg-figma-bg/50'
                  }`}
              >
                {editingProjectId === prompt.id ? (
                  <div className="px-3 py-2 space-y-2">
                    <input
                      type="text"
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProjectName();
                        if (e.key === 'Escape') handleCancelEditProject();
                      }}
                      className="w-full bg-figma-bg border border-figma-border rounded px-2 py-1 text-xs text-white focus:border-figma-accent outline-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={handleCancelEditProject}
                        className="text-[10px] text-figma-muted hover:text-white px-2 py-0.5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProjectName}
                        className="text-[10px] bg-figma-accent text-white px-2 py-0.5 rounded"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => onSelectPrompt(prompt.id)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                    >
                      <FileTextIcon className={`w-3.5 h-3.5 flex-shrink-0 ${activePromptId === prompt.id ? 'text-figma-accent' : 'text-figma-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate font-medium ${activePromptId === prompt.id ? 'text-figma-accent' : 'text-white'}`}>
                          {prompt.name}
                        </div>
                        {prompt.description && (
                          <div className="text-[10px] text-figma-muted truncate">
                            {prompt.description}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdownId(activeDropdownId === prompt.id ? null : prompt.id)}
                        className="p-1.5 hover:bg-figma-hover text-figma-muted hover:text-white transition-colors rounded opacity-0 group-hover:opacity-100"
                        title="More options"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      </button>

                      {activeDropdownId === prompt.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 top-full mt-1 bg-figma-panel border border-figma-border rounded shadow-lg z-50 py-1 min-w-[120px]"
                        >
                          <Button
                            onClick={() => {
                              handleStartEditProject(prompt);
                              setActiveDropdownId(null);
                            }}
                            variant="ghost"
                            className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-figma-hover transition-colors flex items-center gap-2"
                          >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12.146 5.596l.708-.708a.5.5 0 00-.708-.708l-.708.708a.5.5 0 00.708.708zM3.854 8.854l5.646-5.646-.708-.708L3.146 8.146l.708.708zm6.292-6.292l1.415 1.414.708-.708-1.415-1.414-.708.708zm-7.071 7.071L1.5 12.207V14h1.793l2.565-2.565-.708-.708z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                            </svg>
                            Rename
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              onDeleteProject(prompt.name);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-figma-hover transition-colors flex items-center gap-2"
                          >
                            <TrashIcon className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Variables Section - Only show when project is active */}
      {activePrompt && (
        <div className="border-t border-figma-border">
          <div className="p-3">
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

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {activePrompt.projectVariables?.map((variable) => (
                <div key={variable.id} className="group transition-colors hover:bg-figma-bg/50">
                  {editingVarId === variable.id ? (
                    <div className="px-3 py-2 space-y-1.5">
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
                    <div className="flex items-center px-3 py-2">
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
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {onInsertVariable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInsertVariable(variable.key);
                            }}
                            className="p-1 hover:bg-figma-hover rounded transition-opacity"
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
                          className="p-1 hover:bg-figma-hover text-figma-muted hover:text-red-400 transition-opacity rounded"
                          title="Delete variable"
                        >
                          <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.22386 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11.296L10.868 12.132C10.7917 13.582 9.59228 14.75 8.14007 14.75H6.85993C5.40772 14.75 4.20827 13.582 4.13199 12.132L3.70402 4H3.5C3.22386 4 3 3.77614 3 3.5ZM4.71201 4L5.13201 12.079C5.17014 12.804 5.76987 13.3885 6.49587 13.3885H8.50413C9.23013 13.3885 9.82986 12.804 9.86799 12.079L10.288 4H4.71201Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(!activePrompt.projectVariables || activePrompt.projectVariables.length === 0) && (
                <div className="text-xs text-figma-muted italic px-3 py-2">No variables</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="p-3 border-t border-figma-border space-y-2">
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
