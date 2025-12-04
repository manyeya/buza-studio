/**
 * FolderTree Component
 * 
 * Renders a hierarchical folder tree with folders and projects.
 * Supports expand/collapse, item selection, drag-and-drop, and context menus.
 * 
 * _Requirements: 3.1, 3.4, 5.3, 2.1, 5.1, 2.2, 4.1, 4.4_
 */

import React, { useState, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { cn } from '@/lib/utils';
import { FileTextIcon, ChevronDownIcon, TrashIcon } from './Icons';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { DotsVerticalIcon } from '@radix-ui/react-icons';
import { PencilIcon, FolderIcon, FolderOpenIcon, MoveIcon } from 'lucide-react';
import type { FolderItem, Folder, FolderTree as FolderTreeType } from '@/lib/folder-system';
import {
    expandedFoldersAtom,
    selectedItemIdAtom,
    toggleFolderExpansionAtom,
    folderTreeAtom,
} from '@/atoms/folder-atoms';

// ============================================================================
// Types
// ============================================================================

export interface FolderTreeProps {
    /** Items to render at this level */
    items: FolderItem[];
    /** Callback when a project is selected */
    onProjectSelect?: (projectPath: string) => void;
    /** Callback when a folder is created */
    onFolderCreate?: (parentPath: string | null) => void;
    /** Callback when a folder is renamed */
    onFolderRename?: (folderPath: string, newName: string) => void;
    /** Callback when a folder is deleted */
    onFolderDelete?: (folderPath: string) => void;
    /** Callback when an item is moved */
    onItemMove?: (sourcePath: string, sourceType: 'folder' | 'project', targetFolderPath: string | null) => void;
    /** Callback when a project is deleted */
    onProjectDelete?: (projectPath: string) => void;
    /** Currently active project ID for highlighting */
    activeProjectId?: string | null;
    /** Current indentation level */
    level?: number;
}

interface FolderTreeItemProps {
    item: FolderItem;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    activeProjectId?: string | null;
    onToggle: () => void;
    onSelect: () => void;
    onProjectSelect?: (projectPath: string) => void;
    onFolderCreate?: (parentPath: string | null) => void;
    onFolderRename?: (folderPath: string, newName: string) => void;
    onFolderDelete?: (folderPath: string) => void;
    onItemMove?: (sourcePath: string, sourceType: 'folder' | 'project', targetFolderPath: string | null) => void;
    onProjectDelete?: (projectPath: string) => void;
    children?: React.ReactNode;
}

interface FolderPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folderPath: string | null) => void;
    excludePath?: string;
    title?: string;
}

