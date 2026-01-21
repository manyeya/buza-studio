import { useState, useEffect, useCallback } from 'react';
import { PromptData, PromptVariant, Variable } from '../../../../types';
import { PlayIcon, MagicIcon, CopyIcon, SparklesIcon, KeyboardIcon } from '@/components/Icons';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useVariableTracking } from '@/hooks/useVariableTracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

// Define custom grammar for variables
languages.prompt = {
    'project-variable': /@\{\{[\s\S]*?\}\}/,
    'variable': /\{\{[\s\S]*?\}\}/
};

type ExportFormat = 'JSON' | 'YAML' | 'XML' | 'PROMPT';
type OutputTab = 'OUTPUT' | 'EXPORT';

interface WorkspaceProps {
    variant: PromptVariant;
    projectName: string;
    projectVariables: Variable[];
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
    projectVariables,
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
    
    // Output/Export State
    const [activeOutputTab, setActiveOutputTab] = useState<OutputTab>('OUTPUT');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('JSON');
    const [copyFeedback, setCopyFeedback] = useState(false);

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
        setActiveOutputTab('OUTPUT'); // Switch to output tab when running
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

    const generateExport = () => {
        const variablesMap = variant.variables.reduce((acc, v) => ({ ...acc, [v.key]: v.value }), {} as Record<string, string>);

        // Replace variables in content for export
        let processedContent = variant.content;

        // First replace @{{}} (project variables)
        projectVariables?.forEach(v => {
            processedContent = processedContent.replace(new RegExp(`@\\{\\{${v.key}\\}\\}`, 'g'), v.value);
        });

        // Then replace {{}} (variant variables)
        variant.variables.forEach(v => {
            processedContent = processedContent.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value);
        });

        const exportData: any = {
            name: variant.name,
            prompt: processedContent,
        };

        if (variant.config.systemInstruction) {
            exportData.systemInstruction = variant.config.systemInstruction;
        }

        if (Object.keys(variablesMap).length > 0) {
            exportData.variables = variablesMap;
        }

        if (exportFormat === 'JSON') {
            return JSON.stringify(exportData, null, 2);
        }

