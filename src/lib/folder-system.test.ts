/**
 * Property-based tests for Folder System
 * 
 * Uses fast-check for property-based testing to verify correctness properties.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the Tauri filesystem module at the top level
// This creates a shared mock filesystem that tests can manipulate
const mockFilesystem = new Set<string>();

// Track directory contents for readDir mock
const mockDirectoryContents = new Map<string, Array<{ name: string; isDirectory: boolean }>>();

vi.mock('@tauri-apps/plugin-fs', () => ({
    exists: vi.fn(async (path: string) => {
        return mockFilesystem.has(path);
    }),
    mkdir: vi.fn(async (path: string) => {
        mockFilesystem.add(path);
    }),
    writeTextFile: vi.fn(async (path: string) => {
        mockFilesystem.add(path);
    }),
    readDir: vi.fn(async (path: string) => {
        // Return contents registered for this path
        return mockDirectoryContents.get(path) || [];
    }),
    readTextFile: vi.fn(async () => ''),
    rename: vi.fn(async (oldPath: string, newPath: string) => {
        // Simulate rename by removing old path and adding new path
        // Also handle all nested paths
        const pathsToRename: string[] = [];
        for (const path of mockFilesystem) {
            if (path === oldPath || path.startsWith(oldPath + '/')) {
                pathsToRename.push(path);
            }
        }
        for (const path of pathsToRename) {
            mockFilesystem.delete(path);
            const newFullPath = path.replace(oldPath, newPath);
            mockFilesystem.add(newFullPath);
        }
    }),
    remove: vi.fn(async (path: string) => {
        // Simulate remove by deleting the path and all nested paths
        const pathsToRemove: string[] = [];
        for (const p of mockFilesystem) {
            if (p === path || p.startsWith(path + '/')) {
                pathsToRemove.push(p);
            }
        }
        for (const p of pathsToRemove) {
            mockFilesystem.delete(p);
        }
    }),
    BaseDirectory: { Document: 0 }
}));

// Import after mocking
import {
    Folder,
    FolderItem,
    FolderTree,
    serializeFolderTree,
    deserializeFolderTree,
    generateId,
    generateUniqueFolderName,
    createFolder,
    renameFolder,
    deleteFolder,
    moveProject,
    moveFolder,
    isValidMoveTarget,
    searchProjects,
    FOLDER_MARKER_FILE,
    PROJECT_JSON_FILE,
} from './folder-system';

// ============================================================================
// Arbitraries (Generators) for Property-Based Testing
// ============================================================================

/**
 * Generate a valid folder/project name
 * Names must be non-empty, not start with '.', and contain valid filesystem characters
 */
const folderNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/);

/**
 * Generate a FolderItem
 */
const folderItemArb: fc.Arbitrary<FolderItem> = fc.record({
    type: fc.constantFrom('folder', 'project') as fc.Arbitrary<'folder' | 'project'>,
    id: fc.uuid(),
    name: folderNameArb,
    path: folderNameArb,
});


/**
 * Generate a Folder with children
 */
const folderArb: fc.Arbitrary<Folder> = fc.record({
    id: fc.uuid(),
    name: folderNameArb,
    path: folderNameArb,
    parentPath: fc.option(folderNameArb, { nil: null }),
    children: fc.array(folderItemArb, { maxLength: 5 }),
    isExpanded: fc.boolean(),
});

/**
 * Generate a FolderTree
 */
const folderTreeArb: fc.Arbitrary<FolderTree> = fc.record({
    rootItems: fc.array(folderItemArb, { maxLength: 10 }),
    folders: fc.dictionary(folderNameArb, folderArb).map(dict => new Map(Object.entries(dict))),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Folder System - Property Tests', () => {
    // Clear mock filesystem before each test
    beforeEach(() => {
        mockFilesystem.clear();
        mockDirectoryContents.clear();
    });

    /**
     * **Feature: folder-organization, Property 2: Folder persistence round-trip**
     * **Validates: Requirements 1.3, 6.1, 6.3**
     * 
     * For any folder tree structure, serializing and then deserializing
     * SHALL produce an equivalent folder tree structure.
     */
    describe('Property 2: Folder persistence round-trip', () => {
        it('serializing then deserializing a FolderTree produces equivalent structure', () => {
            fc.assert(
                fc.property(folderTreeArb, (tree) => {
                    // Serialize the tree
                    const serialized = serializeFolderTree(tree);
                    
                    // Deserialize back
                    const deserialized = deserializeFolderTree(serialized);
                    
                    // Verify rootItems are equal
                    expect(deserialized.rootItems).toEqual(tree.rootItems);
                    
                    // Verify folders map has same keys
                    expect([...deserialized.folders.keys()].sort()).toEqual(
                        [...tree.folders.keys()].sort()
                    );
                    
                    // Verify each folder is equal
                    for (const [key, folder] of tree.folders) {
                        const deserializedFolder = deserialized.folders.get(key);
                        expect(deserializedFolder).toEqual(folder);
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('serialization produces valid JSON-compatible structure', () => {
            fc.assert(
                fc.property(folderTreeArb, (tree) => {
                    const serialized = serializeFolderTree(tree);
                    
                    // Should be JSON serializable
                    const jsonString = JSON.stringify(serialized);
                    const parsed = JSON.parse(jsonString);
                    
                    // Should be able to deserialize from parsed JSON
                    const deserialized = deserializeFolderTree(parsed);
                    
                    // Verify structure is preserved through JSON round-trip
                    expect(deserialized.rootItems).toEqual(tree.rootItems);
                    expect([...deserialized.folders.keys()].sort()).toEqual(
                        [...tree.folders.keys()].sort()
                    );
                }),
                { numRuns: 100 }
            );
        });

        it('empty folder tree round-trips correctly', () => {
            const emptyTree: FolderTree = {
                rootItems: [],
                folders: new Map(),
            };
            
            const serialized = serializeFolderTree(emptyTree);
            const deserialized = deserializeFolderTree(serialized);
            
            expect(deserialized.rootItems).toEqual([]);
            expect(deserialized.folders.size).toBe(0);
        });
    });

    /**
     * **Feature: folder-organization, Property 1: Folder creation uniqueness**
     * **Validates: Requirements 1.4**
     * 
     * For any parent folder and base name, creating a folder SHALL result in a unique 
     * folder name at that level. If a folder with the same name exists, a numeric 
     * suffix SHALL be appended.
     */
    describe('Property 1: Folder creation uniqueness', () => {
        it('creates unique folder names when collisions exist', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    fc.integer({ min: 0, max: 10 }),
                    async (baseName, existingCount) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        // Pre-populate filesystem with existing folders
                        const basePath = 'buza-projects';
                        mockFilesystem.add(`${basePath}/${baseName}`);
                        for (let i = 1; i < existingCount; i++) {
                            mockFilesystem.add(`${basePath}/${baseName}-${i}`);
                        }
                        
                        // Generate unique name
                        const uniqueName = await generateUniqueFolderName(null, baseName, basePath);
                        
                        // Verify the generated name is unique (not in filesystem)
                        const fullPath = `${basePath}/${uniqueName}`;
                        expect(mockFilesystem.has(fullPath)).toBe(false);
                        
                        // Verify the name follows the expected pattern
                        // Since baseName always exists, we expect a suffix
                        if (existingCount === 0) {
                            expect(uniqueName).toBe(`${baseName}-1`);
                        } else {
                            expect(uniqueName).toBe(`${baseName}-${existingCount}`);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('multiple folder creations at same level produce unique names', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    fc.integer({ min: 2, max: 5 }),
                    async (baseName, createCount) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        const basePath = 'buza-projects';
                        const createdNames: string[] = [];
                        
                        // Create multiple folders with the same base name
                        for (let i = 0; i < createCount; i++) {
                            const folder = await createFolder(null, baseName, basePath);
                            createdNames.push(folder.name);
                            // Simulate the folder being created in filesystem
                            mockFilesystem.add(`${basePath}/${folder.name}`);
                            mockFilesystem.add(`${basePath}/${folder.name}/.folder`);
                        }
                        
                        // Verify all names are unique
                        const uniqueNames = new Set(createdNames);
                        expect(uniqueNames.size).toBe(createCount);
                        
                        // Verify first folder gets the base name
                        expect(createdNames[0]).toBe(baseName);
                        
                        // Verify subsequent folders get numeric suffixes
                        for (let i = 1; i < createCount; i++) {
                            expect(createdNames[i]).toBe(`${baseName}-${i}`);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('folder creation returns valid Folder object', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.option(folderNameArb, { nil: null }),
                    folderNameArb,
                    async (parentPath, name) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // If parent path exists, create it first
                        if (parentPath) {
                            mockFilesystem.add(`${basePath}/${parentPath}`);
                            mockFilesystem.add(`${basePath}/${parentPath}/.folder`);
                        }
                        
                        const folder = await createFolder(parentPath, name, basePath);
                        
                        // Verify folder object structure
                        expect(folder.id).toBeDefined();
                        expect(folder.name).toBe(name);
                        expect(folder.parentPath).toBe(parentPath);
                        expect(folder.children).toEqual([]);
                        expect(folder.isExpanded).toBe(false);
                        
                        // Verify path is correctly constructed
                        const expectedPath = parentPath ? `${parentPath}/${name}` : name;
                        expect(folder.path).toBe(expectedPath);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 5: Folder rename persistence**
     * **Validates: Requirements 4.2**
     * 
     * For any folder, renaming it SHALL update the filesystem directory name 
     * and all child paths accordingly.
     */
    describe('Property 5: Folder rename persistence', () => {
        it('renaming a folder updates its path and name correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb.filter(name => name.length > 0),
                    async (originalName, newName) => {
                        // Skip if names are the same
                        if (originalName === newName) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create the original folder
                        const folder = await createFolder(null, originalName, basePath);
                        mockFilesystem.add(`${basePath}/${originalName}`);
                        mockFilesystem.add(`${basePath}/${originalName}/.folder`);
                        
                        // Rename the folder
                        const renamedFolder = await renameFolder(originalName, newName, basePath);
                        
                        // Verify the renamed folder has correct properties
                        expect(renamedFolder.name).toBe(newName);
                        expect(renamedFolder.path).toBe(newName);
                        expect(renamedFolder.parentPath).toBeNull();
                        
                        // Verify old path no longer exists in filesystem
                        expect(mockFilesystem.has(`${basePath}/${originalName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${originalName}/.folder`)).toBe(false);
                        
                        // Verify new path exists in filesystem
                        expect(mockFilesystem.has(`${basePath}/${newName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newName}/.folder`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('renaming a nested folder updates parent path correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    folderNameArb.filter(name => name.length > 0),
                    async (parentName, originalName, newName) => {
                        // Skip if names are the same
                        if (originalName === newName) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentName}`);
                        mockFilesystem.add(`${basePath}/${parentName}/.folder`);
                        
                        // Create nested folder
                        const nestedPath = `${parentName}/${originalName}`;
                        mockFilesystem.add(`${basePath}/${nestedPath}`);
                        mockFilesystem.add(`${basePath}/${nestedPath}/.folder`);
                        
                        // Rename the nested folder
                        const renamedFolder = await renameFolder(nestedPath, newName, basePath);
                        
                        // Verify the renamed folder has correct properties
                        expect(renamedFolder.name).toBe(newName);
                        expect(renamedFolder.path).toBe(`${parentName}/${newName}`);
                        expect(renamedFolder.parentPath).toBe(parentName);
                        
                        // Verify old path no longer exists
                        expect(mockFilesystem.has(`${basePath}/${nestedPath}`)).toBe(false);
                        
                        // Verify new path exists
                        expect(mockFilesystem.has(`${basePath}/${parentName}/${newName}`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('renaming preserves child folder paths', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb.filter(name => name.length > 0),
                    folderNameArb,
                    async (originalName, newName, childName) => {
                        // Skip if names are the same
                        if (originalName === newName) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create parent folder with a child
                        mockFilesystem.add(`${basePath}/${originalName}`);
                        mockFilesystem.add(`${basePath}/${originalName}/.folder`);
                        mockFilesystem.add(`${basePath}/${originalName}/${childName}`);
                        mockFilesystem.add(`${basePath}/${originalName}/${childName}/.folder`);
                        
                        // Rename the parent folder
                        await renameFolder(originalName, newName, basePath);
                        
                        // Verify child paths are updated
                        expect(mockFilesystem.has(`${basePath}/${originalName}/${childName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${newName}/${childName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newName}/${childName}/.folder`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 6: Empty folder deletion**
     * **Validates: Requirements 4.3**
     * 
     * For any empty folder, deleting it SHALL remove the folder from the filesystem 
     * and the folder tree.
     */
    describe('Property 6: Empty folder deletion', () => {
        it('deleting an empty folder removes it from filesystem', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    async (folderName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create an empty folder
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        
                        // Set up empty directory contents
                        mockDirectoryContents.set(`${basePath}/${folderName}`, []);
                        
                        // Delete the folder
                        const movedItems = await deleteFolder(folderName, basePath);
                        
                        // Verify folder is removed from filesystem
                        expect(mockFilesystem.has(`${basePath}/${folderName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${folderName}/.folder`)).toBe(false);
                        
                        // Verify no items were moved (folder was empty)
                        expect(movedItems).toEqual([]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('deleting a nested empty folder removes only that folder', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (parentName, childName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const childPath = `${parentName}/${childName}`;
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentName}`);
                        mockFilesystem.add(`${basePath}/${parentName}/.folder`);
                        
                        // Create nested empty folder
                        mockFilesystem.add(`${basePath}/${childPath}`);
                        mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                        
                        // Set up empty directory contents for child
                        mockDirectoryContents.set(`${basePath}/${childPath}`, []);
                        
                        // Delete the nested folder
                        const movedItems = await deleteFolder(childPath, basePath);
                        
                        // Verify nested folder is removed
                        expect(mockFilesystem.has(`${basePath}/${childPath}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${childPath}/.folder`)).toBe(false);
                        
                        // Verify parent folder still exists
                        expect(mockFilesystem.has(`${basePath}/${parentName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${parentName}/.folder`)).toBe(true);
                        
                        // Verify no items were moved
                        expect(movedItems).toEqual([]);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 7: Non-empty folder deletion preserves contents**
     * **Validates: Requirements 4.5**
     * 
     * For any folder containing projects, deleting the folder SHALL move all contained 
     * projects to the parent folder before removing the folder.
     */
    describe('Property 7: Non-empty folder deletion preserves contents', () => {
        it('deleting a folder with contents moves items to parent', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    fc.constantFrom('folder', 'project') as fc.Arbitrary<'folder' | 'project'>,
                    async (folderName, childName, childType) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const childPath = `${folderName}/${childName}`;
                        
                        // Create the folder
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        
                        // Create child item
                        mockFilesystem.add(`${basePath}/${childPath}`);
                        if (childType === 'folder') {
                            mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                        } else {
                            mockFilesystem.add(`${basePath}/${childPath}/project.json`);
                        }
                        
                        // Set up directory contents
                        mockDirectoryContents.set(`${basePath}/${folderName}`, [
                            { name: childName, isDirectory: true }
                        ]);
                        
                        // Delete the folder
                        const movedItems = await deleteFolder(folderName, basePath);
                        
                        // Verify folder is removed
                        expect(mockFilesystem.has(`${basePath}/${folderName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${folderName}/.folder`)).toBe(false);
                        
                        // Verify child was moved to root (parent of deleted folder)
                        expect(mockFilesystem.has(`${basePath}/${childName}`)).toBe(true);
                        
                        // Verify moved items list contains the child
                        expect(movedItems.length).toBe(1);
                        expect(movedItems[0].name).toBe(childName);
                        expect(movedItems[0].path).toBe(childName);
                        expect(movedItems[0].type).toBe(childType);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('deleting a nested folder moves contents to its parent folder', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    folderNameArb,
                    async (grandparentName, parentName, childName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const parentPath = `${grandparentName}/${parentName}`;
                        const childPath = `${parentPath}/${childName}`;
                        
                        // Create grandparent folder
                        mockFilesystem.add(`${basePath}/${grandparentName}`);
                        mockFilesystem.add(`${basePath}/${grandparentName}/.folder`);
                        
                        // Create parent folder (the one we'll delete)
                        mockFilesystem.add(`${basePath}/${parentPath}`);
                        mockFilesystem.add(`${basePath}/${parentPath}/.folder`);
                        
                        // Create child folder inside parent
                        mockFilesystem.add(`${basePath}/${childPath}`);
                        mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                        
                        // Set up directory contents
                        mockDirectoryContents.set(`${basePath}/${parentPath}`, [
                            { name: childName, isDirectory: true }
                        ]);
                        
                        // Delete the parent folder
                        const movedItems = await deleteFolder(parentPath, basePath);
                        
                        // Verify parent folder is removed
                        expect(mockFilesystem.has(`${basePath}/${parentPath}`)).toBe(false);
                        
                        // Verify grandparent still exists
                        expect(mockFilesystem.has(`${basePath}/${grandparentName}`)).toBe(true);
                        
                        // Verify child was moved to grandparent
                        const expectedNewChildPath = `${grandparentName}/${childName}`;
                        expect(mockFilesystem.has(`${basePath}/${expectedNewChildPath}`)).toBe(true);
                        
                        // Verify moved items list
                        expect(movedItems.length).toBe(1);
                        expect(movedItems[0].name).toBe(childName);
                        expect(movedItems[0].path).toBe(expectedNewChildPath);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('all contents are preserved when deleting folder with multiple items', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    fc.array(folderNameArb, { minLength: 1, maxLength: 5 }),
                    async (folderName, childNames) => {
                        // Ensure unique child names
                        const uniqueChildNames = [...new Set(childNames)];
                        if (uniqueChildNames.length === 0) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create the folder
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        
                        // Create all children as folders
                        const dirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        for (const childName of uniqueChildNames) {
                            const childPath = `${folderName}/${childName}`;
                            mockFilesystem.add(`${basePath}/${childPath}`);
                            mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                            dirContents.push({ name: childName, isDirectory: true });
                        }
                        
                        // Set up directory contents
                        mockDirectoryContents.set(`${basePath}/${folderName}`, dirContents);
                        
                        // Delete the folder
                        const movedItems = await deleteFolder(folderName, basePath);
                        
                        // Verify folder is removed
                        expect(mockFilesystem.has(`${basePath}/${folderName}`)).toBe(false);
                        
                        // Verify all children were moved to root
                        for (const childName of uniqueChildNames) {
                            expect(mockFilesystem.has(`${basePath}/${childName}`)).toBe(true);
                        }
                        
                        // Verify moved items count matches
                        expect(movedItems.length).toBe(uniqueChildNames.length);
                        
                        // Verify all moved items have correct paths
                        const movedNames = movedItems.map(item => item.name);
                        for (const childName of uniqueChildNames) {
                            expect(movedNames).toContain(childName);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 4: Folder contents listing completeness**
     * **Validates: Requirements 3.4**
     * 
     * For any folder containing subfolders and projects, listing the folder contents 
     * SHALL return all subfolders and all projects within that folder.
     */
    describe('Property 4: Folder contents listing completeness', () => {
        it('listing folder contents returns all subfolders and projects', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    fc.array(
                        fc.record({
                            name: folderNameArb,
                            type: fc.constantFrom('folder', 'project') as fc.Arbitrary<'folder' | 'project'>
                        }),
                        { minLength: 0, maxLength: 10 }
                    ),
                    async (parentFolderName, childItems) => {
                        // Ensure unique child names
                        const uniqueChildren = childItems.filter((item, index, self) => 
                            self.findIndex(i => i.name === item.name) === index
                        );
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentFolderName}`);
                        mockFilesystem.add(`${basePath}/${parentFolderName}/.folder`);
                        
                        // Create all children and set up directory contents
                        const dirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        for (const child of uniqueChildren) {
                            const childPath = `${parentFolderName}/${child.name}`;
                            mockFilesystem.add(`${basePath}/${childPath}`);
                            
                            if (child.type === 'folder') {
                                mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                            } else {
                                mockFilesystem.add(`${basePath}/${childPath}/project.json`);
                            }
                            
                            dirContents.push({ name: child.name, isDirectory: true });
                        }
                        
                        mockDirectoryContents.set(`${basePath}/${parentFolderName}`, dirContents);
                        
                        // Import and call listFolderContents
                        const { listFolderContents } = await import('./folder-system');
                        const contents = await listFolderContents(parentFolderName, basePath);
                        
                        // Verify all children are returned
                        expect(contents.length).toBe(uniqueChildren.length);
                        
                        // Verify each child is present with correct type
                        for (const child of uniqueChildren) {
                            const found = contents.find(item => item.name === child.name);
                            expect(found).toBeDefined();
                            expect(found?.type).toBe(child.type);
                            expect(found?.path).toBe(`${parentFolderName}/${child.name}`);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('listing folder contents returns items sorted correctly (folders first, then alphabetically)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    fc.array(
                        fc.record({
                            name: folderNameArb,
                            type: fc.constantFrom('folder', 'project') as fc.Arbitrary<'folder' | 'project'>
                        }),
                        { minLength: 2, maxLength: 10 }
                    ),
                    async (parentFolderName, childItems) => {
                        // Ensure unique child names
                        const uniqueChildren = childItems.filter((item, index, self) => 
                            self.findIndex(i => i.name === item.name) === index
                        );
                        
                        if (uniqueChildren.length < 2) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentFolderName}`);
                        mockFilesystem.add(`${basePath}/${parentFolderName}/.folder`);
                        
                        // Create all children
                        const dirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        for (const child of uniqueChildren) {
                            const childPath = `${parentFolderName}/${child.name}`;
                            mockFilesystem.add(`${basePath}/${childPath}`);
                            
                            if (child.type === 'folder') {
                                mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                            } else {
                                mockFilesystem.add(`${basePath}/${childPath}/project.json`);
                            }
                            
                            dirContents.push({ name: child.name, isDirectory: true });
                        }
                        
                        mockDirectoryContents.set(`${basePath}/${parentFolderName}`, dirContents);
                        
                        // Get contents
                        const { listFolderContents } = await import('./folder-system');
                        const contents = await listFolderContents(parentFolderName, basePath);
                        
                        // Verify sorting: folders first, then projects
                        let seenProject = false;
                        for (const item of contents) {
                            if (item.type === 'project') {
                                seenProject = true;
                            } else if (item.type === 'folder' && seenProject) {
                                // Found a folder after a project - sorting is wrong
                                expect(true).toBe(false); // Fail the test
                            }
                        }
                        
                        // Verify alphabetical sorting within each type
                        const folders = contents.filter(i => i.type === 'folder');
                        const projects = contents.filter(i => i.type === 'project');
                        
                        for (let i = 1; i < folders.length; i++) {
                            expect(folders[i].name.localeCompare(folders[i-1].name)).toBeGreaterThanOrEqual(0);
                        }
                        
                        for (let i = 1; i < projects.length; i++) {
                            expect(projects[i].name.localeCompare(projects[i-1].name)).toBeGreaterThanOrEqual(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('listing empty folder returns empty array', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    async (folderName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create empty folder
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        mockDirectoryContents.set(`${basePath}/${folderName}`, []);
                        
                        // Get contents
                        const { listFolderContents } = await import('./folder-system');
                        const contents = await listFolderContents(folderName, basePath);
                        
                        // Verify empty array
                        expect(contents).toEqual([]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('listing root folder (null path) returns all root items', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            name: folderNameArb,
                            type: fc.constantFrom('folder', 'project') as fc.Arbitrary<'folder' | 'project'>
                        }),
                        { minLength: 0, maxLength: 10 }
                    ),
                    async (rootItems) => {
                        // Ensure unique names
                        const uniqueItems = rootItems.filter((item, index, self) => 
                            self.findIndex(i => i.name === item.name) === index
                        );
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create all root items
                        const dirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        for (const item of uniqueItems) {
                            mockFilesystem.add(`${basePath}/${item.name}`);
                            
                            if (item.type === 'folder') {
                                mockFilesystem.add(`${basePath}/${item.name}/.folder`);
                            } else {
                                mockFilesystem.add(`${basePath}/${item.name}/project.json`);
                            }
                            
                            dirContents.push({ name: item.name, isDirectory: true });
                        }
                        
                        mockDirectoryContents.set(basePath, dirContents);
                        
                        // Get contents with null path (root)
                        const { listFolderContents } = await import('./folder-system');
                        const contents = await listFolderContents(null, basePath);
                        
                        // Verify all items are returned
                        expect(contents.length).toBe(uniqueItems.length);
                        
                        for (const item of uniqueItems) {
                            const found = contents.find(c => c.name === item.name);
                            expect(found).toBeDefined();
                            expect(found?.type).toBe(item.type);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});

    /**
     * **Feature: folder-organization, Property 3: Project move preserves data integrity**
     * **Validates: Requirements 2.3, 2.4**
     * 
     * For any project with variants, variables, and versions, moving the project 
     * to any valid folder SHALL preserve all project data unchanged.
     */
    describe('Property 3: Project move preserves data integrity', () => {
        it('moving a project preserves all project files', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (projectName, targetFolderName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create a project with project.json
                        mockFilesystem.add(`${basePath}/${projectName}`);
                        mockFilesystem.add(`${basePath}/${projectName}/project.json`);
                        mockFilesystem.add(`${basePath}/${projectName}/Main.md`);
                        mockFilesystem.add(`${basePath}/${projectName}/Variant1.md`);
                        
                        // Create target folder
                        mockFilesystem.add(`${basePath}/${targetFolderName}`);
                        mockFilesystem.add(`${basePath}/${targetFolderName}/.folder`);
                        
                        // Import and call moveProject
                        const { moveProject } = await import('./folder-system');
                        const newPath = await moveProject(projectName, targetFolderName, basePath);
                        
                        // Verify new path is correct
                        expect(newPath).toBe(`${targetFolderName}/${projectName}`);
                        
                        // Verify old location no longer exists
                        expect(mockFilesystem.has(`${basePath}/${projectName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${projectName}/project.json`)).toBe(false);
                        
                        // Verify all files are at new location
                        expect(mockFilesystem.has(`${basePath}/${newPath}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/project.json`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/Main.md`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/Variant1.md`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('moving a project to root preserves all project files', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (folderName, projectName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const projectPath = `${folderName}/${projectName}`;
                        
                        // Create folder containing the project
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        
                        // Create project inside folder
                        mockFilesystem.add(`${basePath}/${projectPath}`);
                        mockFilesystem.add(`${basePath}/${projectPath}/project.json`);
                        mockFilesystem.add(`${basePath}/${projectPath}/Main.md`);
                        
                        // Import and call moveProject to root (null)
                        const { moveProject } = await import('./folder-system');
                        const newPath = await moveProject(projectPath, null, basePath);
                        
                        // Verify new path is at root
                        expect(newPath).toBe(projectName);
                        
                        // Verify old location no longer exists
                        expect(mockFilesystem.has(`${basePath}/${projectPath}`)).toBe(false);
                        
                        // Verify all files are at new location
                        expect(mockFilesystem.has(`${basePath}/${projectName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${projectName}/project.json`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${projectName}/Main.md`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('moving project to same location returns same path', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    async (projectName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create a project at root
                        mockFilesystem.add(`${basePath}/${projectName}`);
                        mockFilesystem.add(`${basePath}/${projectName}/project.json`);
                        
                        // Import and call moveProject to root (same location)
                        const { moveProject } = await import('./folder-system');
                        const newPath = await moveProject(projectName, null, basePath);
                        
                        // Verify path unchanged
                        expect(newPath).toBe(projectName);
                        
                        // Verify project still exists
                        expect(mockFilesystem.has(`${basePath}/${projectName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${projectName}/project.json`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 8: Folder nesting updates hierarchy**
     * **Validates: Requirements 5.1**
     * 
     * For any two folders where neither is an ancestor of the other, nesting one 
     * inside the other SHALL update the folder hierarchy correctly.
     */
    describe('Property 8: Folder nesting updates hierarchy', () => {
        it('moving a folder into another folder updates paths correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (sourceFolderName, targetFolderName) => {
                        // Skip if names are the same (would cause collision)
                        if (sourceFolderName === targetFolderName) return;
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create source folder with contents
                        mockFilesystem.add(`${basePath}/${sourceFolderName}`);
                        mockFilesystem.add(`${basePath}/${sourceFolderName}/.folder`);
                        mockFilesystem.add(`${basePath}/${sourceFolderName}/child`);
                        mockFilesystem.add(`${basePath}/${sourceFolderName}/child/.folder`);
                        
                        // Create target folder
                        mockFilesystem.add(`${basePath}/${targetFolderName}`);
                        mockFilesystem.add(`${basePath}/${targetFolderName}/.folder`);
                        
                        // Move source folder into target folder
                        const newPath = await moveFolder(sourceFolderName, targetFolderName, basePath);
                        
                        // Verify new path is correct
                        expect(newPath).toBe(`${targetFolderName}/${sourceFolderName}`);
                        
                        // Verify old location no longer exists
                        expect(mockFilesystem.has(`${basePath}/${sourceFolderName}`)).toBe(false);
                        expect(mockFilesystem.has(`${basePath}/${sourceFolderName}/.folder`)).toBe(false);
                        
                        // Verify folder and contents are at new location
                        expect(mockFilesystem.has(`${basePath}/${newPath}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/.folder`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/child`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${newPath}/child/.folder`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('moving a folder to root updates paths correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (parentFolderName, childFolderName) => {
                        // Skip if names are the same - can't move to root if parent has same name
                        // This is expected behavior: you can't have two items with the same name at root
                        if (parentFolderName === childFolderName) {
                            return;
                        }
                        
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const childPath = `${parentFolderName}/${childFolderName}`;
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentFolderName}`);
                        mockFilesystem.add(`${basePath}/${parentFolderName}/.folder`);
                        
                        // Create child folder inside parent
                        mockFilesystem.add(`${basePath}/${childPath}`);
                        mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                        
                        // Move child folder to root
                        const newPath = await moveFolder(childPath, null, basePath);
                        
                        // Verify new path is at root
                        expect(newPath).toBe(childFolderName);
                        
                        // Verify old location no longer exists
                        expect(mockFilesystem.has(`${basePath}/${childPath}`)).toBe(false);
                        
                        // Verify folder is at new location
                        expect(mockFilesystem.has(`${basePath}/${childFolderName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${childFolderName}/.folder`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('moving folder to same location returns same path', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    async (folderName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create a folder at root
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        
                        // Move folder to root (same location)
                        const newPath = await moveFolder(folderName, null, basePath);
                        
                        // Verify path unchanged
                        expect(newPath).toBe(folderName);
                        
                        // Verify folder still exists
                        expect(mockFilesystem.has(`${basePath}/${folderName}`)).toBe(true);
                        expect(mockFilesystem.has(`${basePath}/${folderName}/.folder`)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 9: Circular nesting prevention**
     * **Validates: Requirements 5.4**
     * 
     * For any folder and any of its descendants, attempting to move the folder 
     * into that descendant SHALL be rejected.
     */
    describe('Property 9: Circular nesting prevention', () => {
        it('isValidMoveTarget returns false for moving folder into itself', () => {
            fc.assert(
                fc.property(
                    folderNameArb,
                    (folderName) => {
                        const result = isValidMoveTarget(folderName, folderName);
                        expect(result).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('isValidMoveTarget returns false for moving folder into its descendant', () => {
            fc.assert(
                fc.property(
                    folderNameArb,
                    fc.array(folderNameArb, { minLength: 1, maxLength: 5 }),
                    (rootFolder, pathSegments) => {
                        // Build a descendant path
                        const descendantPath = [rootFolder, ...pathSegments].join('/');
                        
                        const result = isValidMoveTarget(rootFolder, descendantPath);
                        expect(result).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('isValidMoveTarget returns true for moving folder to root', () => {
            fc.assert(
                fc.property(
                    folderNameArb,
                    (folderName) => {
                        const result = isValidMoveTarget(folderName, null);
                        expect(result).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('isValidMoveTarget returns true for moving folder to unrelated folder', () => {
            fc.assert(
                fc.property(
                    folderNameArb,
                    folderNameArb,
                    (sourceFolder, targetFolder) => {
                        // Skip if same folder
                        if (sourceFolder === targetFolder) return;
                        
                        // Neither is ancestor of the other
                        const result = isValidMoveTarget(sourceFolder, targetFolder);
                        expect(result).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('moveFolder throws error when attempting circular move', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    async (parentName, childName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const childPath = `${parentName}/${childName}`;
                        
                        // Create parent folder
                        mockFilesystem.add(`${basePath}/${parentName}`);
                        mockFilesystem.add(`${basePath}/${parentName}/.folder`);
                        
                        // Create child folder inside parent
                        mockFilesystem.add(`${basePath}/${childPath}`);
                        mockFilesystem.add(`${basePath}/${childPath}/.folder`);
                        
                        // Attempt to move parent into child (circular)
                        await expect(
                            moveFolder(parentName, childPath, basePath)
                        ).rejects.toThrow('Cannot move a folder into itself or one of its subfolders');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: folder-organization, Property 10: Cross-folder search with paths**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * For any search query and folder structure, search SHALL return all matching 
     * projects from all folders with their correct folder paths.
     */
    describe('Property 10: Cross-folder search with paths', () => {
        it('search returns all matching projects across all folders', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate a search query (substring to search for)
                    fc.stringMatching(/^[a-zA-Z]{2,5}$/),
                    // Generate project names, some containing the query
                    fc.array(
                        fc.record({
                            name: folderNameArb,
                            containsQuery: fc.boolean()
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    // Generate folder structure
                    fc.array(folderNameArb, { minLength: 0, maxLength: 3 }),
                    async (query, projectSpecs, folderNames) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const uniqueFolders = [...new Set(folderNames)];
                        
                        // Create folders
                        for (const folderName of uniqueFolders) {
                            mockFilesystem.add(`${basePath}/${folderName}`);
                            mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        }
                        
                        // Create projects with names that may or may not contain the query
                        const expectedMatches: Array<{ name: string; folderPath: string }> = [];
                        const rootDirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        const folderDirContents = new Map<string, Array<{ name: string; isDirectory: boolean }>>();
                        
                        // Initialize folder contents
                        for (const folderName of uniqueFolders) {
                            folderDirContents.set(`${basePath}/${folderName}`, []);
                            rootDirContents.push({ name: folderName, isDirectory: true });
                        }
                        
                        // Create projects
                        const usedNames = new Set<string>();
                        for (const spec of projectSpecs) {
                            // Generate project name based on whether it should contain query
                            let projectName = spec.containsQuery 
                                ? `${spec.name}${query}Project` 
                                : spec.name;
                            
                            // Ensure unique name
                            let uniqueName = projectName;
                            let counter = 1;
                            while (usedNames.has(uniqueName)) {
                                uniqueName = `${projectName}${counter}`;
                                counter++;
                            }
                            usedNames.add(uniqueName);
                            projectName = uniqueName;
                            
                            // Randomly place in root or a folder
                            const folderIndex = uniqueFolders.length > 0 
                                ? Math.floor(Math.random() * (uniqueFolders.length + 1)) - 1
                                : -1;
                            
                            const folderPath = folderIndex >= 0 ? uniqueFolders[folderIndex] : '';
                            const projectPath = folderPath ? `${folderPath}/${projectName}` : projectName;
                            
                            // Create project in filesystem
                            mockFilesystem.add(`${basePath}/${projectPath}`);
                            mockFilesystem.add(`${basePath}/${projectPath}/project.json`);
                            
                            // Add to directory contents
                            if (folderPath) {
                                const contents = folderDirContents.get(`${basePath}/${folderPath}`) || [];
                                contents.push({ name: projectName, isDirectory: true });
                                folderDirContents.set(`${basePath}/${folderPath}`, contents);
                            } else {
                                rootDirContents.push({ name: projectName, isDirectory: true });
                            }
                            
                            // Track expected matches
                            if (projectName.toLowerCase().includes(query.toLowerCase())) {
                                expectedMatches.push({ name: projectName, folderPath });
                            }
                        }
                        
                        // Set up mock directory contents
                        mockDirectoryContents.set(basePath, rootDirContents);
                        for (const [path, contents] of folderDirContents) {
                            mockDirectoryContents.set(path, contents);
                        }
                        
                        // Import and call searchProjects
                        const { searchProjects } = await import('./folder-system');
                        const results = await searchProjects(query, basePath);
                        
                        // Verify all expected matches are found
                        expect(results.length).toBe(expectedMatches.length);
                        
                        // Verify each expected match is in results with correct folder path
                        for (const expected of expectedMatches) {
                            const found = results.find(r => r.project.name === expected.name);
                            expect(found).toBeDefined();
                            expect(found?.folderPath).toBe(expected.folderPath);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('search returns empty array for empty query', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(folderNameArb, { minLength: 1, maxLength: 5 }),
                    async (projectNames) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const uniqueNames = [...new Set(projectNames)];
                        
                        // Create projects
                        const dirContents: Array<{ name: string; isDirectory: boolean }> = [];
                        for (const name of uniqueNames) {
                            mockFilesystem.add(`${basePath}/${name}`);
                            mockFilesystem.add(`${basePath}/${name}/project.json`);
                            dirContents.push({ name, isDirectory: true });
                        }
                        mockDirectoryContents.set(basePath, dirContents);
                        
                        // Search with empty query
                        const { searchProjects } = await import('./folder-system');
                        const results = await searchProjects('', basePath);
                        
                        // Should return empty array
                        expect(results).toEqual([]);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('search is case-insensitive', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    async (projectName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        
                        // Create a project
                        mockFilesystem.add(`${basePath}/${projectName}`);
                        mockFilesystem.add(`${basePath}/${projectName}/project.json`);
                        mockDirectoryContents.set(basePath, [
                            { name: projectName, isDirectory: true }
                        ]);
                        
                        // Search with uppercase query
                        const { searchProjects } = await import('./folder-system');
                        const upperResults = await searchProjects(projectName.toUpperCase(), basePath);
                        
                        // Search with lowercase query
                        const lowerResults = await searchProjects(projectName.toLowerCase(), basePath);
                        
                        // Both should find the project
                        expect(upperResults.length).toBe(1);
                        expect(lowerResults.length).toBe(1);
                        expect(upperResults[0].project.name).toBe(projectName);
                        expect(lowerResults[0].project.name).toBe(projectName);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('search returns correct folder paths for nested projects', async () => {
            await fc.assert(
                fc.asyncProperty(
                    folderNameArb,
                    folderNameArb,
                    folderNameArb,
                    async (folderName, nestedFolderName, projectName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const nestedPath = `${folderName}/${nestedFolderName}`;
                        const projectPath = `${nestedPath}/${projectName}`;
                        
                        // Create folder structure
                        mockFilesystem.add(`${basePath}/${folderName}`);
                        mockFilesystem.add(`${basePath}/${folderName}/.folder`);
                        mockFilesystem.add(`${basePath}/${nestedPath}`);
                        mockFilesystem.add(`${basePath}/${nestedPath}/.folder`);
                        
                        // Create project in nested folder
                        mockFilesystem.add(`${basePath}/${projectPath}`);
                        mockFilesystem.add(`${basePath}/${projectPath}/project.json`);
                        
                        // Set up directory contents
                        mockDirectoryContents.set(basePath, [
                            { name: folderName, isDirectory: true }
                        ]);
                        mockDirectoryContents.set(`${basePath}/${folderName}`, [
                            { name: nestedFolderName, isDirectory: true }
                        ]);
                        mockDirectoryContents.set(`${basePath}/${nestedPath}`, [
                            { name: projectName, isDirectory: true }
                        ]);
                        
                        // Search for the project
                        const { searchProjects } = await import('./folder-system');
                        const results = await searchProjects(projectName, basePath);
                        
                        // Should find the project with correct nested folder path
                        expect(results.length).toBe(1);
                        expect(results[0].project.name).toBe(projectName);
                        expect(results[0].folderPath).toBe(nestedPath);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('search returns matchedText containing the query', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.stringMatching(/^[a-zA-Z]{2,4}$/),
                    folderNameArb,
                    async (query, baseName) => {
                        // Reset mock filesystem
                        mockFilesystem.clear();
                        mockDirectoryContents.clear();
                        
                        const basePath = 'buza-projects';
                        const projectName = `${baseName}${query}Suffix`;
                        
                        // Create project
                        mockFilesystem.add(`${basePath}/${projectName}`);
                        mockFilesystem.add(`${basePath}/${projectName}/project.json`);
                        mockDirectoryContents.set(basePath, [
                            { name: projectName, isDirectory: true }
                        ]);
                        
                        // Search
                        const { searchProjects } = await import('./folder-system');
                        const results = await searchProjects(query, basePath);
                        
                        // Should find the project
                        expect(results.length).toBe(1);
                        
                        // matchedText should be the actual matched portion from the project name
                        expect(results[0].matchedText.toLowerCase()).toBe(query.toLowerCase());
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

// ============================================================================
// Unit Tests for Core Functions
// ============================================================================

describe('Folder System - Unit Tests', () => {
    describe('generateId', () => {
        it('generates unique IDs', () => {
            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(generateId());
            }
            expect(ids.size).toBe(100);
        });

        it('generates valid UUID format', () => {
            const id = generateId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(id).toMatch(uuidRegex);
        });
    });

    describe('Constants', () => {
        it('FOLDER_MARKER_FILE is .folder', () => {
            expect(FOLDER_MARKER_FILE).toBe('.folder');
        });

        it('PROJECT_JSON_FILE is project.json', () => {
            expect(PROJECT_JSON_FILE).toBe('project.json');
        });
    });

    describe('serializeFolderTree', () => {
        it('converts Map to plain object', () => {
            const tree: FolderTree = {
                rootItems: [{ type: 'folder', id: '1', name: 'test', path: 'test' }],
                folders: new Map([
                    ['test', {
                        id: '1',
                        name: 'test',
                        path: 'test',
                        parentPath: null,
                        children: [],
                        isExpanded: false,
                    }],
                ]),
            };

            const serialized = serializeFolderTree(tree);
            
            expect(serialized.rootItems).toEqual(tree.rootItems);
            expect(serialized.folders).toEqual({
                test: tree.folders.get('test'),
            });
        });
    });

    describe('deserializeFolderTree', () => {
        it('converts plain object to Map', () => {
            const data = {
                rootItems: [{ type: 'folder' as const, id: '1', name: 'test', path: 'test' }],
                folders: {
                    test: {
                        id: '1',
                        name: 'test',
                        path: 'test',
                        parentPath: null,
                        children: [],
                        isExpanded: false,
                    },
                },
            };

            const tree = deserializeFolderTree(data);
            
            expect(tree.rootItems).toEqual(data.rootItems);
            expect(tree.folders instanceof Map).toBe(true);
            expect(tree.folders.get('test')).toEqual(data.folders.test);
        });
    });
});
