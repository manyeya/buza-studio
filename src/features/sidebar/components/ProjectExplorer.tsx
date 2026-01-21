import React, { useState, useCallback, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { FileTextIcon, PlusIcon, SearchIcon } from '@/components/Icons';
import { FolderPlusIcon, FolderIcon } from 'lucide-react';
import { FolderTree } from './FolderTree';
import { ConnectedBreadcrumb } from './Breadcrumb';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    folderTreeAtom,
    expandedFoldersAtom,
    updateFolderTreeAtom,
    expandToItemAtom,
    navigateToFolderAtom,
} from '@/atoms/folder-atoms';
import {
    getFolderTree,
    createFolder,
    renameFolder,
    deleteFolder,
    moveProject,
    moveFolder,
    searchProjects,
    type SearchResult,
} from '@/lib/folder-system';
import { PROJECTS_QUERY_KEY } from '@/hooks/useProjects';
import { toast } from 'sonner';
import { PromptData } from '../../../../types';

interface ProjectExplorerProps {
    prompts: PromptData[];
    activePromptId: string | null;
    onSelectPrompt: (id: string) => void;
    onNewPrompt: () => void;
    onDeleteProject: (projectName: string) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
    prompts,
    activePromptId,
    onSelectPrompt,
    onNewPrompt,
    onDeleteProject
}) => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Folder state atoms
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
    const updateFolderTree = useSetAtom(updateFolderTreeAtom);
    const expandToItem = useSetAtom(expandToItemAtom);
    const navigateToFolder = useSetAtom(navigateToFolderAtom);

    // Initial data load
    useEffect(() => {
        loadFolderTreeData();
    }, []);

    // Sync with prompts changes
    useEffect(() => {
        loadFolderTreeData();
    }, [prompts.length]);

    const loadFolderTreeData = async () => {
        try {
            const tree = await getFolderTree();
            updateFolderTree(tree);
        } catch (error) {
            console.error('Failed to load folder tree:', error);
        }
    };

    // Search debounce effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timeoutId = setTimeout(async () => {
            try {
                const results = await searchProjects(searchQuery);
                setSearchResults(results);
            } catch (error) {
                console.error('Search failed:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleCreateFolder = useCallback(async (parentPath: string | null) => {
        try {
            const folder = await createFolder(parentPath, 'New Folder');
            await loadFolderTreeData();
            toast.success(`Created folder "${folder.name}"`);
        } catch (error) {
            console.error('Failed to create folder:', error);
            toast.error('Failed to create folder');
        }
    }, []);

    const handleRenameFolder = useCallback(async (folderPath: string, newName: string) => {
        try {
            await renameFolder(folderPath, newName);
            await loadFolderTreeData();
            toast.success(`Renamed folder to "${newName}"`);
        } catch (error) {
            console.error('Failed to rename folder:', error);
            toast.error('Failed to rename folder');
        }
    }, []);

    const handleDeleteFolder = useCallback(async (folderPath: string) => {
        try {
            const movedItems = await deleteFolder(folderPath);
            await loadFolderTreeData();
            if (movedItems.length > 0) {
                toast.success(`Deleted folder and moved ${movedItems.length} item(s) to parent`);
            } else {
                toast.success('Deleted folder');
            }
        } catch (error) {
            console.error('Failed to delete folder:', error);
            toast.error('Failed to delete folder');
        }
    }, []);

    const handleItemMove = useCallback(async (
        sourcePath: string,
        sourceType: 'folder' | 'project',
        targetFolderPath: string | null
    ) => {
        try {
            if (sourceType === 'project') {
                await moveProject(sourcePath, targetFolderPath);
            } else {
                await moveFolder(sourcePath, targetFolderPath);
            }
            await loadFolderTreeData();
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
            toast.success(`Moved ${sourceType} successfully`);
        } catch (error) {
            console.error('Failed to move item:', error);
            toast.error(`Failed to move ${sourceType}`);
        }
    }, [queryClient]);

    const handleProjectSelect = useCallback((projectPath: string) => {
        const prompt = prompts.find(p => p.id === projectPath);
        if (prompt) {
            onSelectPrompt(prompt.id);
            navigateToFolder(prompt.folderPath);
        }
    }, [prompts, onSelectPrompt, navigateToFolder]);

    const handleProjectDelete = useCallback((projectPath: string) => {
        onDeleteProject(projectPath);
        // Refresh tree after a short delay to ensure backend has processed deletion
        setTimeout(loadFolderTreeData, 100);
    }, [onDeleteProject]);

    const handleSearchResultSelect = useCallback((result: SearchResult) => {
        const prompt = prompts.find(p => p.name === result.project.name);
        if (prompt) {
            onSelectPrompt(prompt.id);
            if (result.folderPath) {
                expandToItem(result.folderPath + '/' + result.project.name);
            }
            setSearchQuery('');
        }
    }, [prompts, onSelectPrompt, expandToItem]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 border-b border-border">
                <div className="h-10 flex items-center justify-between">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Projects
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCreateFolder(null)}
                            title="New Folder"
                        >
                            <FolderPlusIcon className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={onNewPrompt}
                            title="New Project"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="pb-2">
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary"
                        />
                    </div>
                </div>

                <ConnectedBreadcrumb className="pb-2" />
            </div>

            <div className="flex-1 overflow-y-auto">
                {searchQuery.trim() ? (
                    <div>
                        {isSearching ? (
                            <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                                Searching...
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="px-4 py-6 text-xs text-muted-foreground text-center italic">
                                No projects found matching "{searchQuery}"
                            </div>
                        ) : (
                            <div>
                                <div className="px-4 py-2 text-[10px] text-muted-foreground">
                                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                                </div>
                                {searchResults.map((result, index) => (
                                    <div
                                        key={`${result.project.name}-${index}`}
                                        onClick={() => handleSearchResultSelect(result)}
                                        className="flex items-center px-4 py-2 cursor-pointer hover:bg-accent transition-colors"
                                    >
                                        <FileTextIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-foreground truncate">
                                                {highlightMatch(result.project.name, result.matchedText)}
                                            </div>
                                            {result.folderPath && (
                                                <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                                    <FolderIcon className="w-2.5 h-2.5" />
                                                    {result.folderPath}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <FolderTree
                        items={folderTree.rootItems}
                        onProjectSelect={handleProjectSelect}
                        onFolderRename={handleRenameFolder}
                        onFolderDelete={handleDeleteFolder}
                        onItemMove={handleItemMove}
                        onProjectDelete={handleProjectDelete}
                        activeProjectId={activePromptId}
                    />
                )}
            </div>
        </div>
    );
};

function highlightMatch(text: string, matchedText: string): React.ReactNode {
    if (!matchedText) return text;
    
    const lowerText = text.toLowerCase();
    const lowerMatch = matchedText.toLowerCase();
    const index = lowerText.indexOf(lowerMatch);
    
    if (index === -1) return text;
    
    return (
        <>
            {text.substring(0, index)}
            <span className="bg-primary/30 text-primary font-medium">
                {text.substring(index, index + matchedText.length)}
            </span>
            {text.substring(index + matchedText.length)}
        </>
    );
}