        if (exportFormat === 'YAML') {
            const serialize = (obj: any, indent = 0): string => {
                const spaces = '  '.repeat(indent);
                return Object.entries(obj).map(([key, value]) => {
                    if (value === undefined || value === null) return `${spaces}${key}:`;
                    if (typeof value === 'object') {
                        if (Object.keys(value).length === 0) return `${spaces}${key}: {}`;
                        return `${spaces}${key}:\n${serialize(value, indent + 1)}`;
                    }
                    let valStr = String(value);
                    if (valStr.includes('\n') || valStr.includes(':') || valStr.trim() === '') {
                        valStr = `"${valStr.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
                    }
                    return `${spaces}${key}: ${valStr}`;
                }).join('\n');
            };
            return serialize(exportData);
        }

        if (exportFormat === 'XML') {
            const escape = (str: string) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<variant name="${escape(exportData.name)}">\n`;
            if (exportData.systemInstruction) {
                xml += `  <systemInstruction>${escape(exportData.systemInstruction)}</systemInstruction>\n`;
            }
            xml += `  <prompt>${escape(exportData.prompt)}</prompt>\n`;
            if (exportData.variables) {
                xml += `  <variables>\n`;
                Object.entries(exportData.variables).forEach(([k, v]) => {
                    xml += `    <variable key="${escape(k)}">${escape(String(v))}</variable>\n`;
                });
                xml += `  </variables>\n`;
            }
            xml += `</variant>`;
            return xml;
        }

        if (exportFormat === 'PROMPT') {
            let text = variant.content;

            // First replace @{{}} (project variables)
            projectVariables?.forEach(v => {
                text = text.replace(new RegExp(`@\\{\\{${v.key}\\}\\}`, 'g'), v.value);
            });

            // Then replace {{}} (variant variables)
            variant.variables.forEach(v => {
                text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value);
            });

            let result = "";
            if (variant.config.systemInstruction) {
                result += `[System Instruction]\n${variant.config.systemInstruction}\n\n`;
            }
            result += `[Prompt]\n${text}`;
            return result;
        }

        return '';
    };

    const copyExportToClipboard = () => {
        navigator.clipboard.writeText(generateExport());
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const getSyntaxLanguage = () => {
        switch (exportFormat) {
            case 'JSON':
                return 'json';
            case 'YAML':
                return 'yaml';
            case 'XML':
                return 'xml';
            case 'PROMPT':
            default:
                return 'text';
        }
    };

    const showOverlay = !variant.content && emptyStateStep !== 'MANUAL';

    // Split view state
    return (
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-0.5">
                        <Input
                            type="text"
                            value={localProjectName}
                            onChange={(e) => setLocalProjectName(e.target.value)}
                            className="h-6 bg-transparent text-sm font-medium text-foreground border-transparent focus-visible:ring-0 focus:border-border px-1 -ml-1 hover:border-border transition-colors w-64 shadow-none rounded-sm"
                            placeholder="Project Name"
                        />
                        <Input
                            type="text"
                            value={localVariantName}
                            onChange={(e) => setLocalVariantName(e.target.value)}
                            className="h-5 bg-transparent text-[10px] text-muted-foreground border-transparent focus-visible:ring-0 focus:border-border px-1 -ml-1 hover:border-border transition-colors w-40 shadow-none rounded-sm"
                            placeholder="Variant Name"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || isSaving}
                        variant={hasUnsavedChanges ? "outline" : "ghost"}
                        size="sm"
                        className={`gap-1.5 h-8 text-xs font-medium transition-colors ${
                            hasUnsavedChanges 
                                ? 'border-primary text-primary hover:text-primary hover:bg-primary/10' 
                                : 'text-muted-foreground'
                        }`}
                        title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
                    >
                        {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : saveFeedback ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : null}
                        {isSaving ? 'Saving...' : saveFeedback ? 'Saved!' : 'Save'}
                    </Button>
                    
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    
                    <Button
                        onClick={handleRun}
                        disabled={isRunning}
                        variant="default"
                        size="sm"
                        className="gap-1.5 px-4 h-8 rounded-full text-xs font-bold"
                    >
                        {isRunning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <PlayIcon className="w-3 h-3 fill-current" />
                        )}
                        Run
                    </Button>
                </div>
            </div>

            {/* Main Content Area - Split View */}
            <div className="flex-1 flex overflow-hidden">

                {/* Editor (Left) */}
                <div className="flex-1 flex flex-col border-r border-border min-w-[300px] relative">
                    <div className="h-8 bg-background border-b border-border flex items-center justify-between px-4">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Prompt Template</span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                title="AI Refine"
                            >
                                <MagicIcon className={`w-3 h-3 ${isOptimizing ? 'animate-pulse text-primary' : 'text-primary'}`} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={copyToClipboard}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                title="Copy"
                            >
                                <CopyIcon className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Empty State Overlay */}
                    {showOverlay && (
                        <div className="absolute inset-0 top-8 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm z-10 p-6 animate-in fade-in duration-200">

                            {/* Step 1: Choice Dialog */}
                            {emptyStateStep === 'CHOICE' && (
                                <div className="w-full max-w-lg">
                                    <h3 className="text-base font-semibold text-foreground mb-6 text-center">Start a new prompt</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setEmptyStateStep('MAGIC')}
                                            className="flex flex-col items-center justify-center gap-3 p-8 bg-card border border-border rounded-lg hover:border-primary hover:bg-accent transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                <SparklesIcon className="w-5 h-5" />
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm font-medium text-foreground mb-1">AI Generator</div>
                                                <div className="text-[11px] text-muted-foreground">Describe your goal and let AI draft it</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={handleManualEntry}
                                            className="flex flex-col items-center justify-center gap-3 p-8 bg-card border border-border rounded-lg hover:border-primary hover:bg-accent transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-transform">
                                                <KeyboardIcon className="w-5 h-5" />
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm font-medium text-foreground mb-1">Manual Entry</div>
                                                <div className="text-[11px] text-muted-foreground">Start from scratch with a blank editor</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Magic Input Card */}
                            {emptyStateStep === 'MAGIC' && (
                                <div className="w-full max-w-md bg-card border border-border rounded-lg p-5 shadow-2xl animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <SparklesIcon className="w-4 h-4 text-primary" />
                                            Text to Prompt
                                        </h3>
                                        <button onClick={() => setEmptyStateStep('CHOICE')} className="text-[10px] text-muted-foreground hover:text-foreground">
                                            Back
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mb-3">
                                        Describe what you want to achieve, and AI will structure the prompt, system instructions, and variables for you.
                                    </p>
                                    <Textarea
                                        autoFocus
                                        className="w-full mb-4 resize-none min-h-[80px]"
                                        placeholder="E.g., 'A prompt that analyzes financial reports and extracts key risk factors...'"
                                        value={generationDescription}
                                        onChange={e => setGenerationDescription(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleGenerateFromDescription}
                                            disabled={isGenerating || !generationDescription.trim()}
                                            className="flex-1 w-full"
                                        >
                                            {isGenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <SparklesIcon className="w-3 h-3 mr-2" />}
                                            Generate Prompt Structure
                                        </Button>
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

                {/* Output & Export (Right) */}
                <div className="flex-1 flex flex-col min-w-[300px] bg-[#1a1a1a]">
                    <div className="h-8 bg-background border-b border-border flex items-center justify-between px-0">
                        <div className="flex h-full">
                            <button
                                onClick={() => setActiveOutputTab('OUTPUT')}
                                className={`px-4 text-[10px] font-bold uppercase tracking-wider h-full border-r border-border transition-colors ${
                                    activeOutputTab === 'OUTPUT' 
                                        ? 'bg-[#1a1a1a] text-foreground' 
                                        : 'bg-background text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Output
                            </button>
                            <button
                                onClick={() => setActiveOutputTab('EXPORT')}
                                className={`px-4 text-[10px] font-bold uppercase tracking-wider h-full border-r border-border transition-colors ${
                                    activeOutputTab === 'EXPORT' 
                                        ? 'bg-[#1a1a1a] text-foreground' 
                                        : 'bg-background text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Export
                            </button>
                        </div>
                        
                        {activeOutputTab === 'OUTPUT' && variant.lastRunTime && (
                            <span className="mr-4 text-[10px] text-muted-foreground">
                                Last run: {new Date(variant.lastRunTime).toLocaleTimeString()}
                            </span>
                        )}
                        
                        {activeOutputTab === 'EXPORT' && (
                            <div className="flex items-center gap-1 mr-2">
                                {(['JSON', 'XML', 'YAML', 'PROMPT'] as ExportFormat[]).map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => setExportFormat(fmt)}
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                                            exportFormat === fmt 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                    >
                                        {fmt === 'PROMPT' ? 'TEXT' : fmt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-0 relative">
                        {activeOutputTab === 'OUTPUT' ? (
                            <div className="p-6 h-full">
                                {variant.lastOutput ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                                            {variant.lastOutput}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                        <PlayIcon className="w-8 h-8 mb-2" />
                                        <span className="text-xs">Run the prompt to see results</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 relative overflow-auto custom-scrollbar">
                                    <SyntaxHighlighter
                                        language={getSyntaxLanguage()}
                                        style={oneDark}
                                        customStyle={{
                                            margin: 0,
                                            padding: '24px',
                                            background: 'transparent',
                                            fontSize: '12px',
                                            lineHeight: '1.5',
                                            height: '100%',
                                        }}
                                        codeTagProps={{ style: { fontSize: '12px' } }}
                                        showLineNumbers={true}
                                        wrapLines={true}
                                        wrapLongLines={true}
                                    >
                                        {generateExport()}
                                    </SyntaxHighlighter>
                                    
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        onClick={copyExportToClipboard}
                                        className="absolute top-4 right-4 h-8 w-8 opacity-80 hover:opacity-100 shadow-lg z-10 bg-background/50 backdrop-blur border border-border"
                                        title="Copy to clipboard"
                                    >
                                        {copyFeedback ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12" /></svg>
                                        ) : (
                                            <CopyIcon className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Workspace;
