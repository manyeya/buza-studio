
import React, { useState, useEffect, useRef } from 'react';
import { PromptData, PromptVariant } from '../types';
import { PlayIcon, MagicIcon, CopyIcon, SparklesIcon, KeyboardIcon } from './Icons';
import * as GeminiService from '../services/geminiService';

interface WorkspaceProps {
  variant: PromptVariant;
  projectName: string;
  onUpdateVariant: (updated: Partial<PromptVariant>) => void;
  onUpdateProject: (updated: Partial<PromptData>) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({ variant, projectName, onUpdateVariant, onUpdateProject }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationDescription, setGenerationDescription] = useState('');
  
  // Empty State Logic
  const [emptyStateStep, setEmptyStateStep] = useState<'CHOICE' | 'MAGIC' | 'MANUAL'>('CHOICE');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
     // Reset empty state workflow when switching variants
     if (!variant.content) {
         setEmptyStateStep('CHOICE');
     } else {
         setEmptyStateStep('MANUAL');
     }
  }, [variant.id]);

  // If content is added (e.g. pasted), automatically switch to manual mode to hide overlay
  useEffect(() => {
    if (variant.content && emptyStateStep !== 'MANUAL') {
        setEmptyStateStep('MANUAL');
    }
  }, [variant.content]);

  // Debounced Auto-detection of variables (Handlebars style)
  useEffect(() => {
    const handler = setTimeout(() => {
        // Find all unique matches for {{variable_name}}
        const regex = /{{([\w-]+)}}/g;
        const matches = [...variant.content.matchAll(regex)];
        const foundKeys = new Set(matches.map(m => m[1]));
        
        // Identify keys that are not yet in the variables list
        const existingKeys = new Set(variant.variables.map(v => v.key));
        const newKeys = [...foundKeys].filter(k => !existingKeys.has(k));

        // Only update if there are actually new variables to add
        if (newKeys.length > 0) {
            const newVariables = newKeys.map(key => ({
                id: crypto.randomUUID(),
                key,
                value: ''
            }));
            onUpdateVariant({
                variables: [...variant.variables, ...newVariables]
            });
        }
    }, 800); // 800ms debounce to prevent lag on every keystroke

    return () => clearTimeout(handler);
  }, [variant.content]); // Dependency strictly on content

  const handleRun = async () => {
    setIsRunning(true);
    
    // Prepare variables map
    const vars: Record<string, string> = {};
    variant.variables.forEach(v => {
      vars[v.key] = v.value;
    });

    const output = await GeminiService.runPrompt(variant.content, variant.config, vars);
    
    onUpdateVariant({ 
        lastOutput: output,
        lastRunTime: Date.now()
    });
    
    setIsRunning(false);
  };

  const handleOptimize = async () => {
    if (!variant.content.trim()) return;
    
    setIsOptimizing(true);
    const optimizedContent = await GeminiService.optimizePrompt(variant.content);
    
    if (optimizedContent !== variant.content) {
        onUpdateVariant({ content: optimizedContent });
    }
    setIsOptimizing(false);
  };

  const handleGenerateFromDescription = async () => {
     if (!generationDescription.trim()) return;
     setIsGenerating(true);
     try {
         const result = await GeminiService.generatePromptStructure(generationDescription);
         onUpdateVariant({
             content: result.content,
             config: {
                 ...variant.config,
                 systemInstruction: result.systemInstruction || '',
                 model: result.model || variant.config.model
             },
             variables: result.variables.map(v => ({
                 id: crypto.randomUUID(),
                 key: v.key,
                 value: v.value
             }))
         });
         setGenerationDescription('');
         // The useEffect will catch the content update and switch to MANUAL (hiding overlay)
     } catch (e) {
         console.error(e);
     } finally {
         setIsGenerating(false);
     }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(variant.content);
  };

  const handleManualEntry = () => {
      setEmptyStateStep('MANUAL');
      setTimeout(() => {
          textareaRef.current?.focus();
      }, 50);
  };

  const showOverlay = !variant.content && emptyStateStep !== 'MANUAL';

  // Split view state
  return (
    <div className="flex-1 flex flex-col h-full bg-figma-bg relative overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-figma-border flex items-center justify-between px-4 bg-figma-bg">
        <div className="flex items-center gap-4">
             <div className="flex flex-col">
                <input 
                    type="text" 
                    value={projectName}
                    onChange={(e) => onUpdateProject({ name: e.target.value })}
                    className="bg-transparent text-sm font-medium text-white focus:outline-none border border-transparent focus:border-figma-border rounded px-1 -ml-1 hover:border-figma-border transition-colors w-64"
                    placeholder="Project Name"
                />
                <input
                    type="text"
                    value={variant.name}
                    onChange={(e) => onUpdateVariant({ name: e.target.value })}
                    className="bg-transparent text-[10px] text-figma-muted focus:outline-none focus:text-white border border-transparent focus:border-figma-border rounded px-1 -ml-1 hover:border-figma-border transition-colors w-40"
                    placeholder="Variant Name"
                />
             </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={handleOptimize}
                disabled={isOptimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-figma-text hover:bg-figma-hover transition-colors disabled:opacity-50"
                title="AI Improve"
            >
                <MagicIcon className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-pulse text-figma-accent' : 'text-figma-accent'}`} />
                {isOptimizing ? 'Optimizing...' : 'AI Refine'}
            </button>
            <div className="w-px h-4 bg-figma-border mx-1" />
            <button 
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-figma-accent hover:bg-[#1ed760] text-black rounded-full text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isRunning ? (
                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                    <PlayIcon className="w-3 h-3 fill-current" />
                )}
                Run
            </button>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Editor (Left) */}
        <div className="flex-1 flex flex-col border-r border-figma-border min-w-[300px] relative">
           <div className="h-8 bg-figma-bg border-b border-figma-border flex items-center justify-between px-4">
                <span className="text-[10px] uppercase font-bold text-figma-muted tracking-wider">Prompt Template</span>
                <button onClick={copyToClipboard} className="text-figma-muted hover:text-white" title="Copy">
                    <CopyIcon className="w-3 h-3" />
                </button>
           </div>
           
           {/* Empty State Overlay */}
           {showOverlay && (
              <div className="absolute inset-0 top-8 flex flex-col items-center justify-center bg-[#1e1e1e] z-10 p-6 animate-in fade-in duration-200">
                  
                  {/* Step 1: Choice Dialog */}
                  {emptyStateStep === 'CHOICE' && (
                      <div className="w-full max-w-lg">
                          <h3 className="text-base font-semibold text-white mb-6 text-center">Start a new prompt</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <button 
                                onClick={() => setEmptyStateStep('MAGIC')}
                                className="flex flex-col items-center justify-center gap-3 p-8 bg-figma-panel border border-figma-border rounded-lg hover:border-figma-accent hover:bg-figma-hover transition-all group"
                              >
                                  <div className="w-10 h-10 rounded-full bg-figma-bg flex items-center justify-center text-figma-accent group-hover:scale-110 transition-transform">
                                      <SparklesIcon className="w-5 h-5" />
                                  </div>
                                  <div className="text-center">
                                      <div className="text-sm font-medium text-white mb-1">AI Generator</div>
                                      <div className="text-[11px] text-figma-muted">Describe your goal and let AI draft it</div>
                                  </div>
                              </button>

                              <button 
                                onClick={handleManualEntry}
                                className="flex flex-col items-center justify-center gap-3 p-8 bg-figma-panel border border-figma-border rounded-lg hover:border-figma-accent hover:bg-figma-hover transition-all group"
                              >
                                  <div className="w-10 h-10 rounded-full bg-figma-bg flex items-center justify-center text-figma-muted group-hover:text-white group-hover:scale-110 transition-transform">
                                      <KeyboardIcon className="w-5 h-5" />
                                  </div>
                                  <div className="text-center">
                                      <div className="text-sm font-medium text-white mb-1">Manual Entry</div>
                                      <div className="text-[11px] text-figma-muted">Start from scratch with a blank editor</div>
                                  </div>
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Step 2: Magic Input Card */}
                  {emptyStateStep === 'MAGIC' && (
                    <div className="w-full max-w-md bg-figma-panel border border-figma-border rounded-lg p-5 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-3">
                             <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-figma-accent" />
                                Text to Prompt
                             </h3>
                             <button onClick={() => setEmptyStateStep('CHOICE')} className="text-[10px] text-figma-muted hover:text-white">
                                 Back
                             </button>
                        </div>
                        <p className="text-[11px] text-figma-muted mb-3">
                            Describe what you want to achieve, and AI will structure the prompt, system instructions, and variables for you.
                        </p>
                        <textarea 
                            autoFocus
                            className="w-full bg-figma-bg border border-figma-border rounded p-3 text-xs text-white placeholder-figma-muted focus:border-figma-accent focus:outline-none resize-none mb-4"
                            rows={3}
                            placeholder="E.g., 'A prompt that analyzes financial reports and extracts key risk factors...'"
                            value={generationDescription}
                            onChange={e => setGenerationDescription(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={handleGenerateFromDescription}
                                disabled={isGenerating || !generationDescription.trim()}
                                className="flex-1 bg-figma-accent hover:bg-[#1ed760] text-black font-semibold text-xs py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isGenerating ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                                Generate Prompt Structure
                            </button>
                        </div>
                    </div>
                  )}
              </div>
           )}

           <textarea
                ref={textareaRef}
                className="flex-1 w-full bg-[#1e1e1e] p-6 text-sm font-mono text-gray-200 focus:outline-none resize-none leading-relaxed relative z-0"
                placeholder="Write your prompt here... Use {{variable}} for dynamic inputs."
                value={variant.content}
                onChange={(e) => onUpdateVariant({ content: e.target.value })}
                spellCheck={false}
           />
        </div>

        {/* Output (Right) */}
        <div className="flex-1 flex flex-col min-w-[300px] bg-[#1a1a1a]">
           <div className="h-8 bg-figma-bg border-b border-figma-border flex items-center px-4">
                <span className="text-[10px] uppercase font-bold text-figma-muted tracking-wider">Output</span>
                {variant.lastRunTime && (
                    <span className="ml-auto text-[10px] text-figma-muted">
                        Last run: {new Date(variant.lastRunTime).toLocaleTimeString()}
                    </span>
                )}
           </div>
           <div className="flex-1 overflow-y-auto p-6">
               {variant.lastOutput ? (
                   <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                            {variant.lastOutput}
                        </pre>
                   </div>
               ) : (
                   <div className="h-full flex flex-col items-center justify-center text-figma-muted opacity-50">
                       <PlayIcon className="w-8 h-8 mb-2" />
                       <span className="text-xs">Run the prompt to see results</span>
                   </div>
               )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default Workspace;
