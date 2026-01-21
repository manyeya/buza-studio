import React from 'react';
import { PromptData } from '../../../../types';
import { Button } from '@/components/ui/button';
import { VariablePanel } from './components/VariablePanel';
import { ProjectExplorer } from './components/ProjectExplorer';
import { GridIcon } from '@/components/Icons';
import { Settings } from 'lucide-react';

interface SidebarProps {
    prompts: PromptData[];
    activePromptId: string | null;
    onSelectPrompt: (id: string) => void;
    onNewPrompt: () => void;
    onOpenTemplates: () => void;
    onUpdateProjectVariables: (variables: any[]) => void;
    onInsertVariable?: (variableKey: string) => void;
    onDeleteProject: (projectName: string) => void;
    onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    prompts,
    activePromptId,
    onSelectPrompt,
    onNewPrompt,
    onOpenTemplates,
    onUpdateProjectVariables,
    onInsertVariable,
    onDeleteProject,
    onOpenSettings
}) => {
    const activePrompt = prompts.find(p => p.id === activePromptId);

    return (
        <div className="w-64 h-full bg-card border-r border-border flex flex-col">
            <div className="h-14 border-b border-border flex items-center justify-between px-4">
                <div className="font-semibold text-sm flex items-center gap-2.5">
                    <div className="relative group">
                        <div className="w-6 h-6 bg-gradient-to-br from-[#1DB954] to-[#14803a] rounded-t-lg rounded-bl-lg rounded-br-none flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105">
                            <span className="text-[11px] font-black text-black leading-none mt-[1px] ml-[1px]">B</span>
                        </div>
                    </div>
                    <span className="tracking-tight text-foreground">Buza Studio</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Settings"
                    className="h-8 w-8"
                >
                    <Settings className="w-4 h-4" />
                </Button>
            </div>

            <ProjectExplorer
                prompts={prompts}
                activePromptId={activePromptId}
                onSelectPrompt={onSelectPrompt}
                onNewPrompt={onNewPrompt}
                onDeleteProject={onDeleteProject}
            />

            {activePrompt && (
                <VariablePanel
                    variables={activePrompt.projectVariables || []}
                    onUpdate={onUpdateProjectVariables}
                    onInsert={onInsertVariable}
                />
            )}

            <div className="p-3 border-t border-border space-y-2">
                <Button
                    variant="ghost"
                    className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground h-8 text-xs font-normal"
                    onClick={onOpenTemplates}
                >
                    <GridIcon className="w-3.5 h-3.5" />
                    Explore Templates
                </Button>
            </div>
        </div>
    );
};

export default Sidebar;
