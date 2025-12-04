/**
 * Folder System for Buza Studio
 * 
 * Provides hierarchical folder organization for prompt projects.
 * Folders are represented as filesystem directories with a .folder marker file.
 */

import {
    mkdir,
    writeTextFile,
    readTextFile,
    readDir,
    exists,
    rename,
    remove,
    BaseDirectory
} from '@tauri-apps/plugin-fs';
import { Project } from './project-system';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a folder in the hierarchy
 */
export interface Folder {
    /** UUID for React keys */
    id: string;
    /** Display name (directory name) */
    name: string;
    /** Relative path from buza-projects root */
    path: string;
    /** Parent folder path, null for root */
    parentPath: string | null;
    /** Loaded children (folders and projects) */
    children: FolderItem[];
    /** UI state for expand/collapse */
    isExpanded: boolean;
}

/**
 * Represents an item in a folder (either a folder or project)
 */
export interface FolderItem {
    type: 'folder' | 'project';
    id: string;
    name: string;
    path: string;
}

/**
 * Represents the complete folder tree structure
 */
export interface FolderTree {
    /** Top-level folders and projects */
    rootItems: FolderItem[];
    /** All loaded folders by path */
    folders: Map<string, Folder>;
}

/**
 * Represents a search result with folder context
 */
export interface SearchResult {
    project: Project;
    folderPath: string;
    matchedText: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Marker file name that identifies a directory as a folder (not a project) */
export const FOLDER_MARKER_FILE = '.folder';

/** Project metadata file name */
export const PROJECT_JSON_FILE = 'project.json';


// ============================================================================
// Folder Detection and Marker File Logic
// ============================================================================

/**
 * Generates a unique ID for folders and items
 */
export function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Check if a directory is a folder (has .folder marker) vs project (has project.json)
 * 
 * @param dirPath - Relative path to the directory from buza-projects root
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns 'folder' if directory has .folder marker, 'project' if has project.json, null if neither
 */
export async function detectDirectoryType(
    dirPath: string,
    basePath: string = 'buza-projects'
): Promise<'folder' | 'project' | null> {
    const fullPath = dirPath ? `${basePath}/${dirPath}` : basePath;
    
    // Check for .folder marker file
    const folderMarkerPath = `${fullPath}/${FOLDER_MARKER_FILE}`;
    const hasFolderMarker = await exists(folderMarkerPath, { baseDir: BaseDirectory.Document });
    
    if (hasFolderMarker) {
        return 'folder';
    }
    
    // Check for project.json file
    const projectJsonPath = `${fullPath}/${PROJECT_JSON_FILE}`;
    const hasProjectJson = await exists(projectJsonPath, { baseDir: BaseDirectory.Document });
    
    if (hasProjectJson) {
        return 'project';
    }
    
    return null;
}

/**
 * Check if a directory is a folder (has .folder marker)
 * 
 * @param dirPath - Relative path to the directory from buza-projects root
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns true if directory is a folder
 */
export async function isFolder(
    dirPath: string,
    basePath: string = 'buza-projects'
): Promise<boolean> {
    const type = await detectDirectoryType(dirPath, basePath);
    return type === 'folder';
}

/**
 * Check if a directory is a project (has project.json)
 * 
 * @param dirPath - Relative path to the directory from buza-projects root
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns true if directory is a project
 */
export async function isProject(
    dirPath: string,
    basePath: string = 'buza-projects'
): Promise<boolean> {
    const type = await detectDirectoryType(dirPath, basePath);
    return type === 'project';
}

/**
 * Create a .folder marker file in a directory to mark it as a folder
 * 
 * @param dirPath - Relative path to the directory from buza-projects root
 * @param basePath - Base path for projects (default: 'buza-projects')
 */
export async function createFolderMarker(
    dirPath: string,
    basePath: string = 'buza-projects'
): Promise<void> {
    const fullPath = dirPath ? `${basePath}/${dirPath}` : basePath;
    const markerPath = `${fullPath}/${FOLDER_MARKER_FILE}`;
    
    // Create an empty marker file
    await writeTextFile(markerPath, '', { baseDir: BaseDirectory.Document });
}

/**
 * Create a folder directory with the .folder marker file
 * 
 * @param folderPath - Relative path where the folder should be created
 * @param basePath - Base path for projects (default: 'buza-projects')
 */
export async function createFolderDirectory(
    folderPath: string,
    basePath: string = 'buza-projects'
): Promise<void> {
    const fullPath = `${basePath}/${folderPath}`;
    
    // Create the directory
    await mkdir(fullPath, { baseDir: BaseDirectory.Document, recursive: true });
    
    // Create the .folder marker file
    await createFolderMarker(folderPath, basePath);
}

/**
 * Read the folder structure from a directory
 * Returns items classified as folders or projects
 * 
 * @param dirPath - Relative path to the directory (empty string for root)
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Array of FolderItems (folders and projects)
 */
export async function readFolderContents(
    dirPath: string = '',
    basePath: string = 'buza-projects'
): Promise<FolderItem[]> {
    const fullPath = dirPath ? `${basePath}/${dirPath}` : basePath;
    
    const entries = await readDir(fullPath, { baseDir: BaseDirectory.Document });
    const items: FolderItem[] = [];
    
    for (const entry of entries) {
        // Skip non-directories and hidden files (except we need to check directories)
        if (!entry.isDirectory) {
            continue;
        }
        
        // Skip hidden directories (starting with .)
        if (entry.name.startsWith('.')) {
            continue;
        }
        
        const itemPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
        const type = await detectDirectoryType(itemPath, basePath);
        
        if (type === 'folder' || type === 'project') {
            items.push({
                type,
                id: generateId(),
                name: entry.name,
                path: itemPath
            });
        }
    }
    
    // Sort: folders first, then projects, alphabetically within each group
    items.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    
    return items;
}

/**
 * Build a Folder object from a directory path
 * 
 * @param folderPath - Relative path to the folder
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Folder object with loaded children
 */
export async function buildFolder(
    folderPath: string,
    basePath: string = 'buza-projects'
): Promise<Folder> {
    const name = folderPath.split('/').pop() || folderPath;
    const parentPath = folderPath.includes('/') 
        ? folderPath.substring(0, folderPath.lastIndexOf('/'))
        : null;
    
    const children = await readFolderContents(folderPath, basePath);
    
    return {
        id: generateId(),
        name,
        path: folderPath,
        parentPath,
        children,
        isExpanded: false
    };
}

/**
 * Build the complete folder tree from the filesystem
 * 
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns FolderTree with all root items and loaded folders
 */
export async function buildFolderTree(
    basePath: string = 'buza-projects'
): Promise<FolderTree> {
    const rootItems = await readFolderContents('', basePath);
    const folders = new Map<string, Folder>();
    
    // Load folder details for each folder in root
    for (const item of rootItems) {
        if (item.type === 'folder') {
            const folder = await buildFolder(item.path, basePath);
            folders.set(item.path, folder);
        }
    }
    
    return {
        rootItems,
        folders
    };
}

// ============================================================================
// Name Generation and Validation
// ============================================================================

/**
 * Generate a unique folder name by appending numeric suffix if needed
 * 
 * @param parentPath - Parent folder path (null for root)
 * @param baseName - Base name for the folder
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Unique folder name
 */
export async function generateUniqueFolderName(
    parentPath: string | null,
    baseName: string,
    basePath: string = 'buza-projects'
): Promise<string> {
    const parentFullPath = parentPath ? `${basePath}/${parentPath}` : basePath;
    
    // Check if base name is available
    const baseFullPath = `${parentFullPath}/${baseName}`;
    const baseExists = await exists(baseFullPath, { baseDir: BaseDirectory.Document });
    
    if (!baseExists) {
        return baseName;
    }
    
    // Find next available numeric suffix
    let suffix = 1;
    while (true) {
        const candidateName = `${baseName}-${suffix}`;
        const candidateFullPath = `${parentFullPath}/${candidateName}`;
        const candidateExists = await exists(candidateFullPath, { baseDir: BaseDirectory.Document });
        
        if (!candidateExists) {
            return candidateName;
        }
        
        suffix++;
        
        // Safety limit to prevent infinite loop
        if (suffix > 1000) {
            throw new Error(`Unable to generate unique name for "${baseName}" after 1000 attempts`);
        }
    }
}

// ============================================================================
// Folder CRUD Operations
// ============================================================================

/**
 * Create a new folder with the given name in the specified parent folder
 * 
 * @param parentPath - Parent folder path (null for root level)
 * @param name - Desired folder name
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Created Folder object
 */
export async function createFolder(
    parentPath: string | null,
    name: string,
    basePath: string = 'buza-projects'
): Promise<Folder> {
    // Generate unique name if collision exists
    const uniqueName = await generateUniqueFolderName(parentPath, name, basePath);
    
    // Build the folder path
    const folderPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
    
    // Create the directory with .folder marker
    await createFolderDirectory(folderPath, basePath);
    
    // Return the created Folder object
    return {
        id: generateId(),
        name: uniqueName,
        path: folderPath,
        parentPath,
        children: [],
        isExpanded: false
    };
}

/**
 * Rename a folder and update all child paths accordingly
 * 
 * @param folderPath - Current relative path to the folder
 * @param newName - New name for the folder
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Updated Folder object with new path
 */
export async function renameFolder(
    folderPath: string,
    newName: string,
    basePath: string = 'buza-projects'
): Promise<Folder> {
    // Verify the folder exists
    const folderType = await detectDirectoryType(folderPath, basePath);
    if (folderType !== 'folder') {
        throw new Error(`Path "${folderPath}" is not a valid folder`);
    }
    
    // Calculate parent path and new folder path
    const parentPath = folderPath.includes('/') 
        ? folderPath.substring(0, folderPath.lastIndexOf('/'))
        : null;
    
    const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;
    
    // Check if new name already exists (unless it's the same name)
    if (folderPath !== newFolderPath) {
        const newFullPath = `${basePath}/${newFolderPath}`;
        const newPathExists = await exists(newFullPath, { baseDir: BaseDirectory.Document });
        
        if (newPathExists) {
            throw new Error(`A folder or project with name "${newName}" already exists at this level`);
        }
    }
    
    // Rename the directory on the filesystem
    const oldFullPath = `${basePath}/${folderPath}`;
    const newFullPath = `${basePath}/${newFolderPath}`;
    
    await rename(oldFullPath, newFullPath, { 
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document 
    });
    
    // Build and return the updated folder object
    // Note: Children paths are automatically updated since they're relative to the folder
    const children = await readFolderContents(newFolderPath, basePath);
    
    return {
        id: generateId(),
        name: newName,
        path: newFolderPath,
        parentPath,
        children,
        isExpanded: false
    };
}

/**
 * Delete a folder from the filesystem
 * 
 * If the folder is empty, it is simply removed.
 * If the folder contains items (subfolders or projects), they are moved to the parent folder
 * before the folder is deleted.
 * 
 * @param folderPath - Relative path to the folder to delete
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Array of items that were moved to parent (empty if folder was empty)
 */
export async function deleteFolder(
    folderPath: string,
    basePath: string = 'buza-projects'
): Promise<FolderItem[]> {
    // Verify the folder exists
    const folderType = await detectDirectoryType(folderPath, basePath);
    if (folderType !== 'folder') {
        throw new Error(`Path "${folderPath}" is not a valid folder`);
    }
    
    // Get folder contents
    const contents = await readFolderContents(folderPath, basePath);
    
    // Calculate parent path
    const parentPath = folderPath.includes('/') 
        ? folderPath.substring(0, folderPath.lastIndexOf('/'))
        : null;
    
    const movedItems: FolderItem[] = [];
    
    // If folder has contents, move them to parent
    if (contents.length > 0) {
        const parentFullPath = parentPath ? `${basePath}/${parentPath}` : basePath;
        
        for (const item of contents) {
            const itemOldFullPath = `${basePath}/${item.path}`;
            const itemNewPath = parentPath ? `${parentPath}/${item.name}` : item.name;
            const itemNewFullPath = `${parentFullPath}/${item.name}`;
            
            // Move the item to parent folder
            await rename(itemOldFullPath, itemNewFullPath, {
                oldPathBaseDir: BaseDirectory.Document,
                newPathBaseDir: BaseDirectory.Document
            });
            
            // Track moved item with updated path
            movedItems.push({
                ...item,
                path: itemNewPath
            });
        }
    }
    
    // Delete the now-empty folder
    const folderFullPath = `${basePath}/${folderPath}`;
    await remove(folderFullPath, { 
        baseDir: BaseDirectory.Document, 
        recursive: true 
    });
    
    return movedItems;
}

// ============================================================================
// Move Operations
// ============================================================================

/**
 * Check if a move target is valid (not moving a folder into itself or its descendants)
 * 
 * @param sourcePath - Path of the item being moved
 * @param targetPath - Path of the target folder (null for root)
 * @returns true if the move is valid, false if it would create a circular reference
 * 
 * **Validates: Requirements 5.4**
 */
export function isValidMoveTarget(
    sourcePath: string,
    targetPath: string | null
): boolean {
    // Moving to root is always valid
    if (targetPath === null) {
        return true;
    }
    
    // Cannot move to itself
    if (sourcePath === targetPath) {
        return false;
    }
    
    // Cannot move a folder into one of its descendants
    // Check if targetPath starts with sourcePath/
    if (targetPath.startsWith(sourcePath + '/')) {
        return false;
    }
    
    return true;
}

/**
 * Move a project to a target folder
 * 
 * @param projectPath - Current relative path to the project
 * @param targetFolderPath - Target folder path (null for root level)
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns The new path of the project
 * 
 * **Validates: Requirements 2.1, 2.3, 2.4**
 */
export async function moveProject(
    projectPath: string,
    targetFolderPath: string | null,
    basePath: string = 'buza-projects'
): Promise<string> {
    // Verify the source is a project
    const sourceType = await detectDirectoryType(projectPath, basePath);
    if (sourceType !== 'project') {
        throw new Error(`Path "${projectPath}" is not a valid project`);
    }
    
    // Get the project name from the path
    const projectName = projectPath.split('/').pop()!;
    
    // Calculate the new path
    const newProjectPath = targetFolderPath 
        ? `${targetFolderPath}/${projectName}` 
        : projectName;
    
    // If already at target location, nothing to do
    if (projectPath === newProjectPath) {
        return projectPath;
    }
    
    // Check if target folder exists (if not root)
    if (targetFolderPath !== null) {
        const targetType = await detectDirectoryType(targetFolderPath, basePath);
        if (targetType !== 'folder') {
            throw new Error(`Target path "${targetFolderPath}" is not a valid folder`);
        }
    }
    
    // Check if a project/folder with the same name already exists at target
    const newFullPath = `${basePath}/${newProjectPath}`;
    const targetExists = await exists(newFullPath, { baseDir: BaseDirectory.Document });
    
    if (targetExists) {
        throw new Error(`An item with name "${projectName}" already exists at the target location`);
    }
    
    // Move the project directory
    const oldFullPath = `${basePath}/${projectPath}`;
    
    await rename(oldFullPath, newFullPath, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
    });
    
