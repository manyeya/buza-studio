# Requirements Document

## Introduction

This feature adds folder organization capabilities to Buza Studio, allowing users to organize their prompt projects into hierarchical folders/categories. Currently, all projects appear in a flat list in the sidebar, which becomes unwieldy as the number of projects grows. This feature enables users to create folders, move projects between folders, and navigate a tree structure for better project management.

## Glossary

- **Folder**: A container that groups related projects together. Folders can be nested within other folders.
- **Project**: An existing Buza Studio prompt project containing variants and variables.
- **Root Level**: The top-level of the folder hierarchy where ungrouped projects and top-level folders reside.
- **Folder Tree**: The hierarchical structure of folders displayed in the sidebar.
- **Breadcrumb**: A navigation element showing the current folder path.

## Requirements

### Requirement 1

**User Story:** As a prompt engineer, I want to create folders to organize my projects, so that I can group related prompts together and find them easily.

#### Acceptance Criteria

1. WHEN a user clicks the "New Folder" button in the sidebar THEN the Folder_System SHALL create a new folder with a default name and display it in the folder tree
2. WHEN a user creates a folder THEN the Folder_System SHALL allow the user to immediately rename the folder inline
3. WHEN a folder is created THEN the Folder_System SHALL persist the folder to the filesystem in the buza-projects directory
4. IF a user attempts to create a folder with a name that already exists at the same level THEN the Folder_System SHALL append a numeric suffix to ensure uniqueness

### Requirement 2

**User Story:** As a prompt engineer, I want to move projects into folders, so that I can organize my existing prompts without recreating them.

#### Acceptance Criteria

1. WHEN a user drags a project onto a folder THEN the Folder_System SHALL move the project into that folder
2. WHEN a user right-clicks a project and selects "Move to Folder" THEN the Folder_System SHALL display a folder picker dialog
3. WHEN a project is moved to a folder THEN the Folder_System SHALL update the filesystem structure to reflect the new location
4. WHEN a project is moved THEN the Folder_System SHALL preserve all project data including variants, variables, and versions

### Requirement 3

**User Story:** As a prompt engineer, I want to navigate through my folder structure, so that I can access projects in different folders.

#### Acceptance Criteria

1. WHEN a user clicks on a folder THEN the Sidebar SHALL expand or collapse the folder to show or hide its contents
2. WHEN a user is viewing a nested folder THEN the Sidebar SHALL display a breadcrumb trail showing the folder path
3. WHEN a user clicks a breadcrumb segment THEN the Sidebar SHALL navigate to that folder level
4. WHILE viewing folder contents THEN the Folder_System SHALL display both subfolders and projects within that folder

### Requirement 4

**User Story:** As a prompt engineer, I want to rename and delete folders, so that I can maintain an organized folder structure over time.

#### Acceptance Criteria

1. WHEN a user double-clicks a folder name THEN the Folder_System SHALL enable inline editing of the folder name
2. WHEN a user renames a folder THEN the Folder_System SHALL update the filesystem directory name
3. WHEN a user deletes an empty folder THEN the Folder_System SHALL remove the folder from the filesystem
4. IF a user attempts to delete a folder containing projects THEN the Folder_System SHALL display a confirmation dialog warning about the contents
5. WHEN a folder with contents is deleted after confirmation THEN the Folder_System SHALL move contained projects to the parent folder before deletion

### Requirement 5

**User Story:** As a prompt engineer, I want to nest folders within folders, so that I can create a deep organizational hierarchy for complex prompt libraries.

#### Acceptance Criteria

1. WHEN a user drags a folder onto another folder THEN the Folder_System SHALL nest the dragged folder inside the target folder
2. WHEN folders are nested THEN the Folder_System SHALL support a nesting depth of at least 5 levels
3. WHEN displaying nested folders THEN the Sidebar SHALL visually indent child folders to indicate hierarchy
4. IF a user attempts to move a folder into one of its own descendants THEN the Folder_System SHALL prevent the operation and display an error message

### Requirement 6

**User Story:** As a prompt engineer, I want my folder structure to persist across sessions, so that my organization is maintained when I restart the application.

#### Acceptance Criteria

1. WHEN the application starts THEN the Folder_System SHALL read the folder structure from the filesystem
2. WHEN folders or projects are moved THEN the Folder_System SHALL immediately persist changes to the filesystem
3. WHEN reading the folder structure THEN the Folder_System SHALL reconstruct the hierarchy based on the filesystem directory structure
4. IF the filesystem structure is modified externally THEN the Folder_System SHALL reflect those changes on the next application start

### Requirement 7

**User Story:** As a prompt engineer, I want to search for projects across all folders, so that I can find prompts without navigating through the folder structure.

#### Acceptance Criteria

1. WHEN a user types in the search box THEN the Folder_System SHALL search across all folders and display matching projects
2. WHEN displaying search results THEN the Folder_System SHALL show the folder path for each matching project
3. WHEN a user selects a search result THEN the Folder_System SHALL navigate to that project and expand its parent folders
4. WHEN search results are displayed THEN the Folder_System SHALL highlight the matching text in project names