// ============================================================================
// Folder Picker Modal Component
// ============================================================================

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    excludePath,
    title = 'Move to Folder',
}) => {
    const [folderTree] = useAtom(folderTreeAtom);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    const toggleExpanded = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleSelect = () => {
        onSelect(selectedPath);
        onClose();
    };

    const renderFolderItem = (item: FolderItem, level: number = 0): React.ReactNode => {
        if (item.type !== 'folder') return null;
        
        // Exclude the item being moved and its descendants
        if (excludePath && (item.path === excludePath || item.path.startsWith(excludePath + '/'))) {
            return null;
        }

        const isExpanded = expandedPaths.has(item.path);
        const isSelected = selectedPath === item.path;
        const folder = folderTree.folders.get(item.path);
        const children = folder?.children.filter(c => c.type === 'folder') ?? [];

        return (
            <div key={item.id}>
                <div
                    className={cn(
                        'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors overflow-hidden',
                        isSelected ? 'bg-figma-accent/20 text-figma-accent' : 'hover:bg-figma-hover text-white'
                    )}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    onClick={() => setSelectedPath(item.path)}
                >
                    {children.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(item.path);
                            }}
                            className="p-0.5 hover:bg-figma-hover rounded flex-shrink-0"
                        >
                            <ChevronDownIcon
                                className={cn(
                                    'w-3 h-3 transition-transform',
                                    !isExpanded && '-rotate-90'
                                )}
                            />
                        </button>
                    )}
                    {children.length === 0 && <div className="w-4 flex-shrink-0" />}
                    <FolderIcon className="w-4 h-4 text-figma-muted flex-shrink-0" />
                    <span className="text-sm truncate min-w-0 flex-1" title={item.name}>{item.name}</span>
                </div>
                {isExpanded && children.map(child => renderFolderItem(child, level + 1))}
            </div>
        );
    };

    const folderItems = folderTree.rootItems.filter(item => item.type === 'folder');

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-figma-panel border-figma-border max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-white">{title}</DialogTitle>
                    <DialogDescription className="text-figma-muted">
                        Select a destination folder or move to root level.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="max-h-64 overflow-y-auto border border-figma-border rounded bg-figma-bg">
                    {/* Root level option */}
                    <div
                        className={cn(
                            'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors',
                            selectedPath === null ? 'bg-figma-accent/20 text-figma-accent' : 'hover:bg-figma-hover text-white'
                        )}
                        onClick={() => setSelectedPath(null)}
                    >
                        <div className="w-4" />
                        <FolderIcon className="w-4 h-4 text-figma-muted" />
                        <span className="text-sm">Root (No folder)</span>
                    </div>
                    
                    {folderItems.map(item => renderFolderItem(item))}
                    
                    {folderItems.length === 0 && (
                        <div className="px-4 py-3 text-sm text-figma-muted italic">
                            No folders available
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-figma-muted hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSelect}
                        className="bg-figma-accent text-white hover:bg-figma-accent/90"
                    >
                        Move Here
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ============================================================================
// FolderTreeItem Component
// ============================================================================

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
    item,
    level,
    isExpanded,
    isSelected,
    activeProjectId,
    onToggle,
    onSelect,
    onProjectSelect,
    onFolderCreate,
    onFolderRename,
    onFolderDelete,
    onItemMove,
    onProjectDelete,
    children,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [isDragOver, setIsDragOver] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isFolder = item.type === 'folder';
    // activeProjectId is the full path (e.g., "MyFolder/MyProject"), item.path is also the full path
    const isActiveProject = !isFolder && activeProjectId === item.path;
    const indentPx = level * 16;

    // Handle inline rename
    const handleStartRename = () => {
        setEditName(item.name);
        setIsEditing(true);
    };

    const handleSaveRename = () => {
        if (editName.trim() && editName !== item.name && onFolderRename) {
            onFolderRename(item.path, editName.trim());
        }
        setIsEditing(false);
    };

    const handleCancelRename = () => {
        setEditName(item.name);
        setIsEditing(false);
    };

    // Handle delete
    const handleDelete = () => {
        if (isFolder && onFolderDelete) {
            onFolderDelete(item.path);
        } else if (!isFolder && onProjectDelete) {
            onProjectDelete(item.path);
        }
        setShowDeleteConfirm(false);
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            path: item.path,
            type: item.type,
            name: item.name,
        }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isFolder) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        if (!isFolder || !onItemMove) return;

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            // Don't allow dropping on itself or its descendants
            if (data.path === item.path || item.path.startsWith(data.path + '/')) {
                return;
            }
            onItemMove(data.path, data.type, item.path);
        } catch {
            // Invalid drag data
        }
    };

    // Handle move to folder via modal
    const handleMoveToFolder = (targetPath: string | null) => {
        if (onItemMove) {
            onItemMove(item.path, item.type, targetPath);
        }
    };

    const handleClick = () => {
        if (isFolder) {
            onToggle();
        } else {
            onSelect();
            if (onProjectSelect) {
                onProjectSelect(item.path);
            }
        }
    };

    return (
        <>
            <div
                className={cn(
                    'group flex items-center transition-colors overflow-hidden',
                    isFolder && isDragOver && 'bg-figma-accent/20',
                    isActiveProject && 'bg-figma-hover',
                    !isActiveProject && 'hover:bg-figma-bg/50'
                )}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div
                    className="flex-1 flex items-center px-3 py-1 cursor-pointer min-w-0 overflow-hidden"
                    style={{ paddingLeft: `${indentPx + 12}px` }}
                    onClick={handleClick}
                    onDoubleClick={isFolder ? handleStartRename : undefined}
                >
                    {/* Expand/collapse chevron for folders */}
                    {isFolder && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                            className="p-0.5 mr-1 hover:bg-figma-hover rounded"
                        >
                            <ChevronDownIcon
                                className={cn(
                                    'w-3 h-3 text-figma-muted transition-transform',
                                    !isExpanded && '-rotate-90'
                                )}
                            />
                        </button>
                    )}
                    
                    {/* Spacer for projects to align with folders */}
                    {!isFolder && <div className="w-5" />}

                    {/* Icon */}
                    {isFolder ? (
                        isExpanded ? (
                            <FolderOpenIcon className="w-3.5 h-3.5 mr-2 text-figma-muted flex-shrink-0" />
                        ) : (
                            <FolderIcon className="w-3.5 h-3.5 mr-2 text-figma-muted flex-shrink-0" />
                        )
                    ) : (
                        <FileTextIcon
                            className={cn(
                                'w-3.5 h-3.5 mr-2 flex-shrink-0',
                                isActiveProject ? 'text-figma-accent' : 'text-figma-muted'
                            )}
                        />
                    )}

                    {/* Name (editable for folders) */}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') handleCancelRename();
                            }}
                            className="flex-1 min-w-0 bg-figma-bg border border-figma-border rounded px-1.5 py-0.5 text-xs text-white focus:border-figma-accent outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className={cn(
                                'text-xs truncate min-w-0 flex-1',
                                isActiveProject ? 'text-figma-accent font-medium' : 'text-white'
                            )}
                            title={item.name}
                        >
                            {item.name}
                        </span>
                    )}
                </div>

                {/* Context menu */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <DotsVerticalIcon className="w-3 h-3 text-figma-muted hover:text-white" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="min-w-[140px] bg-figma-panel border border-figma-border rounded shadow-lg"
                            align="end"
                        >
                            {isFolder && (
                                <>
                                    <DropdownMenuItem
                                        onClick={handleStartRename}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-white hover:bg-figma-hover focus:bg-figma-hover cursor-pointer"
                                    >
                                        <PencilIcon className="w-3 h-3" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setShowMoveModal(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-white hover:bg-figma-hover focus:bg-figma-hover cursor-pointer"
                                    >
                                        <MoveIcon className="w-3 h-3" />
                                        Move to Folder
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-figma-border" />
                                    <DropdownMenuItem
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-figma-hover focus:bg-figma-hover cursor-pointer"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                        Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!isFolder && (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => setShowMoveModal(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-white hover:bg-figma-hover focus:bg-figma-hover cursor-pointer"
                                    >
                                        <MoveIcon className="w-3 h-3" />
                                        Move to Folder
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-figma-border" />
                                    <DropdownMenuItem
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-figma-hover focus:bg-figma-hover cursor-pointer"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                        Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Render children (nested items) when expanded */}
            {isFolder && isExpanded && children}

            {/* Move to folder modal */}
            <FolderPickerModal
                isOpen={showMoveModal}
                onClose={() => setShowMoveModal(false)}
                onSelect={handleMoveToFolder}
                excludePath={isFolder ? item.path : undefined}
                title={`Move "${item.name}" to...`}
            />

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="bg-figma-panel border-figma-border max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            Delete {isFolder ? 'Folder' : 'Project'}
                        </DialogTitle>
                        <DialogDescription className="text-figma-muted">
                            {isFolder
                                ? `Are you sure you want to delete "${item.name}"? Any contents will be moved to the parent folder.`
                                : `Are you sure you want to delete "${item.name}"? This action cannot be undone.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="text-figma-muted hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// ============================================================================
// FolderTree Component (Main)
// ============================================================================

export const FolderTree: React.FC<FolderTreeProps> = ({
    items,
    onProjectSelect,
    onFolderCreate,
    onFolderRename,
    onFolderDelete,
    onItemMove,
    onProjectDelete,
    activeProjectId,
    level = 0,
}) => {
    const [expandedFolders] = useAtom(expandedFoldersAtom);
    const [selectedItemId, setSelectedItemId] = useAtom(selectedItemIdAtom);
    const toggleFolderExpansion = useSetAtom(toggleFolderExpansionAtom);
    const [folderTree] = useAtom(folderTreeAtom);

    const handleToggle = useCallback((folderPath: string) => {
        toggleFolderExpansion(folderPath);
    }, [toggleFolderExpansion]);

    const handleSelect = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
    }, [setSelectedItemId]);

    // Handle drop on root level (empty space)
    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!onItemMove) return;

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            // Move to root level
            onItemMove(data.path, data.type, null);
        } catch {
            // Invalid drag data
        }
    };

    const handleRootDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    if (items.length === 0 && level === 0) {
        return (
            <div
                className="px-4 py-6 text-xs text-figma-muted text-center italic"
                onDrop={handleRootDrop}
                onDragOver={handleRootDragOver}
            >
                No projects yet. Create your first project!
            </div>
        );
    }

    return (
        <div
            className={cn(level === 0 && 'min-h-[100px]')}
            onDrop={level === 0 ? handleRootDrop : undefined}
            onDragOver={level === 0 ? handleRootDragOver : undefined}
        >
            {items.map((item) => {
                const isExpanded = item.type === 'folder' && expandedFolders.has(item.path);
                const folder = item.type === 'folder' ? folderTree.folders.get(item.path) : null;
                const children = folder?.children ?? [];

                return (
                    <FolderTreeItem
                        key={item.id}
                        item={item}
                        level={level}
                        isExpanded={isExpanded}
                        isSelected={selectedItemId === item.id}
                        activeProjectId={activeProjectId}
                        onToggle={() => handleToggle(item.path)}
                        onSelect={() => handleSelect(item.id)}
                        onProjectSelect={onProjectSelect}
                        onFolderCreate={onFolderCreate}
                        onFolderRename={onFolderRename}
                        onFolderDelete={onFolderDelete}
                        onItemMove={onItemMove}
                        onProjectDelete={onProjectDelete}
                    >
                        {/* Recursively render children */}
                        {children.length > 0 && (
                            <FolderTree
                                items={children}
                                onProjectSelect={onProjectSelect}
                                onFolderCreate={onFolderCreate}
                                onFolderRename={onFolderRename}
                                onFolderDelete={onFolderDelete}
                                onItemMove={onItemMove}
                                onProjectDelete={onProjectDelete}
                                activeProjectId={activeProjectId}
                                level={level + 1}
                            />
                        )}
                    </FolderTreeItem>
                );
            })}
        </div>
    );
};

export default FolderTree;
