import React, { useState } from 'react';
import { PlusIcon } from '@/components/Icons';
import { Item, ItemContent, ItemFooter } from '@/components/ui/item';
import { PromptData } from '../../../../types';

interface VariablePanelProps {
    variables: PromptData['projectVariables'];
    onUpdate: (variables: NonNullable<PromptData['projectVariables']>) => void;
    onInsert?: (variableKey: string) => void;
}

export const VariablePanel: React.FC<VariablePanelProps> = ({
    variables = [],
    onUpdate,
    onInsert
}) => {
    const [copiedVarId, setCopiedVarId] = useState<string | null>(null);
    const [editingVarId, setEditingVarId] = useState<string | null>(null);
    const [tempVarKey, setTempVarKey] = useState('');
    const [tempVarValue, setTempVarValue] = useState('');

    const handleAddVariable = () => {
        const newVar = { id: crypto.randomUUID(), key: 'new_var', value: 'value' };
        onUpdate([...variables, newVar]);
        setEditingVarId(newVar.id);
        setTempVarKey(newVar.key);
        setTempVarValue(newVar.value);
    };

    const handleSaveVariable = () => {
        if (!editingVarId) return;
        const updatedVars = variables.map(v =>
            v.id === editingVarId ? { ...v, key: tempVarKey, value: tempVarValue } : v
        );
        onUpdate(updatedVars);
        setEditingVarId(null);
    };

    const handleDeleteVariable = (id: string) => {
        const updatedVars = variables.filter(v => v.id !== id);
        onUpdate(updatedVars);
    };

    return (
        <div className="border-t border-border">
            <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Project Variables
                    </div>
                    <button
                        onClick={handleAddVariable}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Add Variable"
                    >
                        <PlusIcon className="w-3 h-3" />
                    </button>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {variables.map((variable) => (
                        <div key={variable.id} className="group transition-colors hover:bg-background/50">
                            {editingVarId === variable.id ? (
                                <Item className='hover:bg-background/50'>
                                    <ItemContent>
                                        <input
                                            type="text"
                                            value={tempVarKey}
                                            onChange={(e) => setTempVarKey(e.target.value)}
                                            className="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:border-primary outline-none"
                                            placeholder="Key"
                                            autoFocus
                                        />
                                        <textarea
                                            value={tempVarValue}
                                            onChange={(e) => setTempVarValue(e.target.value)}
                                            className="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-muted-foreground focus:text-foreground focus:border-primary outline-none min-h-[60px] resize-y"
                                            placeholder="Value"
                                            rows={3}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.metaKey) handleSaveVariable();
                                            }}
                                        />
                                    </ItemContent>
                                    <ItemFooter className="flex justify-end gap-1">
                                        <button onClick={() => setEditingVarId(null)} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5">Cancel</button>
                                        <button onClick={handleSaveVariable} className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Save</button>
                                    </ItemFooter>
                                </Item>
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
                                        className="flex-1 cursor-pointer hover:bg-background/70 rounded px-1 -mx-1 transition-colors"
                                        title={copiedVarId === variable.id ? "Copied!" : "Click to copy, double-click to edit"}
                                    >
                                        <div className="text-xs font-medium text-primary truncate flex items-center gap-1">
                                            {variable.key}
                                            {copiedVarId === variable.id && (
                                                <span className="text-[10px] text-green-400">✓</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate">{variable.value}</div>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onInsert && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onInsert(variable.key);
                                                }}
                                                className="p-1 hover:bg-accent rounded transition-opacity"
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
                                            className="p-1 hover:bg-accent text-muted-foreground hover:text-destructive transition-opacity rounded"
                                            title="Delete variable"
                                        >
                                            <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.22386 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11.296L10.868 12.132C10.7917 13.582 9.59228 14.75 8.14007 14.75H6.85993C5.40772 14.75 4.20827 13.582 4.13199 12.132L3.70402 4H3.5C3.22386 4 3 3.77614 3 3.5ZM4.71201 4L5.13201 12.079C5.17014 12.804 5.76987 13.3885 6.49587 13.3885H8.50413C9.23013 13.3885 9.82986 12.804 9.86799 12.079L10.288 4H4.71201Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {variables.length === 0 && (
                        <div className="text-xs text-muted-foreground italic px-3 py-2">No variables</div>
                    )}
                </div>
            </div>
        </div>
    );
};