    return newProjectPath;
}

/**
 * Move a folder to a target folder
 * 
 * @param folderPath - Current relative path to the folder
 * @param targetFolderPath - Target folder path (null for root level)
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns The new path of the folder
 * 
 * **Validates: Requirements 5.1**
 */
export async function moveFolder(
    folderPath: string,
    targetFolderPath: string | null,
    basePath: string = 'buza-projects'
): Promise<string> {
    // Verify the source is a folder
    const sourceType = await detectDirectoryType(folderPath, basePath);
    if (sourceType !== 'folder') {
        throw new Error(`Path "${folderPath}" is not a valid folder`);
    }
    
    // Validate move target (prevent circular references)
    if (!isValidMoveTarget(folderPath, targetFolderPath)) {
        throw new Error('Cannot move a folder into itself or one of its subfolders');
    }
    
    // Get the folder name from the path
    const folderName = folderPath.split('/').pop()!;
    
    // Calculate the new path
    const newFolderPath = targetFolderPath 
        ? `${targetFolderPath}/${folderName}` 
        : folderName;
    
    // If already at target location, nothing to do
    if (folderPath === newFolderPath) {
        return folderPath;
    }
    
    // Check if target folder exists (if not root)
    if (targetFolderPath !== null) {
        const targetType = await detectDirectoryType(targetFolderPath, basePath);
        if (targetType !== 'folder') {
            throw new Error(`Target path "${targetFolderPath}" is not a valid folder`);
        }
    }
    
    // Check if a folder/project with the same name already exists at target
    const newFullPath = `${basePath}/${newFolderPath}`;
    const targetExists = await exists(newFullPath, { baseDir: BaseDirectory.Document });
    
    if (targetExists) {
        throw new Error(`An item with name "${folderName}" already exists at the target location`);
    }
    
    // Move the folder directory
    const oldFullPath = `${basePath}/${folderPath}`;
    
    await rename(oldFullPath, newFullPath, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
    });
    
    return newFolderPath;
}

