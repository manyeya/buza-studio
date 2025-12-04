/**
 * React Query hooks for folder operations
 * 
 * Provides queries and mutations for folder CRUD operations with optimistic updates.
 * 
 * _Requirements: 1.1, 2.1, 4.2, 4.3, 5.1_
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom, useSetAtom } from 'jotai';
import { toast } from 'sonner';
import {
    getFolderTree,
    createFolder,
    renameFolder,
    deleteFolder,
    moveProject,
    moveFolder,
    loadFolderInTree,
    type FolderTree,
    type Folder,
    type FolderItem
} from '../lib/folder-system';
import {
    folderTreeAtom,
    expandedFoldersAtom,
    toggleFolderExpansionAtom,
    expandToItemAtom
} from '../atoms/folder-atoms';
import { PROJECTS_QUERY_KEY } from './useProjects';

// ============================================================================
// Query Keys
// ============================================================================

export const FOLDER_TREE_QUERY_KEY = ['folderTree'];

// ============================================================================
// Folder Tree Query
// ============================================================================

/**
 * Hook to fetch and manage the folder tree
 * 
 * Fetches the complete folder tree from the filesystem and syncs it with Jotai state.
 * 
 * _Requirements: 1.1, 6.1_
 */
export function useFolderTree() {
    const setFolderTree = useSetAtom(folderTreeAtom);

    return useQuery({
        queryKey: FOLDER_TREE_QUERY_KEY,
        queryFn: async () => {
            const tree = await getFolderTree();
            setFolderTree(tree);
            return tree;
        },
        staleTime: Infinity, // Data is managed locally, won't go stale
    });
}

// ============================================================================
// Folder CRUD Mutations
// ============================================================================

/**
 * Hook to create a new folder
 * 
 * Creates a folder with the given name in the specified parent folder.
 * Uses optimistic updates for responsive UI.
 * 
 * _Requirements: 1.1, 1.3, 1.4_
 */
export function useCreateFolder() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
    const setExpanded = useSetAtom(expandedFoldersAtom);

    return useMutation({
        mutationFn: async ({ parentPath, name }: { parentPath: string | null; name: string }) => {
            return createFolder(parentPath, name);
        },
        onMutate: async ({ parentPath, name }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: FOLDER_TREE_QUERY_KEY });

            // Snapshot the previous value
            const previousTree = queryClient.getQueryData<FolderTree>(FOLDER_TREE_QUERY_KEY);

            // Optimistically update the folder tree
            const optimisticFolder: Folder = {
                id: crypto.randomUUID(),
                name,
                path: parentPath ? `${parentPath}/${name}` : name,
                parentPath,
                children: [],
                isExpanded: false
            };

            const optimisticItem: FolderItem = {
                type: 'folder',
                id: optimisticFolder.id,
                name,
                path: optimisticFolder.path
            };

            // Update the tree optimistically
            const newTree: FolderTree = {
                rootItems: parentPath === null 
                    ? [...folderTree.rootItems, optimisticItem].sort(sortFolderItems)
                    : folderTree.rootItems,
                folders: new Map(folderTree.folders)
            };

            // Add the new folder to the folders map
            newTree.folders.set(optimisticFolder.path, optimisticFolder);

            // If parent exists, update its children
            if (parentPath !== null) {
                const parentFolder = newTree.folders.get(parentPath);
                if (parentFolder) {
                    newTree.folders.set(parentPath, {
                        ...parentFolder,
                        children: [...parentFolder.children, optimisticItem].sort(sortFolderItems)
                    });
                }
            }

            setFolderTree(newTree);
            queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, newTree);

            return { previousTree };
        },
        onSuccess: (createdFolder, { parentPath }) => {
            // Expand parent folder if it exists
            if (parentPath !== null) {
                setExpanded(prev => new Set([...prev, parentPath]));
            }
            toast.success(`Folder "${createdFolder.name}" created`);
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousTree) {
                setFolderTree(context.previousTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, context.previousTree);
            }
            toast.error('Failed to create folder');
        },
        onSettled: () => {
            // Refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: FOLDER_TREE_QUERY_KEY });
        }
    });
}

/**
 * Hook to rename a folder
 * 
 * Renames a folder and updates all child paths accordingly.
 * Uses optimistic updates for responsive UI.
 * 
 * _Requirements: 4.2_
 */
