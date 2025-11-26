
import React, { useState } from 'react';
import { PromptData, Variable, PromptVersion, PromptVariant } from '../../types';
import { CopyIcon, BookmarkIcon, RotateCcwIcon, PlusIcon, LayersIcon, TrashIcon, BookIcon } from './Icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UniversalDropdown } from './ui/universal-dropdown';

interface PropertiesPanelProps {
    prompt: PromptData;
    activeVariant: PromptVariant;
    onUpdateVariant: (updated: Partial<PromptVariant>) => void;
    onUpdateProject: (updated: Partial<PromptData>) => void;
    onAddVariant: () => void;
    onDeleteVariant: (id: string) => void;
    onSaveAsTemplate: () => void;
    onSaveVersion: (name: string) => void;
    onRestoreVersion: (version: PromptVersion) => void;
    onOpenVariableLibrary: () => void;
    onSaveVariableToLibrary: (v: Variable) => void;
}

type ExportFormat = 'JSON' | 'YAML' | 'XML' | 'PROMPT';
type Tab = 'SETTINGS' | 'VERSIONS';

// Extracted component for better performance and focus handling
const VariableRow = ({
    v,
    onUpdateKey,
    onUpdateValue,
    onRemove,
    onSave,
    savedVarId
}: {
    v: Variable;
    onUpdateKey: (id: string, key: string) => void;
    onUpdateValue: (id: string, val: string) => void;
    onRemove: (id: string) => void;
    onSave: (v: Variable) => void;
    savedVarId: string | null;
}) => {
    return (
        <div className="bg-figma-bg rounded border border-figma-border p-2 space-y-2 group relative">
            <div className="flex items-center">
                <span className="text-figma-accent text-xs font-mono select-none">{'{{'}</span>

                {/* Auto-resizing textarea using inline-grid stack */}
                <div className="inline-grid grid-cols-[min-content] items-center">
                    {/* Invisible span triggers width expansion based on content */}
                    <span className="col-start-1 row-start-1 font-mono text-xs invisible whitespace-pre px-0.5 pointer-events-none border-none outline-none h-0 opacity-0 overflow-hidden">
                        {v.key || 'name'}
                    </span>
                    <textarea
                        value={v.key}
                        onChange={(e) => onUpdateKey(v.id, e.target.value)}
                        className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-xs text-figma-accent font-mono border-none focus:ring-0 p-0 px-0.5 focus:outline-none placeholder-figma-muted/40 resize-none"
                        placeholder="name"
                        spellCheck={false}
                        rows={1}
                    />
                </div>

                <span className="text-figma-accent text-xs font-mono select-none">{'}}'}</span>

                {/* Tools pushed to right */}
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <button
                        onClick={() => onSave(v)}
                        className={`text-figma-muted hover:text-white p-1 rounded ${savedVarId === v.id ? 'text-figma-success' : ''}`}
                        title="Save to Library"
                    >
                        <BookmarkIcon className="w-3 h-3" />
                    </button>
                    <button onClick={() => onRemove(v.id)} className="text-figma-muted hover:text-figma-danger p-1 rounded">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <textarea
                className="w-full bg-[#111] border border-[#333] rounded p-1.5 text-xs text-gray-300 focus:outline-none focus:border-figma-border"
                rows={1}
                placeholder="Test value"
                value={v.value}
                onChange={(e) => onUpdateValue(v.id, e.target.value)}
            />
        </div>
    );
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    prompt,
    activeVariant,
    onUpdateVariant,
    onUpdateProject,
    onAddVariant,
    onDeleteVariant,
    onSaveAsTemplate,
    onSaveVersion,
    onRestoreVersion,
    onOpenVariableLibrary,
    onSaveVariableToLibrary
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('SETTINGS');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('JSON');
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [saveTemplateFeedback, setSaveTemplateFeedback] = useState(false);
    const [versionName, setVersionName] = useState('');
    const [savedVarId, setSavedVarId] = useState<string | null>(null);

    const handleConfigChange = (key: string, value: any) => {
        onUpdateVariant({
            config: {
                ...activeVariant.config,
                [key]: value
            }
        });
    };

    const addVariable = () => {
        const newVar: Variable = {
            id: crypto.randomUUID(),
            key: `var${activeVariant.variables.length + 1}`,
            value: ''
        };
        onUpdateVariant({ variables: [...activeVariant.variables, newVar] });
    };

    const updateVariableKey = (id: string, newKey: string) => {
        const newVars = activeVariant.variables.map(v => v.id === id ? { ...v, key: newKey } : v);
        onUpdateVariant({ variables: newVars });
    };

    const updateVariableValue = (id: string, newVal: string) => {
        const newVars = activeVariant.variables.map(v => v.id === id ? { ...v, value: newVal } : v);
        onUpdateVariant({ variables: newVars });
    };

    const removeVariable = (id: string) => {
        onUpdateVariant({ variables: activeVariant.variables.filter(v => v.id !== id) });
    };

    const handleSaveVariable = (v: Variable) => {
        onSaveVariableToLibrary(v);
        setSavedVarId(v.id);
        setTimeout(() => setSavedVarId(null), 1500);
    };

    const handleSaveTemplateClick = () => {
        onSaveAsTemplate();
        setSaveTemplateFeedback(true);
        setTimeout(() => setSaveTemplateFeedback(false), 2000);
    };

    const handleSaveVersionClick = () => {
        onSaveVersion(versionName);
        setVersionName('');
    };

    const generateExport = () => {
        const variablesMap = activeVariant.variables.reduce((acc, v) => ({ ...acc, [v.key]: v.value }), {} as Record<string, string>);

        // Replace variables in content for export
        let processedContent = activeVariant.content;

        // First replace @{{}} (project variables)
        prompt.projectVariables?.forEach(v => {
            processedContent = processedContent.replace(new RegExp(`@\\{\\{${v.key}\\}\\}`, 'g'), v.value);
        });

        // Then replace {{}} (variant variables)
        activeVariant.variables.forEach(v => {
            processedContent = processedContent.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value);
        });

        const exportData: any = {
            name: activeVariant.name,
            prompt: processedContent,
        };

        if (activeVariant.config.systemInstruction) {
            exportData.systemInstruction = activeVariant.config.systemInstruction;
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
            let text = activeVariant.content;

            // First replace @{{}} (project variables)
            prompt.projectVariables?.forEach(v => {
                text = text.replace(new RegExp(`@\\{\\{${v.key}\\}\\}`, 'g'), v.value);
            });

            // Then replace {{}} (variant variables)
            activeVariant.variables.forEach(v => {
                text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value);
            });

            let result = "";
            if (activeVariant.config.systemInstruction) {
                result += `[System Instruction]\n${activeVariant.config.systemInstruction}\n\n`;
            }
            result += `[Prompt]\n${text}`;
            return result;
        }

        return '';
    };

    const copyToClipboard = () => {
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

    return (
        <div className="w-80 flex-shrink-0 bg-figma-panel border-l border-figma-border flex flex-col h-full">

            {/* Variants Header */}
            <div className="h-14 border-b border-figma-border flex items-center justify-between px-3 shrink-0 gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UniversalDropdown
                        value={prompt.activeVariantId}
                        onChange={(value) => onUpdateProject({ activeVariantId: value })}
                        options={prompt.variants.map(v => ({ label: v.name, value: v.id }))}
                        className="flex-1 bg-figma-bg border border-figma-border rounded px-2 py-1.5 text-xs text-white focus:border-figma-accent focus:outline-none hover:text-white"
                    />
                </div>
                <div className="flex gap-0.5 shrink-0">
                    <button
                        onClick={handleSaveTemplateClick}
                        className={`text-figma-muted hover:text-white transition-colors p-1.5 hover:bg-figma-hover rounded ${saveTemplateFeedback ? 'text-figma-success' : ''}`}
                        title={saveTemplateFeedback ? "Saved!" : "Save Project as Template"}
                    >
                        <BookmarkIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onAddVariant}
                        className="text-figma-muted hover:text-white transition-colors p-1.5 hover:bg-figma-hover rounded"
                        title="Clone current as new variant"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDeleteVariant(activeVariant.id)}
                        className="text-figma-muted hover:text-figma-danger disabled:opacity-30 transition-colors p-1.5 hover:bg-figma-hover rounded"
                        disabled={prompt.variants.length <= 1}
                        title="Delete Variant"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Header Tabs */}
            <div className="h-8 shrink-0 border-b border-figma-border flex bg-figma-panel z-10 sticky top-0">
                <button
                    onClick={() => setActiveTab('SETTINGS')}
                    className={`flex-1 text-[10px] font-medium tracking-wide border-b-2 transition-all focus:outline-none ${activeTab === 'SETTINGS'
                        ? 'border-[#1DB954] text-[#1DB954]'
                        : 'border-transparent text-figma-muted hover:text-white'
                        }`}
                >
                    SETTINGS
                </button>
                <button
                    onClick={() => setActiveTab('VERSIONS')}
                    className={`flex-1 text-[10px] font-medium tracking-wide border-b-2 transition-all focus:outline-none ${activeTab === 'VERSIONS'
                        ? 'border-[#1DB954] text-[#1DB954]'
                        : 'border-transparent text-figma-muted hover:text-white'
                        }`}
                >
                    HISTORY
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'SETTINGS' && (
                    <>
                        {/* Description */}
                        <div className="p-4 border-b border-figma-border">
                            <label className="block text-[11px] text-figma-muted mb-1.5 font-medium">Description</label>
                            <textarea
                                className="w-full bg-figma-bg border border-figma-border rounded p-2 text-xs text-white placeholder-figma-muted/30 focus:border-figma-accent focus:outline-none transition-colors"
                                rows={2}
                                placeholder="Describe this project..."
                                value={prompt.description}
                                onChange={(e) => onUpdateProject({ description: e.target.value })}
                            />
                        </div>

                        {/* General Settings */}
                        <div className="p-4 border-b border-figma-border space-y-4">
                            <div>
                                <label className="block text-[11px] text-figma-muted mb-1.5 font-medium">Model</label>
                                <select
                                    value={activeVariant.config.model}
                                    onChange={(e) => handleConfigChange('model', e.target.value)}
                                    className="w-full bg-figma-bg border border-figma-border rounded px-2 py-1.5 text-xs text-white focus:border-figma-accent focus:outline-none"
                                >
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                                    <option value="gemini-2.5-flash-thinking">Gemini 2.5 Thinking</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[11px] text-figma-muted font-medium">Temperature</label>
                                    <span className="text-[10px] text-figma-muted bg-figma-bg px-1 rounded">{activeVariant.config.temperature}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={activeVariant.config.temperature}
                                    onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-figma-border rounded-lg appearance-none cursor-pointer accent-figma-accent"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[11px] text-figma-muted font-medium">Top K</label>
                                    <span className="text-[10px] text-figma-muted bg-figma-bg px-1 rounded">{activeVariant.config.topK}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={activeVariant.config.topK}
                                    onChange={(e) => handleConfigChange('topK', parseInt(e.target.value))}
                                    className="w-full h-1 bg-figma-border rounded-lg appearance-none cursor-pointer accent-figma-accent"
                                />
                            </div>
                        </div>

                        {/* System Instruction */}
                        <div className="p-4 border-b border-figma-border">
                            <label className="block text-[11px] text-figma-muted mb-1.5 font-medium">System Instruction</label>
                            <textarea
                                className="w-full bg-figma-bg border border-figma-border rounded p-2 text-xs text-white placeholder-figma-muted/30 focus:border-figma-accent focus:outline-none"
                                rows={3}
                                placeholder="You are a helpful assistant..."
                                value={activeVariant.config.systemInstruction || ''}
                                onChange={(e) => handleConfigChange('systemInstruction', e.target.value)}
                            />
                        </div>

                        {/* Variables Section */}
                        <div className="p-4 space-y-3 border-b border-figma-border">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-figma-muted uppercase">Variables</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={onOpenVariableLibrary}
                                        className="text-figma-muted hover:text-white transition-colors p-1 hover:bg-figma-hover rounded"
                                        title="Open Variable Library"
                                    >
                                        <BookIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={addVariable}
                                        className="text-figma-muted hover:text-white transition-colors p-1 hover:bg-figma-hover rounded"
                                        title="Add New Variable"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {activeVariant.variables.length === 0 && (
                                <div className="text-[11px] text-figma-muted italic px-1">
                                    Add variables like {'{{name}}'} to your prompt.
                                </div>
                            )}

                            {activeVariant.variables.map((v) => (
                                <VariableRow
                                    key={v.id}
                                    v={v}
                                    onUpdateKey={updateVariableKey}
                                    onUpdateValue={updateVariableValue}
                                    onRemove={removeVariable}
                                    onSave={handleSaveVariable}
                                    savedVarId={savedVarId}
                                />
                            ))}
                        </div>

                        {/* Export Section */}
                        <div className="p-4 bg-[#252525]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold text-figma-muted uppercase">Export (Variant)</span>
                                <div className="flex gap-1">
                                    {(['JSON', 'XML', 'YAML', 'PROMPT'] as ExportFormat[]).map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setExportFormat(fmt)}
                                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${exportFormat === fmt ? 'bg-[#1DB954] text-black' : 'text-figma-muted hover:bg-figma-hover hover:text-white'}`}
                                        >
                                            {fmt === 'PROMPT' ? 'TEXT' : fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative group">
                                <div className="w-full min-h-32 max-h-96 bg-[#1a1a1a] border border-figma-border rounded overflow-auto resize-y">
                                    <SyntaxHighlighter
                                        language={getSyntaxLanguage()}
                                        style={oneDark}
                                        customStyle={{
                                            margin: 0,
                                            padding: '8px',
                                            background: 'transparent',
                                            fontSize: '10px',
                                            lineHeight: '1.4'
                                        }}
                                        codeTagProps={{ style: { fontSize: '10px' } }}
                                        showLineNumbers={false}
                                        wrapLines={true}
                                        wrapLongLines={true}
                                    >
                                        {generateExport()}
                                    </SyntaxHighlighter>
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className="absolute top-2 right-2 p-1.5 bg-figma-panel border border-figma-border rounded text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-figma-hover shadow-lg z-10"
                                    title="Copy"
                                >
                                    {copyFeedback ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    ) : (
                                        <CopyIcon className="w-3 h-3" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'VERSIONS' && (
                    <div className="flex flex-col h-full">
                        {/* Save New Version */}
                        <div className="p-4 border-b border-figma-border bg-figma-bg">
                            <label className="block text-[11px] text-figma-muted mb-2 font-medium">Create Snapshot (Current Variant)</label>
                            <div className="flex gap-2">
                                <textarea
                                    placeholder="Version Name (e.g. 'Creative Draft')"
                                    value={versionName}
                                    onChange={(e) => setVersionName(e.target.value)}
                                    className="flex-1 bg-figma-panel border border-figma-border rounded px-2 py-1.5 text-xs text-white focus:border-figma-accent focus:outline-none"
                                    rows={1}
                                />
                                <button
                                    onClick={handleSaveVersionClick}
                                    className="bg-figma-accent hover:bg-[#1ed760] text-black px-2 rounded flex items-center justify-center transition-colors"
                                    title="Save Snapshot"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="mt-2 text-[10px] text-figma-muted">
                                Saves a snapshot of "<strong>{activeVariant.name}</strong>". Each variant has its own history.
                            </p>
                        </div>

                        {/* Versions List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {(!activeVariant.versions || activeVariant.versions.length === 0) && (
                                <div className="text-center text-figma-muted text-xs italic py-8 opacity-50">
                                    No versions saved for this variant yet.
                                </div>
                            )}

                            {activeVariant.versions && activeVariant.versions.map((version) => (
                                <div key={version.id} className="border border-figma-border rounded bg-figma-bg p-3 group hover:border-figma-muted transition-colors relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-semibold text-white">{version.name}</span>
                                        <span className="text-[10px] text-figma-muted">{new Date(version.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-[10px] text-figma-muted mb-2 truncate">
                                        {version.config.model} • {version.content.substring(0, 30)}...
                                    </div>
                                    <button
                                        onClick={() => onRestoreVersion(version)}
                                        className="w-full flex items-center justify-center gap-1.5 bg-figma-panel border border-figma-border hover:bg-figma-hover text-[10px] text-white py-1.5 rounded transition-colors"
                                    >
                                        <RotateCcwIcon className="w-3 h-3" />
                                        Restore to "{activeVariant.name}"
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertiesPanel;