// ============================================================================
// Folder Navigation and Listing (Interface Methods)
// ============================================================================

/**
 * List the contents of a folder, returning all subfolders and projects within it.
 * Items are sorted with folders first, then projects, alphabetically within each group.
 * 
 * This is the interface method that matches the FolderOperations interface in the design.
 * 
 * @param folderPath - Relative path to the folder (null or empty string for root)
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Promise<FolderItem[]> - Sorted list of folders and projects
 * 
 * **Validates: Requirements 3.4, 6.1**
 */
export async function listFolderContents(
    folderPath: string | null,
    basePath: string = 'buza-projects'
): Promise<FolderItem[]> {
    // Normalize null to empty string for readFolderContents
    const normalizedPath = folderPath ?? '';
    return readFolderContents(normalizedPath, basePath);
}

/**
 * Get the complete folder tree from the filesystem.
 * Builds the tree structure with all root items and loaded folders.
 * Supports lazy loading - nested folder contents are loaded on-demand when expanded.
 * 
 * This is the interface method that matches the FolderOperations interface in the design.
 * 
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Promise<FolderTree> - Complete folder tree structure
 * 
 * **Validates: Requirements 6.1, 6.3**
 */
export async function getFolderTree(
    basePath: string = 'buza-projects'
): Promise<FolderTree> {
    return buildFolderTree(basePath);
}

/**
 * Load the contents of a specific folder within an existing tree.
 * Used for lazy loading when a folder is expanded.
 * 
 * @param tree - Existing folder tree
 * @param folderPath - Path to the folder to load
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Promise<FolderTree> - Updated folder tree with loaded folder contents
 */
export async function loadFolderInTree(
    tree: FolderTree,
    folderPath: string,
    basePath: string = 'buza-projects'
): Promise<FolderTree> {
    // Build the folder with its contents
    const folder = await buildFolder(folderPath, basePath);
    
    // Create a new folders map with the loaded folder
    const newFolders = new Map(tree.folders);
    newFolders.set(folderPath, folder);
    
    // Load any nested folders
    for (const child of folder.children) {
        if (child.type === 'folder' && !newFolders.has(child.path)) {
            const childFolder = await buildFolder(child.path, basePath);
            newFolders.set(child.path, childFolder);
        }
    }
    
    return {
        rootItems: tree.rootItems,
        folders: newFolders
    };
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Search for projects across all folders matching the given query.
 * Recursively searches all folders and returns matching projects with their folder paths.
 * 
 * @param query - Search query string to match against project names (case-insensitive)
 * @param basePath - Base path for projects (default: 'buza-projects')
 * @returns Promise<SearchResult[]> - Array of search results with project info and folder paths
 * 
 * **Validates: Requirements 7.1, 7.2**
 */
export async function searchProjects(
    query: string,
    basePath: string = 'buza-projects'
): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const normalizedQuery = query.toLowerCase().trim();
    
    // If query is empty, return empty results
    if (!normalizedQuery) {
        return results;
    }
    
    // Recursively search starting from root
    await searchInFolder(null, normalizedQuery, basePath, results);
    
    return results;
}

