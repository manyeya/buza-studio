/**
 * Jotai atoms for folder state management
 * 
 * Provides reactive state for folder tree structure, navigation,
 * and UI state like expand/collapse.
 * 
 * _Requirements: 3.1, 3.2, 3.3_
 */

import { atom } from 'jotai';
import type { FolderTree } from '../lib/folder-system';

// ============================================================================
// Core Folder State Atoms
// ============================================================================

/**
 * Folder tree state atom
 * 
 * Stores the complete folder hierarchy including root items and all loaded folders.
 * This is the primary source of truth for the folder structure.
 * 
 * _Requirements: 3.1, 6.1_
 */
export const folderTreeAtom = atom<FolderTree>({
    rootItems: [],
    folders: new Map()
});

/**
 * Expanded folders state atom
 * 
 * Tracks which folders are currently expanded in the UI.
 * Stores folder paths as strings in a Set for O(1) lookup.
 * 
 * _Requirements: 3.1_
 */
export const expandedFoldersAtom = atom<Set<string>>(new Set<string>());

/**
 * Current folder path atom
 * 
 * Tracks the currently selected/navigated folder path.
 * null represents the root level.
 * 
 * _Requirements: 3.2, 3.3_
 */
export const currentFolderPathAtom = atom<string | null>(null);

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Breadcrumb path derived atom
 * 
 * Computes the breadcrumb trail from the current folder path.
 * Returns an array of path segments for navigation display.
 * 
 * Example:
 * - currentFolderPath: "Work/Client-Prompts" 
 * - breadcrumbPath: ["Work", "Client-Prompts"]
 * 
 * _Requirements: 3.2, 3.3_
 */
export const breadcrumbPathAtom = atom((get) => {
    const currentPath = get(currentFolderPathAtom);
    if (!currentPath) return [];
    return currentPath.split('/');
});

/**
 * Current folder items derived atom
 * 
 * Returns the items (folders and projects) in the currently selected folder.
 * If at root level, returns root items from the folder tree.
 * 
 * _Requirements: 3.4_
 */
export const currentFolderItemsAtom = atom((get) => {
    const tree = get(folderTreeAtom);
    const currentPath = get(currentFolderPathAtom);
    
    if (!currentPath) {
        // At root level, return root items
        return tree.rootItems;
    }
    
    // Get the folder from the tree
    const folder = tree.folders.get(currentPath);
    return folder?.children ?? [];
});

/**
 * Selected item atom
 * 
 * Tracks the currently selected item (folder or project) in the tree.
 * null means no item is selected.
 */
export const selectedItemIdAtom = atom<string | null, [string | null], void>(
    null,
    (_get, set, newValue) => set(selectedItemIdAtom, newValue)
);

// ============================================================================
// Action Atoms (Write-only atoms for state mutations)
// ============================================================================

/**
 * Toggle folder expansion action atom
 * 
 * Toggles the expanded state of a folder by its path.
 */
export const toggleFolderExpansionAtom = atom(
    null,
    (get, set, folderPath: string) => {
        const expanded = get(expandedFoldersAtom);
        const newExpanded = new Set<string>(expanded);
        
        if (newExpanded.has(folderPath)) {
            newExpanded.delete(folderPath);
        } else {
            newExpanded.add(folderPath);
        }
        
        set(expandedFoldersAtom, newExpanded);
    }
);

/**
 * Navigate to folder action atom
 * 
 * Sets the current folder path and ensures all parent folders are expanded.
 */
export const navigateToFolderAtom = atom(
    null,
    (get, set, folderPath: string | null) => {
        // Use type assertion to work around jotai type inference issue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(currentFolderPathAtom as any, folderPath);
        
        // Expand all parent folders to make the path visible
        if (folderPath) {
            const expanded = get(expandedFoldersAtom);
            const newExpanded = new Set<string>(expanded);
            
            // Split path and expand each parent
            const segments = folderPath.split('/');
            let currentPath = '';
            
            for (let i = 0; i < segments.length - 1; i++) {
                currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i];
                newExpanded.add(currentPath);
            }
            
            set(expandedFoldersAtom, newExpanded);
        }
    }
);

/**
 * Update folder tree action atom
 * 
 * Updates the folder tree state with new data.
 */
export const updateFolderTreeAtom = atom(
    null,
    (_get, set, tree: FolderTree) => {
        set(folderTreeAtom, tree);
    }
);

/**
 * Expand folder to item action atom
 * 
 * Expands all folders in the path to a specific item.
 * Useful for revealing an item in the tree (e.g., after search).
 */
export const expandToItemAtom = atom(
    null,
    (get, set, itemPath: string) => {
        const expanded = get(expandedFoldersAtom);
        const newExpanded = new Set<string>(expanded);
        
        // Get parent path by removing the last segment
        const lastSlashIndex = itemPath.lastIndexOf('/');
        if (lastSlashIndex === -1) {
            // Item is at root level, nothing to expand
            return;
        }
        
        const parentPath = itemPath.substring(0, lastSlashIndex);
        
        // Expand all folders in the parent path
        const segments = parentPath.split('/');
        let currentPath = '';
        
        for (const segment of segments) {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
            newExpanded.add(currentPath);
        }
        
        set(expandedFoldersAtom, newExpanded);
    }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a folder is expanded
 */
export function isFolderExpanded(expanded: Set<string>, folderPath: string): boolean {
    return expanded.has(folderPath);
}

/**
 * Get the parent path from a full path
 */
export function getParentPath(path: string): string | null {
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return null;
    }
    return path.substring(0, lastSlashIndex);
}

/**
 * Build breadcrumb items from a path
 * Returns array of { name, path } objects for each segment
 */
export function buildBreadcrumbItems(path: string | null): Array<{ name: string; path: string }> {
    if (!path) return [];
    
    const segments = path.split('/');
    const items: Array<{ name: string; path: string }> = [];
    let currentPath = '';
    
    for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        items.push({
            name: segment,
            path: currentPath
        });
    }
    
    return items;
}