export function useRenameFolder() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);

    return useMutation({
        mutationFn: async ({ folderPath, newName }: { folderPath: string; newName: string }) => {
            return renameFolder(folderPath, newName);
        },
        onMutate: async ({ folderPath, newName }) => {
            await queryClient.cancelQueries({ queryKey: FOLDER_TREE_QUERY_KEY });

            const previousTree = queryClient.getQueryData<FolderTree>(FOLDER_TREE_QUERY_KEY);
            const oldFolder = folderTree.folders.get(folderPath);

            if (oldFolder) {
                const parentPath = oldFolder.parentPath;
                const newPath = parentPath ? `${parentPath}/${newName}` : newName;

                // Create updated folder
                const updatedFolder: Folder = {
                    ...oldFolder,
                    name: newName,
                    path: newPath
                };

                // Update the tree
                const newFolders = new Map(folderTree.folders);
                newFolders.delete(folderPath);
                newFolders.set(newPath, updatedFolder);

                // Update root items or parent's children
                let newRootItems = folderTree.rootItems;
                if (parentPath === null) {
                    newRootItems = folderTree.rootItems.map(item =>
                        item.path === folderPath
                            ? { ...item, name: newName, path: newPath }
                            : item
                    );
                } else {
                    const parentFolder = newFolders.get(parentPath);
                    if (parentFolder) {
                        newFolders.set(parentPath, {
                            ...parentFolder,
                            children: parentFolder.children.map(item =>
                                item.path === folderPath
                                    ? { ...item, name: newName, path: newPath }
                                    : item
                            )
                        });
                    }
                }

                const newTree: FolderTree = {
                    rootItems: newRootItems,
                    folders: newFolders
                };

                setFolderTree(newTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, newTree);
            }

            return { previousTree };
        },
        onSuccess: (renamedFolder) => {
            toast.success(`Folder renamed to "${renamedFolder.name}"`);
        },
        onError: (_error, _variables, context) => {
            if (context?.previousTree) {
                setFolderTree(context.previousTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, context.previousTree);
            }
            toast.error('Failed to rename folder');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FOLDER_TREE_QUERY_KEY });
        }
    });
}

/**
 * Hook to delete a folder
 * 
 * Deletes a folder and moves its contents to the parent folder.
 * Uses optimistic updates for responsive UI.
 * 
 * _Requirements: 4.3, 4.5_
 */
export function useDeleteFolder() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);

    return useMutation({
        mutationFn: async (folderPath: string) => {
            return deleteFolder(folderPath);
        },
        onMutate: async (folderPath) => {
            await queryClient.cancelQueries({ queryKey: FOLDER_TREE_QUERY_KEY });

            const previousTree = queryClient.getQueryData<FolderTree>(FOLDER_TREE_QUERY_KEY);
            const folderToDelete = folderTree.folders.get(folderPath);

            if (folderToDelete) {
                const parentPath = folderToDelete.parentPath;
                const newFolders = new Map(folderTree.folders);
                
                // Remove the folder from the map
                newFolders.delete(folderPath);

                // Move children to parent
                const movedChildren = folderToDelete.children.map(child => ({
                    ...child,
                    path: parentPath ? `${parentPath}/${child.name}` : child.name
                }));

                let newRootItems = folderTree.rootItems;

                if (parentPath === null) {
                    // Remove folder from root and add its children
                    newRootItems = [
                        ...folderTree.rootItems.filter(item => item.path !== folderPath),
                        ...movedChildren
                    ].sort(sortFolderItems);
                } else {
                    // Update parent's children
                    const parentFolder = newFolders.get(parentPath);
                    if (parentFolder) {
                        newFolders.set(parentPath, {
                            ...parentFolder,
                            children: [
                                ...parentFolder.children.filter(item => item.path !== folderPath),
                                ...movedChildren
                            ].sort(sortFolderItems)
                        });
                    }
                }

                const newTree: FolderTree = {
                    rootItems: newRootItems,
                    folders: newFolders
                };

                setFolderTree(newTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, newTree);
            }

            return { previousTree };
        },
        onSuccess: () => {
            toast.success('Folder deleted');
            // Also invalidate projects query since folder contents may have moved
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
        },
        onError: (_error, _variables, context) => {
            if (context?.previousTree) {
                setFolderTree(context.previousTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, context.previousTree);
            }
            toast.error('Failed to delete folder');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FOLDER_TREE_QUERY_KEY });
        }
    });
}

// ============================================================================
// Move Operations
// ============================================================================

/**
 * Hook to move a project to a different folder
 * 
 * Moves a project to the target folder, preserving all project data.
 * Uses optimistic updates for responsive UI.
 * 
 * _Requirements: 2.1, 2.3, 2.4_
 */
