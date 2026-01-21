import React, { useState } from 'react';
import { PromptData, Variable, PromptVersion, PromptVariant } from '../../../../types';
import { CopyIcon, BookmarkIcon, RotateCcwIcon, PlusIcon, LayersIcon, TrashIcon, BookIcon } from '@/components/Icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UniversalDropdown } from '@/components/ui/universal-dropdown';
import { VariableRow } from './components/VariableRow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

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

type Tab = 'SETTINGS' | 'VERSIONS';

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

    return (
        <div className="w-80 flex-shrink-0 bg-card border-l border-border flex flex-col h-full">

            {/* Variants Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0 gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UniversalDropdown
                        value={prompt.activeVariantId}
                        onChange={(value) => onUpdateProject({ activeVariantId: value })}
                        options={prompt.variants.map(v => ({ label: v.name, value: v.id }))}
                        className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none hover:text-foreground"
                    />
                </div>
                <div className="flex gap-0.5 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSaveTemplateClick}
                        className={`h-7 w-7 ${saveTemplateFeedback ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}`}
                        title={saveTemplateFeedback ? "Saved!" : "Save Project as Template"}
                    >
                        <BookmarkIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onAddVariant}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Clone current as new variant"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteVariant(activeVariant.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={prompt.variants.length <= 1}
                        title="Delete Variant"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Header Tabs */}
            <div className="h-8 shrink-0 border-b border-border flex bg-card z-10 sticky top-0">
                <button
                    onClick={() => setActiveTab('SETTINGS')}
                    className={`flex-1 text-[10px] font-medium tracking-wide border-b-2 transition-all focus:outline-none ${activeTab === 'SETTINGS'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    SETTINGS
                </button>
                <button
                    onClick={() => setActiveTab('VERSIONS')}
                    className={`flex-1 text-[10px] font-medium tracking-wide border-b-2 transition-all focus:outline-none ${activeTab === 'VERSIONS'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    HISTORY
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'SETTINGS' && (
                    <>
                        {/* Description */}
                        <div className="p-4 border-b border-border">
                            <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Description</label>
                            <Textarea
                                className="min-h-[50px] text-xs resize-none"
                                rows={2}
                                placeholder="Describe this project..."
                                value={prompt.description}
                                onChange={(e) => onUpdateProject({ description: e.target.value })}
                            />
                        </div>

                        {/* General Settings */}
                        <div className="p-4 border-b border-border space-y-4">
                            <div>
                                <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">Model</label>
                                <select
                                    value={activeVariant.config.model}
                                    onChange={(e) => handleConfigChange('model', e.target.value)}
                                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none cursor-pointer"
                                >
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                                    <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[11px] text-muted-foreground font-medium">Temperature</label>
                                    <span className="text-[10px] text-muted-foreground bg-background px-1 rounded">{activeVariant.config.temperature}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={activeVariant.config.temperature}
                                    onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[11px] text-muted-foreground font-medium">Top K</label>
                                    <span className="text-[10px] text-muted-foreground bg-background px-1 rounded">{activeVariant.config.topK}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={activeVariant.config.topK}
                                    onChange={(e) => handleConfigChange('topK', parseInt(e.target.value))}
                                    className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>

                        {/* System Instruction */}
                        <div className="p-4 border-b border-border">
                            <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium">System Instruction</label>
                            <Textarea
                                className="min-h-[80px] text-xs resize-y"
                                rows={3}
                                placeholder="You are a helpful assistant..."
                                value={activeVariant.config.systemInstruction || ''}
                                onChange={(e) => handleConfigChange('systemInstruction', e.target.value)}
                            />
                        </div>

                        {/* Variables Section */}
                        <div className="p-4 space-y-3 border-b border-border">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase">Variables</span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onOpenVariableLibrary}
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        title="Open Variable Library"
                                    >
                                        <BookIcon className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={addVariable}
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        title="Add New Variable"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {activeVariant.variables.length === 0 && (
                                <div className="text-[11px] text-muted-foreground italic px-1">
                                    Type {'{{name}}'} in your prompt to auto-detect variables.
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
                    </>
                )}

                {activeTab === 'VERSIONS' && (
                    <div className="flex flex-col h-full">
                        {/* Save New Version */}
                        <div className="p-4 border-b border-border bg-background">
                            <label className="block text-[11px] text-muted-foreground mb-2 font-medium">Create Snapshot (Current Variant)</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Version Name (e.g. 'Creative Draft')"
                                    value={versionName}
                                    onChange={(e) => setVersionName(e.target.value)}
                                    className="h-7 text-xs"
                                />
                                <Button
                                    variant="default"
                                    size="icon"
                                    onClick={handleSaveVersionClick}
                                    className="h-7 w-7 shrink-0"
                                    title="Save Snapshot"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="mt-2 text-[10px] text-muted-foreground">
                                Saves a snapshot of "<strong>{activeVariant.name}</strong>". Each variant has its own history.
                            </p>
                        </div>

                        {/* Versions List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {(!activeVariant.versions || activeVariant.versions.length === 0) && (
                                <div className="text-center text-muted-foreground text-xs italic py-8 opacity-50">
                                    No versions saved for this variant yet.
                                </div>
                            )}

                            {activeVariant.versions && activeVariant.versions.map((version) => (
                                <div key={version.id} className="border border-border rounded bg-card p-3 group hover:border-muted-foreground transition-colors relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-semibold text-foreground">{version.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{new Date(version.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mb-2 truncate">
                                        {version.config.model} • {version.content.substring(0, 30)}...
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onRestoreVersion(version)}
                                        className="w-full h-7 text-[10px] gap-1.5"
                                    >
                                        <RotateCcwIcon className="w-3 h-3" />
                                        Restore to "{activeVariant.name}"
                                    </Button>
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
