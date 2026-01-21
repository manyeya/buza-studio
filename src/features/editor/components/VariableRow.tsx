import React from 'react';
import { Variable } from '../../../../types';
import { BookmarkIcon, TrashIcon } from '@/components/Icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VariableRowProps {
    v: Variable;
    onUpdateKey: (id: string, key: string) => void;
    onUpdateValue: (id: string, val: string) => void;
    onRemove: (id: string) => void;
    onSave: (v: Variable) => void;
    savedVarId: string | null;
}

export const VariableRow: React.FC<VariableRowProps> = ({
    v,
    onUpdateKey,
    onUpdateValue,
    onRemove,
    onSave,
    savedVarId
}) => {
    return (
        <div className="bg-card rounded border border-border p-2 space-y-2 group relative">
            <div className="flex items-center">
                <span className="text-primary text-xs font-mono select-none">{'{{'}</span>

                {/* Auto-resizing textarea using inline-grid stack */}
                <div className="inline-grid grid-cols-[min-content] items-center">
                    {/* Invisible span triggers width expansion based on content */}
                    <span className="col-start-1 row-start-1 font-mono text-xs invisible whitespace-pre px-0.5 pointer-events-none border-none outline-none h-0 opacity-0 overflow-hidden">
                        {v.key || 'name'}
                    </span>
                    <textarea
                        value={v.key}
                        onChange={(e) => onUpdateKey(v.id, e.target.value)}
                        className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-xs text-primary font-mono border-none focus:ring-0 p-0 px-0.5 focus:outline-none placeholder-muted-foreground/40 resize-none"
                        placeholder="name"
                        spellCheck={false}
                        rows={1}
                    />
                </div>

                <span className="text-primary text-xs font-mono select-none">{'}}'}</span>

                {/* Tools pushed to right */}
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSave(v)}
                        className={`h-5 w-5 ${savedVarId === v.id ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}`}
                        title="Save to Library"
                    >
                        <BookmarkIcon className="w-3 h-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(v.id)}
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
            <Input
                className="w-full bg-[#111] border-[#333] h-7 text-xs text-gray-300 font-mono"
                placeholder="Test value"
                value={v.value}
                onChange={(e) => onUpdateValue(v.id, e.target.value)}
            />
        </div>
    );
};
