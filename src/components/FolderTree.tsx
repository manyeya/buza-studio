/**
 * FolderTree Component
 * 
 * Renders a hierarchical folder tree with folders and projects.
 * Supports expand/collapse, item selection, drag-and-drop (using dnd-kit), and context menus.
 * 
 * _Requirements: 3.1, 3.4, 5.3, 2.1, 5.1, 2.2, 4.1, 4.4_
 */

import React, { useState, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
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
import { PencilIcon, FolderIcon, FolderOpenIcon, MoveIcon, GripVerticalIcon } from 'lucide-react';
import type { FolderItem } from '@/lib/folder-system';
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
    items: FolderItem[];
    onProjectSelect?: (projectPath: string) => void;
    onFolderRename?: (folderPath: string, newName: string) => void;
    onFolderDelete?: (folderPath: string) => void;
    onItemMove?: (sourcePath: string, sourceType: 'folder' | 'project', targetFolderPath: string | null) => void;
    onProjectDelete?: (projectPath: string) => void;
    activeProjectId?: string | null;
}

interface DragData {
    path: string;
    type: 'folder' | 'project';
    name: string;
}

// ============================================================================
// Draggable Item Component
// ============================================================================

interface DraggableItemProps {
    item: FolderItem;
    level: number;
    isExpanded: boolean;
    activeProjectId?: string | null;
    onToggle: () => void;
    onProjectSelect?: (projectPath: string) => void;
    onFolderRename?: (folderPath: string, newName: string) => void;
    onFolderDelete?: (folderPath: string) => void;
    onItemMove?: (sourcePath: string, sourceType: 'folder' | 'project', targetFolderPath: string | null) => void;
    onProjectDelete?: (projectPath: string) => void;
    children?: React.ReactNode;
    isDragOverlay?: boolean;
}

