import React from 'react';
import { Template } from '../types';
import { XIcon, FileTextIcon } from './Icons';

interface TemplateLibraryModalProps {
  onClose: () => void;
  onSelect: (template: Template) => void;
  templates: Template[];
}

const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({ onClose, onSelect, templates }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-figma-bg border border-figma-border w-[800px] h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="h-14 border-b border-figma-border flex items-center justify-between px-6 bg-figma-panel">
          <div>
             <h2 className="text-sm font-semibold text-white">Template Library</h2>
             <p className="text-[11px] text-figma-muted">Jumpstart your prompt engineering with pre-built templates</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template, index) => (
              <div 
                key={index}
                onClick={() => onSelect(template)}
                className="group relative bg-figma-panel border border-figma-border rounded-lg p-4 cursor-pointer hover:border-figma-accent hover:shadow-[0_0_0_1px_#1DB954] transition-all flex flex-col h-40"
              >
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded bg-figma-bg flex items-center justify-center text-figma-accent">
                        <FileTextIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">{template.name}</h3>
                        <span className="text-[10px] text-figma-muted inline-block bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#333]">
                            {template.config.model.replace('gemini-', '')}
                        </span>
                    </div>
                </div>
                
                <p className="text-[11px] text-figma-muted line-clamp-3 leading-relaxed">
                    {template.description}
                </p>

                <div className="mt-auto pt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-figma-accent font-medium">Click to use</span>
                    <span className="text-[10px] text-figma-muted">{template.variables.length} variables</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-figma-border bg-figma-panel flex items-center justify-end px-6">
           <button onClick={onClose} className="text-xs text-figma-muted hover:text-white px-3 py-2">
             Cancel
           </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateLibraryModal;