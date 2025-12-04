# Implementation Plan

- [x] 1. Set up folder system core infrastructure
  - [x] 1.1 Create folder-system.ts with Folder and FolderItem interfaces
    - Define TypeScript interfaces for Folder, FolderItem, FolderTree, SearchResult
    - Export types for use across components
    - _Requirements: 1.1, 3.4, 6.1_
  - [x] 1.2 Implement folder detection and marker file logic
    - Add method to check if directory is a folder (has .folder marker) vs project (has project.json)
    - Add method to create .folder marker file when creating folders
    - _Requirements: 1.3, 6.3_
  - [x] 1.3 Write property test for folder persistence round-trip
    - **Property 2: Folder persistence round-trip**
    - **Validates: Requirements 1.3, 6.1, 6.3**

- [x] 2. Implement folder CRUD operations
  - [x] 2.1 Implement createFolder method
    - Create directory with .folder marker
    - Handle name collision with numeric suffix generation
    - Return created Folder object
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 2.2 Write property test for folder creation uniqueness
    - **Property 1: Folder creation uniqueness**
    - **Validates: Requirements 1.4**
  - [x] 2.3 Implement renameFolder method
    - Rename filesystem directory
    - Update all child paths accordingly
    - _Requirements: 4.2_
  - [x] 2.4 Write property test for folder rename persistence
    - **Property 5: Folder rename persistence**
    - **Validates: Requirements 4.2**
  - [x] 2.5 Implement deleteFolder method
    - Handle empty folder deletion
    - Handle non-empty folder deletion (move contents to parent)
    - _Requirements: 4.3, 4.5_
  - [x] 2.6 Write property tests for folder deletion
    - **Property 6: Empty folder deletion**
    - **Property 7: Non-empty folder deletion preserves contents**
    - **Validates: Requirements 4.3, 4.5**

- [x] 3. Implement folder navigation and listing
  - [x] 3.1 Implement listFolderContents method
    - Read directory contents
    - Classify each item as folder or project
    - Return sorted list of FolderItems
    - _Requirements: 3.4, 6.1_
  - [x] 3.2 Write property test for folder contents listing
    - **Property 4: Folder contents listing completeness**
    - **Validates: Requirements 3.4**
  - [x] 3.3 Implement getFolderTree method
    - Build complete folder tree from filesystem
    - Support lazy loading of nested folders
    - _Requirements: 6.1, 6.3_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement move operations
  - [x] 5.1 Implement moveProject method
    - Move project directory to target folder
    - Preserve all project data (variants, variables, versions)
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 5.2 Write property test for project move data integrity
    - **Property 3: Project move preserves data integrity**
    - **Validates: Requirements 2.3, 2.4**
  - [x] 5.3 Implement moveFolder method
    - Move folder directory to target folder
    - Update all nested paths
    - _Requirements: 5.1_
  - [x] 5.4 Implement isValidMoveTarget validation
    - Detect circular references (folder into its own descendant)
    - Prevent invalid moves
    - _Requirements: 5.4_
  - [x] 5.5 Write property tests for folder move operations
    - **Property 8: Folder nesting updates hierarchy**
    - **Property 9: Circular nesting prevention**
    - **Validates: Requirements 5.1, 5.4**

- [x] 6. Implement search functionality
  - [x] 6.1 Implement searchProjects method
    - Recursively search all folders for matching projects
    - Return results with folder paths
    - _Requirements: 7.1, 7.2_
  - [x] 6.2 Write property test for cross-folder search
    - **Property 10: Cross-folder search with paths**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create Jotai atoms for folder state
  - [x] 8.1 Create folder-atoms.ts with folder state atoms
    - folderTreeAtom for folder structure
    - expandedFoldersAtom for UI expand/collapse state
    - currentFolderPathAtom for navigation
    - breadcrumbPathAtom derived atom
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 9. Create FolderTree UI component
  - [x] 9.1 Create FolderTree component with recursive rendering
    - Render folders and projects with proper indentation
    - Handle expand/collapse toggle
    - Support item selection
    - _Requirements: 3.1, 3.4, 5.3_
  - [x] 9.2 Add drag-and-drop support to FolderTree
    - Implement drag source for folders and projects
    - Implement drop target for folders
    - Visual feedback during drag operations
    - _Requirements: 2.1, 5.1_
  - [x] 9.3 Add context menu for folder operations
    - Right-click menu with Rename, Delete, Move to Folder options
    - Folder picker modal for Move to Folder
    - _Requirements: 2.2, 4.1, 4.4_

- [x] 10. Create Breadcrumb component
  - [x] 10.1 Implement Breadcrumb component
    - Display folder path segments
    - Clickable segments for navigation
    - _Requirements: 3.2, 3.3_

- [x] 11. Integrate folder system into Sidebar
  - [x] 11.1 Update Sidebar to use FolderTree component
    - Replace flat project list with FolderTree
    - Add "New Folder" button
    - Integrate breadcrumb navigation
    - _Requirements: 1.1, 3.1, 3.2_
  - [x] 11.2 Update search to work across folders
    - Modify existing search to use searchProjects method
    - Display folder path in search results
    - Navigate to project on result selection
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 12. Create React Query hooks for folder operations
  - [x] 12.1 Create useFolders hook
    - Query for folder tree
    - Mutations for create, rename, delete, move operations
    - Optimistic updates for responsive UI
    - _Requirements: 1.1, 2.1, 4.2, 4.3, 5.1_

- [x] 13. Update existing project hooks for folder awareness
  - [x] 13.1 Update useProjects to support folder paths
    - Modify project queries to include folder context
    - Update project mutations to handle folder paths
    - _Requirements: 2.3, 2.4, 6.2_

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