const DraggableItem: React.FC<DraggableItemProps> = ({
    item,
    level,
    isExpanded,
    activeProjectId,
    onToggle,
    onProjectSelect,
    onFolderRename,
    onFolderDelete,
    onItemMove,
    onProjectDelete,
    children,
    isDragOverlay = false,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isFolder = item.type === 'folder';
    const isActiveProject = !isFolder && activeProjectId === item.path;
    const indentPx = level * 16;

    // Draggable hook
    const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
        id: item.path,
        data: { path: item.path, type: item.type, name: item.name } as DragData,
    });

    // Droppable hook (only folders can be drop targets)
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `drop-${item.path}`,
        data: { path: item.path, type: item.type },
        disabled: !isFolder,
    });

    // Combine refs
    const setNodeRef = (node: HTMLElement | null) => {
        setDragRef(node);
        if (isFolder) {
            setDropRef(node);
        }
    };

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

    const handleDelete = () => {
        if (isFolder && onFolderDelete) {
            onFolderDelete(item.path);
        } else if (!isFolder && onProjectDelete) {
            onProjectDelete(item.path);
        }
        setShowDeleteConfirm(false);
    };

    const handleMoveToFolder = (targetPath: string | null) => {
        if (onItemMove) {
            onItemMove(item.path, item.type, targetPath);
        }
    };

    const handleClick = () => {
        if (isFolder) {
            onToggle();
        } else if (onProjectSelect) {
            onProjectSelect(item.path);
        }
    };

    return (
        <>
            <div
                ref={!isDragOverlay ? setNodeRef : undefined}
                className={cn(
                    'group flex items-center transition-colors overflow-hidden',
                    isFolder && isOver && 'bg-figma-accent/20 ring-1 ring-figma-accent ring-inset',
                    isDragging && !isDragOverlay && 'opacity-30',
                    isDragOverlay && 'opacity-90 bg-figma-panel shadow-lg rounded',
                    isActiveProject && !isDragging && 'bg-figma-hover',
                    !isActiveProject && !isOver && !isDragging && 'hover:bg-figma-bg/50'
                )}
            >
                {/* Drag handle */}
                <div 
                    className={cn(
                        "cursor-grab active:cursor-grabbing pl-1 transition-opacity",
                        isDragOverlay ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    style={{ marginLeft: `${indentPx}px` }}
                    {...listeners}
                    {...attributes}
                >
                    <GripVerticalIcon className="w-3 h-3 text-figma-muted" />
                </div>
                <div
                    className="flex-1 flex items-center px-1 py-1 cursor-pointer min-w-0 overflow-hidden"
                    onClick={handleClick}
                    onDoubleClick={isFolder ? handleStartRename : undefined}
                >
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
                    
                    {!isFolder && <div className="w-5" />}

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

                {!isDragOverlay && (
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
                )}
            </div>

            {isFolder && isExpanded && children}

            <FolderPickerModal
                isOpen={showMoveModal}
                onClose={() => setShowMoveModal(false)}
                onSelect={handleMoveToFolder}
                excludePath={isFolder ? item.path : undefined}
                title={`Move "${item.name}" to...`}
            />

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
// Folder Picker Modal Component
// ============================================================================

interface FolderPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folderPath: string | null) => void;
    excludePath?: string;
    title?: string;
}

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
// Root Drop Zone Component
// ============================================================================

interface RootDropZoneProps {
    children: React.ReactNode;
    isDragging: boolean;
}

const RootDropZone: React.FC<RootDropZoneProps> = ({ children, isDragging }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'root-drop-zone',
        data: { path: null, type: 'root' },
    });

    return (
        <div className="flex flex-col">
            <div className="min-h-[50px]">
                {children}
            </div>
            {/* Visible root drop target at bottom - only shows when dragging */}
            {isDragging && (
                <div
                    ref={setNodeRef}
                    className={cn(
                        'mx-2 mt-1 px-3 py-2 rounded border-2 border-dashed transition-colors flex items-center gap-2',
                        isOver 
                            ? 'border-figma-accent bg-figma-accent/20 text-figma-accent' 
                            : 'border-figma-border text-figma-muted'
                    )}
                >
                    <FolderIcon className="w-3.5 h-3.5" />
                    <span className="text-xs">Drop here to move to root</span>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Recursive Tree Renderer
// ============================================================================

interface TreeRendererProps {
    items: FolderItem[];
    level: number;
    activeProjectId?: string | null;
    onProjectSelect?: (projectPath: string) => void;
    onFolderRename?: (folderPath: string, newName: string) => void;
    onFolderDelete?: (folderPath: string) => void;
    onItemMove?: (sourcePath: string, sourceType: 'folder' | 'project', targetFolderPath: string | null) => void;
    onProjectDelete?: (projectPath: string) => void;
}

const TreeRenderer: React.FC<TreeRendererProps> = ({
    items,
    level,
    activeProjectId,
    onProjectSelect,
    onFolderRename,
    onFolderDelete,
    onItemMove,
    onProjectDelete,
}) => {
    const [expandedFolders] = useAtom(expandedFoldersAtom);
    const [, setSelectedItemId] = useAtom(selectedItemIdAtom);
    const toggleFolderExpansion = useSetAtom(toggleFolderExpansionAtom);
    const [folderTree] = useAtom(folderTreeAtom);

    const handleToggle = useCallback((folderPath: string) => {
        toggleFolderExpansion(folderPath);
    }, [toggleFolderExpansion]);

    return (
        <>
            {items.map((item) => {
                const isExpanded = item.type === 'folder' && expandedFolders.has(item.path);
                const folder = item.type === 'folder' ? folderTree.folders.get(item.path) : null;
                const children = folder?.children ?? [];

                return (
                    <DraggableItem
                        key={item.id}
                        item={item}
                        level={level}
                        isExpanded={isExpanded}
                        activeProjectId={activeProjectId}
                        onToggle={() => handleToggle(item.path)}
                        onProjectSelect={onProjectSelect}
                        onFolderRename={onFolderRename}
                        onFolderDelete={onFolderDelete}
                        onItemMove={onItemMove}
                        onProjectDelete={onProjectDelete}
                    >
                        {children.length > 0 && (
                            <TreeRenderer
                                items={children}
                                level={level + 1}
                                activeProjectId={activeProjectId}
                                onProjectSelect={onProjectSelect}
                                onFolderRename={onFolderRename}
                                onFolderDelete={onFolderDelete}
                                onItemMove={onItemMove}
                                onProjectDelete={onProjectDelete}
                            />
                        )}
                    </DraggableItem>
                );
            })}
        </>
    );
};

// ============================================================================
// FolderTree Component (Main)
// ============================================================================

export const FolderTree: React.FC<FolderTreeProps> = ({
    items,
    onProjectSelect,
    onFolderRename,
    onFolderDelete,
    onItemMove,
    onProjectDelete,
    activeProjectId,
}) => {
    const [activeItem, setActiveItem] = useState<FolderItem | null>(null);
    const [folderTree] = useAtom(folderTreeAtom);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const data = active.data.current as DragData;
        
        // Find the item being dragged
        const findItem = (searchItems: FolderItem[], path: string): FolderItem | null => {
            for (const item of searchItems) {
                if (item.path === path) return item;
                if (item.type === 'folder') {
                    const folder = folderTree.folders.get(item.path);
                    if (folder?.children) {
                        const found = findItem(folder.children, path);
                        if (found) return found;
                    }
                }
            }
            return null;
        };

        const item = findItem(items, data.path);
        setActiveItem(item);
    }, [items, folderTree]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveItem(null);

        if (!over || !onItemMove) return;

        const dragData = active.data.current as DragData;
        const dropData = over.data.current as { path: string | null; type: string };

        // Don't drop on itself
        if (dragData.path === dropData.path) return;

        // Don't drop folder into its own descendant
        if (dropData.path && dropData.path.startsWith(dragData.path + '/')) return;

        // Determine target folder path
        let targetPath: string | null = null;
        if (over.id === 'root-drop-zone') {
            targetPath = null;
        } else if (dropData.type === 'folder') {
            targetPath = dropData.path;
        } else {
            return; // Can't drop on a project
        }

        // Don't move if already in target location
        const currentParent = dragData.path.includes('/') 
            ? dragData.path.substring(0, dragData.path.lastIndexOf('/'))
            : null;
        if (currentParent === targetPath) return;

        console.log('Moving:', dragData.path, 'to:', targetPath);
        onItemMove(dragData.path, dragData.type, targetPath);
    }, [onItemMove]);

    const isDragging = activeItem !== null;

    if (items.length === 0) {
        return (
            <DndContext sensors={sensors}>
                <RootDropZone isDragging={isDragging}>
                    <div className="px-4 py-6 text-xs text-figma-muted text-center italic">
                        No projects yet. Create your first project!
                    </div>
                </RootDropZone>
            </DndContext>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <RootDropZone isDragging={isDragging}>
                <TreeRenderer
                    items={items}
                    level={0}
                    activeProjectId={activeProjectId}
                    onProjectSelect={onProjectSelect}
                    onFolderRename={onFolderRename}
                    onFolderDelete={onFolderDelete}
                    onItemMove={onItemMove}
                    onProjectDelete={onProjectDelete}
                />
            </RootDropZone>

            <DragOverlay>
                {activeItem && (
                    <DraggableItem
                        item={activeItem}
                        level={0}
                        isExpanded={false}
                        activeProjectId={activeProjectId}
                        onToggle={() => {}}
                        isDragOverlay
                    />
                )}
            </DragOverlay>
        </DndContext>
    );
};

export default FolderTree;