/**
 * Helper function to recursively search for projects in a folder
 * 
 * @param folderPath - Current folder path (null for root)
 * @param query - Normalized search query (lowercase)
 * @param basePath - Base path for projects
 * @param results - Array to accumulate results
 */
async function searchInFolder(
    folderPath: string | null,
    query: string,
    basePath: string,
    results: SearchResult[]
): Promise<void> {
    // Get contents of current folder
    const contents = await listFolderContents(folderPath, basePath);
    
    for (const item of contents) {
        if (item.type === 'project') {
            // Check if project name matches query
            const normalizedName = item.name.toLowerCase();
            if (normalizedName.includes(query)) {
                // Calculate the folder path (parent of the project)
                const projectFolderPath = folderPath ?? '';
                
                // Load project data
                const project = await loadProjectData(item.path, basePath);
                
                // Find the matched text (the portion of the name that matches)
                const matchIndex = normalizedName.indexOf(query);
                const matchedText = item.name.substring(matchIndex, matchIndex + query.length);
                
                results.push({
                    project,
                    folderPath: projectFolderPath,
                    matchedText
                });
            }
        } else if (item.type === 'folder') {
            // Recursively search in subfolder
            await searchInFolder(item.path, query, basePath, results);
        }
    }
}

/**
 * Load project data from the filesystem
 * 
 * @param projectPath - Relative path to the project
 * @param basePath - Base path for projects
 * @returns Project object with basic data
 */
