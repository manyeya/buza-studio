
import React, { useState } from 'react';
import { Variable } from '../../types';
import { XIcon, PlusIcon, DownloadIcon, TrashIcon } from './Icons';

interface VariableLibraryModalProps {
  onClose: () => void;
  onImport: (v: Variable) => void;
  library: Variable[];
  onAddToLibrary: (v: Variable) => void;
  onRemoveFromLibrary: (id: string) => void;
}

const VariableLibraryModal: React.FC<VariableLibraryModalProps> = ({ 
    onClose, 
    onImport, 
    library, 
    onAddToLibrary, 
    onRemoveFromLibrary 
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleCreate = () => {
      if (!newKey.trim()) return;
      onAddToLibrary({
          id: crypto.randomUUID(),
          key: newKey.trim(),
          value: newValue
      });
      setNewKey('');
      setNewValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-figma-bg border border-figma-border w-[600px] h-[500px] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="h-14 border-b border-figma-border flex items-center justify-between px-6 bg-figma-panel">
          <div>
             <h2 className="text-sm font-semibold text-white">Variable Library</h2>
             <p className="text-[11px] text-figma-muted">Manage global variables to reuse across prompts.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-figma-muted hover:text-white hover:bg-figma-hover rounded transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-figma-bg">
          
          {/* Create New */}
          <div className="bg-figma-panel border border-figma-border rounded p-3 mb-6">
              <div className="text-[11px] font-bold text-figma-muted uppercase mb-2">Create New Global Variable</div>
              <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-figma-bg border border-figma-border rounded px-2">
                      <span className="text-figma-accent text-xs font-mono mr-1">{'{{'}</span>
                      <input 
                        type="text" 
                        placeholder="key" 
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none w-full py-1.5"
                      />
                      <span className="text-figma-accent text-xs font-mono ml-1">{'}}'}</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Default Value" 
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="flex-[2] bg-figma-bg border border-figma-border rounded px-2 text-xs text-white focus:outline-none py-1.5"
                  />
                  <button 
                    onClick={handleCreate}
                    disabled={!newKey.trim()}
                    className="bg-figma-accent hover:bg-[#1ed760] text-black px-3 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <PlusIcon className="w-4 h-4" />
                  </button>
              </div>
          </div>

          {/* List */}
          <div className="space-y-2">
              <div className="text-[11px] font-bold text-figma-muted uppercase mb-2 flex justify-between">
                  <span>Saved Variables</span>
                  <span>{library.length} items</span>
              </div>
              
              {library.length === 0 && (
                  <div className="text-center text-figma-muted text-xs italic py-8 border border-dashed border-figma-border rounded">
                      Library is empty. Save variables from your prompts or add them here.
                  </div>
              )}

              {library.map((v) => (
                  <div key={v.id} className="group flex items-center gap-3 bg-figma-panel border border-figma-border rounded p-2 hover:border-figma-muted transition-colors">
                      <div className="w-8 h-8 rounded bg-figma-bg flex items-center justify-center text-figma-muted">
                          <span className="text-[10px] font-mono font-bold">V</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                              {/* Fix: Use single curly braces for JSX string expression */}
                              <span className="text-xs font-mono text-figma-accent">{`{{${v.key}}}`}</span>
                          </div>
                          <div className="text-[11px] text-figma-muted truncate" title={v.value}>
                              {v.value || <span className="italic opacity-50">No default value</span>}
                          </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { onImport(v); onClose(); }}
                            className="p-1.5 bg-figma-accent text-black rounded hover:brightness-110"
                            title="Add to current prompt"
                          >
                              <DownloadIcon className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => onRemoveFromLibrary(v.id)}
                            className="p-1.5 text-figma-muted hover:text-figma-danger hover:bg-figma-bg rounded"
                            title="Delete from library"
                          >
                              <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariableLibraryModal;
