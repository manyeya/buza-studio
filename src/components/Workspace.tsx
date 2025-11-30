import { useState, useEffect, useRef, useCallback } from 'react';
import { PromptData, PromptVariant } from '../../types';
import { PlayIcon, MagicIcon, CopyIcon, SparklesIcon, KeyboardIcon } from './Icons';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import { useVariableTracking } from '../hooks/useVariableTracking';

// Define custom grammar for variables
languages.prompt = {
    'project-variable': /@\{\{[\s\S]*?\}\}/,
    'variable': /\{\{[\s\S]*?\}\}/
};

interface WorkspaceProps {
    variant: PromptVariant;
    projectName: string;
    onUpdateVariant: (updated: Partial<PromptVariant>) => void;
    onUpdateProject: (updated: Partial<PromptData>) => void;
    onSave: () => void;
    onRun: () => void;
    onOptimize: () => void;
    onGenerateStructure: (description: string) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
    variant,
    projectName,
    onUpdateVariant,
    onUpdateProject,
    onSave,
    onRun,
    onOptimize,
    onGenerateStructure
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationDescription, setGenerationDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState(false);

    // Local state for editor content to prevent cursor jumping
    const [code, setCode] = useState(variant.content);

    // Local state for project name to prevent immediate updates
    const [localProjectName, setLocalProjectName] = useState(projectName);

    // Local state for variant name
    const [localVariantName, setLocalVariantName] = useState(variant.name);

    // Automatic variable tracking from content
    const handleUpdateVariables = useCallback((variables: any[]) => {
        onUpdateVariant({ variables });
    }, [onUpdateVariant]);

    useVariableTracking(code, variant.variables, handleUpdateVariables);

    // Dirty state tracking
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Check for unsaved changes
    useEffect(() => {
        const projectNameChanged = localProjectName !== projectName;
        const variantNameChanged = localVariantName !== variant.name;
        const contentChanged = code !== variant.content;

        setHasUnsavedChanges(projectNameChanged || variantNameChanged || contentChanged);
    }, [localProjectName, localVariantName, code, projectName, variant.name, variant.content]);

    // Sync local state when variant changes (switching variants)
    useEffect(() => {
        setCode(variant.content);
        setLocalVariantName(variant.name);
    }, [variant.id]);

    // Sync local project name when prop changes
    useEffect(() => {
        setLocalProjectName(projectName);
    }, [projectName]);

    // Empty State Logic
    const [emptyStateStep, setEmptyStateStep] = useState<'CHOICE' | 'MAGIC' | 'MANUAL'>('CHOICE');
    // We use an ID for the editor textarea to focus it, as the Editor component might not forward ref easily to the textarea
    const EDITOR_ID = "prompt-editor-textarea";

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

    // Handle save with feedback
    const handleSave = async () => {
        if (!hasUnsavedChanges) return;

        setIsSaving(true);
        try {
            // Save all changes at once
            const updates: Partial<PromptVariant> = {};
            const projectUpdates: Partial<PromptData> = {};

            if (code !== variant.content) {
                updates.content = code;
            }
            if (localVariantName !== variant.name) {
                updates.name = localVariantName;
            }
            if (localProjectName !== projectName) {
                projectUpdates.name = localProjectName;
            }

            // Apply updates
            if (Object.keys(updates).length > 0) {
                onUpdateVariant(updates);
            }
            if (Object.keys(projectUpdates).length > 0) {
                onUpdateProject(projectUpdates);
            }

            // Call the parent save function
            onSave();

            // Show feedback
            setSaveFeedback(true);
            setTimeout(() => setSaveFeedback(false), 2000);
        } finally {
            setIsSaving(false);
        }
    };


    const handleRun = async () => {
        setIsRunning(true);
        await onRun();
        setIsRunning(false);
    };

    const handleOptimize = async () => {
        setIsOptimizing(true);
        await onOptimize();
        setIsOptimizing(false);
    };

    const handleGenerateFromDescription = async () => {
        if (!generationDescription.trim()) return;
        setIsGenerating(true);
        try {
            onGenerateStructure(generationDescription);
            setGenerationDescription('');
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
            const el = document.getElementById(EDITOR_ID);
            el?.focus();
        }, 50);
    };

    const showOverlay = !variant.content && emptyStateStep !== 'MANUAL';

    // Split view state
    return (
        <div className="flex-1 flex flex-col h-full bg-figma-bg relative overflow-hidden">
            <style>{`
                .token.variable {
                    color: #1DB954;
                    font-weight: bold;
                }
                .token.project-variable {
                    color: #FFA500;
                    font-weight: bold;
                }
                /* Override editor styles to match design */
                .prompt-editor-container textarea {
                    outline: none !important;
                }
            `}</style>
            {/* Top Toolbar */}
            <div className="h-14 border-b border-figma-border flex items-center justify-between px-4 bg-figma-bg">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <input
                            type="text"
                            value={localProjectName}
                            onChange={(e) => setLocalProjectName(e.target.value)}
                            className="bg-transparent text-sm font-medium text-white focus:outline-none border border-transparent focus:border-figma-border rounded px-1 -ml-1 hover:border-figma-border transition-colors w-64"
                            placeholder="Project Name"
                        />
                        <input
                            type="text"
                            value={localVariantName}
                            onChange={(e) => setLocalVariantName(e.target.value)}
                            className="bg-transparent text-[10px] text-figma-muted focus:outline-none focus:text-white border border-transparent focus:border-figma-border rounded px-1 -ml-1 hover:border-figma-border transition-colors w-40"
                            placeholder="Variant Name"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${hasUnsavedChanges
                            ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black border border-[#1DB954]'
                            : 'bg-figma-panel border border-figma-border text-figma-muted'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
                    >
                        {isSaving ? (
                            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : saveFeedback ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (""
                        )}
                        {isSaving ? 'Saving...' : saveFeedback ? 'Saved!' : 'Save'}
                    </button>
                    <div className="w-px h-4 bg-figma-border mx-1" />
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className="text-figma-muted hover:text-white transition-colors p-1 hover:bg-figma-hover rounded"
                                title="AI Refine"
                            >
                                <MagicIcon className={`w-3 h-3 ${isOptimizing ? 'animate-pulse text-figma-accent' : 'text-figma-accent'}`} />
                            </button>
                            <button onClick={copyToClipboard} className="text-figma-muted hover:text-white p-1 hover:bg-figma-hover rounded" title="Copy">
                                <CopyIcon className="w-3 h-3" />
                            </button>
                        </div>
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


                    <div
                        className="flex-1 w-full bg-[#1e1e1e] relative z-0 overflow-y-auto prompt-editor-container custom-scrollbar"
                    >
                        <Editor
                            value={code}
                            onValueChange={(newCode) => setCode(newCode)}
                            highlight={code => highlight(code, languages.prompt, 'prompt')}
                            padding={24}
                            textareaId={EDITOR_ID}
                            className="font-mono text-sm leading-relaxed"
                            style={{
                                fontFamily: '"Fira Code", "Fira Mono", monospace',
                                fontSize: 14,
                                backgroundColor: '#1e1e1e',
                                color: '#e5e7eb', // gray-200
                                minHeight: '100%',
                            }}
                        />
                    </div>
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