async function loadProjectData(
    projectPath: string,
    basePath: string
): Promise<Project> {
    const fullPath = `${basePath}/${projectPath}`;
    const projectJsonPath = `${fullPath}/${PROJECT_JSON_FILE}`;
    
    // Get project name from path
    const name = projectPath.split('/').pop() || projectPath;
    
    // Try to read project.json for metadata
    let variables: Array<{ id: string; key: string; value: string }> = [];
    let description: string | undefined;
    let createdAt = Date.now();
    let updatedAt = Date.now();
    
    try {
        const projectJsonExists = await exists(projectJsonPath, { baseDir: BaseDirectory.Document });
        if (projectJsonExists) {
            const content = await readTextFile(projectJsonPath, { baseDir: BaseDirectory.Document });
            const data = JSON.parse(content);
            variables = data.variables || [];
            description = data.description;
            createdAt = data.createdAt || createdAt;
            updatedAt = data.updatedAt || updatedAt;
        }
    } catch (e) {
        // If we can't read project.json, use defaults
    }
    
    return {
        name,
        path: fullPath,
        variants: [], // Variants are loaded on-demand, not during search
        variables,
        description,
        createdAt,
        updatedAt
    };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a FolderTree to a plain object for persistence/testing
 */
export function serializeFolderTree(tree: FolderTree): {
    rootItems: FolderItem[];
    folders: Record<string, Folder>;
} {
    return {
        rootItems: tree.rootItems,
        folders: Object.fromEntries(tree.folders)
    };
}

/**
 * Deserialize a plain object back to a FolderTree
 */
export function deserializeFolderTree(data: {
    rootItems: FolderItem[];
    folders: Record<string, Folder>;
}): FolderTree {
    return {
        rootItems: data.rootItems,
        folders: new Map(Object.entries(data.folders))
    };
}