export function useMoveProject() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
    const expandToItem = useSetAtom(expandToItemAtom);

    return useMutation({
        mutationFn: async ({ 
            projectPath, 
            targetFolderPath 
        }: { 
            projectPath: string; 
            targetFolderPath: string | null 
        }) => {
            return moveProject(projectPath, targetFolderPath);
        },
        onMutate: async ({ projectPath, targetFolderPath }) => {
            await queryClient.cancelQueries({ queryKey: FOLDER_TREE_QUERY_KEY });

            const previousTree = queryClient.getQueryData<FolderTree>(FOLDER_TREE_QUERY_KEY);

            // Find the project item
            const projectName = projectPath.split('/').pop()!;
            const sourceParentPath = projectPath.includes('/') 
                ? projectPath.substring(0, projectPath.lastIndexOf('/'))
                : null;

            const newPath = targetFolderPath 
                ? `${targetFolderPath}/${projectName}` 
                : projectName;

            const projectItem: FolderItem = {
                type: 'project',
                id: crypto.randomUUID(),
                name: projectName,
                path: newPath
            };

            const newFolders = new Map(folderTree.folders);
            let newRootItems = [...folderTree.rootItems];

            // Remove from source
            if (sourceParentPath === null) {
                newRootItems = newRootItems.filter(item => item.path !== projectPath);
            } else {
                const sourceFolder = newFolders.get(sourceParentPath);
                if (sourceFolder) {
                    newFolders.set(sourceParentPath, {
                        ...sourceFolder,
                        children: sourceFolder.children.filter(item => item.path !== projectPath)
                    });
                }
            }

            // Add to target
            if (targetFolderPath === null) {
                newRootItems = [...newRootItems, projectItem].sort(sortFolderItems);
            } else {
                const targetFolder = newFolders.get(targetFolderPath);
                if (targetFolder) {
                    newFolders.set(targetFolderPath, {
                        ...targetFolder,
                        children: [...targetFolder.children, projectItem].sort(sortFolderItems)
                    });
                }
            }

            const newTree: FolderTree = {
                rootItems: newRootItems,
                folders: newFolders
            };

            setFolderTree(newTree);
            queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, newTree);

            return { previousTree, newPath };
        },
        onSuccess: (newPath) => {
            // Expand folders to show the moved project
            expandToItem(newPath);
            toast.success('Project moved');
            // Invalidate projects query to update project list
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
        },
        onError: (_error, _variables, context) => {
            if (context?.previousTree) {
                setFolderTree(context.previousTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, context.previousTree);
            }
            toast.error('Failed to move project');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FOLDER_TREE_QUERY_KEY });
        }
    });
}

/**
 * Hook to move a folder to a different parent folder
 * 
 * Moves a folder to the target folder, updating all nested paths.
 * Validates that the move doesn't create circular references.
 * Uses optimistic updates for responsive UI.
 * 
 * _Requirements: 5.1, 5.4_
 */
export function useMoveFolder() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
    const expandToItem = useSetAtom(expandToItemAtom);

    return useMutation({
        mutationFn: async ({ 
            folderPath, 
            targetFolderPath 
        }: { 
            folderPath: string; 
            targetFolderPath: string | null 
        }) => {
            return moveFolder(folderPath, targetFolderPath);
        },
        onMutate: async ({ folderPath, targetFolderPath }) => {
            await queryClient.cancelQueries({ queryKey: FOLDER_TREE_QUERY_KEY });

            const previousTree = queryClient.getQueryData<FolderTree>(FOLDER_TREE_QUERY_KEY);
            const folderToMove = folderTree.folders.get(folderPath);

            if (folderToMove) {
                const folderName = folderPath.split('/').pop()!;
                const sourceParentPath = folderToMove.parentPath;
                const newPath = targetFolderPath 
                    ? `${targetFolderPath}/${folderName}` 
                    : folderName;

                const newFolders = new Map(folderTree.folders);
                let newRootItems = [...folderTree.rootItems];

                // Remove from source
                if (sourceParentPath === null) {
                    newRootItems = newRootItems.filter(item => item.path !== folderPath);
                } else {
                    const sourceFolder = newFolders.get(sourceParentPath);
                    if (sourceFolder) {
                        newFolders.set(sourceParentPath, {
                            ...sourceFolder,
                            children: sourceFolder.children.filter(item => item.path !== folderPath)
                        });
                    }
                }

                // Update the moved folder's path and parent
                const movedFolder: Folder = {
                    ...folderToMove,
                    path: newPath,
                    parentPath: targetFolderPath
                };

                // Remove old path and add new path
                newFolders.delete(folderPath);
                newFolders.set(newPath, movedFolder);

                const folderItem: FolderItem = {
                    type: 'folder',
                    id: movedFolder.id,
                    name: folderName,
                    path: newPath
                };

                // Add to target
                if (targetFolderPath === null) {
                    newRootItems = [...newRootItems, folderItem].sort(sortFolderItems);
                } else {
                    const targetFolder = newFolders.get(targetFolderPath);
                    if (targetFolder) {
                        newFolders.set(targetFolderPath, {
                            ...targetFolder,
                            children: [...targetFolder.children, folderItem].sort(sortFolderItems)
                        });
                    }
                }

                const newTree: FolderTree = {
                    rootItems: newRootItems,
                    folders: newFolders
                };

                setFolderTree(newTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, newTree);

                return { previousTree, newPath };
            }

            return { previousTree };
        },
        onSuccess: (_newPath, _variables, context) => {
            if (context?.newPath) {
                expandToItem(context.newPath);
            }
            toast.success('Folder moved');
        },
        onError: (error, _variables, context) => {
            if (context?.previousTree) {
                setFolderTree(context.previousTree);
                queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, context.previousTree);
            }
            const errorMessage = error instanceof Error ? error.message : 'Failed to move folder';
            toast.error(errorMessage);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: FOLDER_TREE_QUERY_KEY });
        }
    });
}

// ============================================================================
// Folder Expansion
// ============================================================================

/**
 * Hook to load folder contents when expanding
 * 
 * Loads the contents of a folder lazily when it's expanded.
 */
export function useLoadFolderContents() {
    const queryClient = useQueryClient();
    const [folderTree, setFolderTree] = useAtom(folderTreeAtom);
    const toggleExpansion = useSetAtom(toggleFolderExpansionAtom);

    return useMutation({
        mutationFn: async (folderPath: string) => {
            return loadFolderInTree(folderTree, folderPath);
        },
        onSuccess: (updatedTree, folderPath) => {
            setFolderTree(updatedTree);
            queryClient.setQueryData(FOLDER_TREE_QUERY_KEY, updatedTree);
            toggleExpansion(folderPath);
        },
        onError: () => {
            toast.error('Failed to load folder contents');
        }
    });
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Combined hook for all folder operations
 * 
 * Provides access to folder tree query and all folder mutations.
 * 
 * _Requirements: 1.1, 2.1, 4.2, 4.3, 5.1_
 */
export function useFolders() {
    const folderTreeQuery = useFolderTree();
    const createFolderMutation = useCreateFolder();
    const renameFolderMutation = useRenameFolder();
    const deleteFolderMutation = useDeleteFolder();
    const moveProjectMutation = useMoveProject();
    const moveFolderMutation = useMoveFolder();
    const loadFolderContentsMutation = useLoadFolderContents();

    return {
        // Query
        folderTree: folderTreeQuery.data,
        isLoading: folderTreeQuery.isLoading,
        isError: folderTreeQuery.isError,
        error: folderTreeQuery.error,
        refetch: folderTreeQuery.refetch,

        // Mutations
        createFolder: createFolderMutation.mutate,
        createFolderAsync: createFolderMutation.mutateAsync,
        isCreatingFolder: createFolderMutation.isPending,

        renameFolder: renameFolderMutation.mutate,
        renameFolderAsync: renameFolderMutation.mutateAsync,
        isRenamingFolder: renameFolderMutation.isPending,

        deleteFolder: deleteFolderMutation.mutate,
        deleteFolderAsync: deleteFolderMutation.mutateAsync,
        isDeletingFolder: deleteFolderMutation.isPending,

        moveProject: moveProjectMutation.mutate,
        moveProjectAsync: moveProjectMutation.mutateAsync,
        isMovingProject: moveProjectMutation.isPending,

        moveFolder: moveFolderMutation.mutate,
        moveFolderAsync: moveFolderMutation.mutateAsync,
        isMovingFolder: moveFolderMutation.isPending,

        loadFolderContents: loadFolderContentsMutation.mutate,
        loadFolderContentsAsync: loadFolderContentsMutation.mutateAsync,
        isLoadingFolderContents: loadFolderContentsMutation.isPending
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sort folder items: folders first, then projects, alphabetically within each group
 */
function sortFolderItems(a: FolderItem, b: FolderItem): number {
    if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
}
