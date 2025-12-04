/**
 * React Query hooks for project operations with folder awareness
 * 
 * Provides queries and mutations for project CRUD operations that support
 * hierarchical folder organization.
 * 
 * _Requirements: 2.3, 2.4, 6.2_
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { projectSystem } from '../lib/project-system';
import { convertProjectToPromptData } from '../lib/convert';
import { activePromptIdAtom } from '../atoms';
import { listFolderContents } from '../lib/folder-system';
import type { PromptData, Variable } from '../../types';
import { toast } from 'sonner';

export const PROJECTS_QUERY_KEY = ['projects'];

/**
 * Recursively collect all projects from a folder and its subfolders
 * 
 * @param folderPath - Current folder path (null for root)
 * @returns Array of objects containing project name and folder path
 * 
 * _Requirements: 6.2_
 */
async function collectProjectsFromFolder(
  folderPath: string | null
): Promise<Array<{ name: string; folderPath: string | null }>> {
  const items = await listFolderContents(folderPath);
  const projects: Array<{ name: string; folderPath: string | null }> = [];

  for (const item of items) {
    if (item.type === 'project') {
      projects.push({
        name: item.name,
        folderPath
      });
    } else if (item.type === 'folder') {
      // Recursively collect projects from subfolders
      const subProjects = await collectProjectsFromFolder(item.path);
      projects.push(...subProjects);
    }
  }

  return projects;
}

/**
 * Get the full project path from name and folder path
 */
function getProjectPath(projectName: string, folderPath: string | null): string {
  return folderPath ? `${folderPath}/${projectName}` : projectName;
}

/**
 * Initialize the project system and fetch all projects from all folders
 * 
 * _Requirements: 6.2_
 */
async function initializeAndFetchProjects(): Promise<PromptData[]> {
  await projectSystem.initialize();
  
  // Collect all projects from all folders recursively
  const projectInfos = await collectProjectsFromFolder(null);

  if (projectInfos.length > 0) {
    const loadedProjects = await Promise.all(
      projectInfos.map(async ({ name, folderPath }) => {
        // Get the full path for loading the project
        const projectPath = getProjectPath(name, folderPath);
        const project = await projectSystem.getProject(projectPath);
        return convertProjectToPromptData(project, { folderPath });
      })
    );
    return loadedProjects;
  }

  // Create default project if none exist
  await projectSystem.createProject('Story Generator');
  await projectSystem.createVariant(
    'Story Generator',
    'Main',
    'Write a creative short story about {{topic}}. The tone should be {{tone}}.',
    {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      topK: 40,
      systemInstruction: '',
      variables: [
        { id: 'v1', key: 'topic', value: 'a space cat' },
        { id: 'v2', key: 'tone', value: 'humorous' }
      ]
    }
  );

  const project = await projectSystem.getProject('Story Generator');
  return [convertProjectToPromptData(project, { folderPath: null })];
}

/**
 * Hook to fetch all projects across all folders
 * 
 * _Requirements: 6.2_
 */
export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: initializeAndFetchProjects,
    staleTime: Infinity, // Data is managed locally, won't go stale
  });
}

/**
 * Input type for creating a project
 * Supports both simple string name (backward compatible) and object with folder path
 */
type CreateProjectInput = string | { name?: string; folderPath?: string | null } | undefined;

/**
 * Hook to create a new project
 * 
 * Supports creating projects in specific folders via the folderPath option.
 * Maintains backward compatibility with simple string name input.
 * 
 * _Requirements: 2.3, 2.4_
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  const [, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async (input?: CreateProjectInput) => {
      // Handle backward compatibility: input can be string, object, or undefined
      let newName: string;
      let targetFolderPath: string | null;
      
      if (typeof input === 'string') {
        // Backward compatible: simple string name
        newName = input;
        targetFolderPath = null;
      } else if (input && typeof input === 'object') {
        // New API: object with name and folderPath
        newName = input.name || `Untitled Prompt ${Date.now()}`;
        targetFolderPath = input.folderPath ?? null;
      } else {
        // No input: generate default name
        newName = `Untitled Prompt ${Date.now()}`;
        targetFolderPath = null;
      }
      
      // Create the project path based on folder location
      const projectPath = getProjectPath(newName, targetFolderPath);
      
      await projectSystem.createProject(projectPath);
      await projectSystem.createVariant(
        projectPath,
        'Main',
        '',
        {
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          topK: 40,
          variables: []
        }
      );
      const project = await projectSystem.getProject(projectPath);
      return convertProjectToPromptData(project, { folderPath: targetFolderPath });
    },
    onSuccess: (newPrompt) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) => 
        old ? [...old, newPrompt] : [newPrompt]
      );
      setActivePromptId(newPrompt.id);
    },
    onError: () => {
      toast.error('Failed to create project');
    }
  });
}


/**
 * Hook to update a project
 * 
 * Handles project renaming and updates while preserving folder location.
 * Automatically looks up the folder path from existing project data if not provided.
 * 
 * _Requirements: 2.3, 2.4_
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({ 
      currentName, 
      updates,
      folderPath
    }: { 
      currentName: string; 
      updates: Partial<PromptData>;
      folderPath?: string | null;
    }) => {
      // If folderPath not provided, look it up from existing project data
      let currentFolderPath = folderPath;
      if (currentFolderPath === undefined) {
        const existingProjects = queryClient.getQueryData<PromptData[]>(PROJECTS_QUERY_KEY);
        const existingProject = existingProjects?.find(p => p.name === currentName);
        currentFolderPath = existingProject?.folderPath ?? null;
      }
      
      const currentProjectPath = getProjectPath(currentName, currentFolderPath);
      
      if (updates.name && updates.name !== currentName) {
        // Rename project
        const existingProject = await projectSystem.getProject(currentProjectPath);
        
        // Create new project path with the new name in the same folder
        const newProjectPath = getProjectPath(updates.name, currentFolderPath);
        
        // Create new project with preserved timestamps
        await projectSystem.createProject(newProjectPath);
        await projectSystem.updateProjectTimestamps(
          newProjectPath, 
          existingProject.createdAt, 
          existingProject.updatedAt
        );

        for (const variant of existingProject.variants) {
          await projectSystem.createVariant(
            newProjectPath,
            variant.name,
            variant.content,
            variant.metadata
          );
        }

        // Copy variables and description to new project
        await projectSystem.updateProjectVariables(newProjectPath, existingProject.variables);
        if (existingProject.description) {
          await projectSystem.updateProjectDescription(newProjectPath, existingProject.description);
        }

        await projectSystem.deleteProject(currentProjectPath);

        const newProject = await projectSystem.getProject(newProjectPath);
        return convertProjectToPromptData(newProject, { folderPath: currentFolderPath });
      } else {
        if (updates.description !== undefined) {
          await projectSystem.updateProjectDescription(currentProjectPath, updates.description);
        }
        // Update the updatedAt timestamp for any other updates
        await projectSystem.updateProjectTimestamps(currentProjectPath, undefined, Date.now());
        return { currentName, updates, folderPath: currentFolderPath };
      }
    },
    onSuccess: (result) => {
      if ('id' in result) {
        // Full project returned (renamed)
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p => p.id === activePromptId ? result : p) ?? []
        );
        setActivePromptId(result.id);
        toast.success(`Project renamed to "${result.name}"`);
      } else {
        // Partial update
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p => p.id === activePromptId ? { ...p, ...result.updates } : p) ?? []
        );
      }
    },
    onError: () => {
      toast.error('Failed to update project');
    }
  });
}

/**
 * Hook to update project variables
 * 
 * Supports projects in folders via the folderPath option.
 * Automatically looks up the folder path from existing project data if not provided.
 * 
 * _Requirements: 2.4_
 */
export function useUpdateProjectVariables() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({ 
      projectName, 
      variables,
      folderPath
    }: { 
      projectName: string; 
      variables: Variable[];
      folderPath?: string | null;
    }) => {
      // If folderPath not provided, look it up from existing project data
      let currentFolderPath = folderPath;
      if (currentFolderPath === undefined) {
        const existingProjects = queryClient.getQueryData<PromptData[]>(PROJECTS_QUERY_KEY);
        const existingProject = existingProjects?.find(p => p.name === projectName);
        currentFolderPath = existingProject?.folderPath ?? null;
      }
      
      const projectPath = getProjectPath(projectName, currentFolderPath);
      await projectSystem.updateProjectVariables(projectPath, variables);
      return variables;
    },
    onSuccess: (variables) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p => p.id === activePromptId ? { ...p, projectVariables: variables } : p) ?? []
      );
      toast.success(`Project variables updated`);
    },
    onError: () => {
      toast.error('Failed to update project variables');
    }
  });
}

/**
 * Input type for deleting a project
 * Supports both simple string name (backward compatible) and object with folder path
 */
type DeleteProjectInput = string | { projectName: string; folderPath?: string | null };

/**
 * Hook to delete a project
 * 
 * Supports deleting projects from any folder location.
 * Maintains backward compatibility with simple string name input.
 * 
 * _Requirements: 2.3_
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async (input: DeleteProjectInput) => {
      // Handle backward compatibility: input can be string or object
      let projectName: string;
      let folderPath: string | null;
      
      if (typeof input === 'string') {
        // Backward compatible: simple string name (assumes root level)
        projectName = input;
        folderPath = null;
      } else {
        // New API: object with projectName and folderPath
        projectName = input.projectName;
        folderPath = input.folderPath ?? null;
      }
      
      const projectPath = getProjectPath(projectName, folderPath);
      await projectSystem.deleteProject(projectPath);
      return { projectName, folderPath };
    },
    onSuccess: ({ projectName, folderPath }) => {
      const deletedId = getProjectPath(projectName, folderPath);
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) => {
        const filtered = old?.filter(p => p.id !== deletedId) ?? [];
        if (activePromptId === deletedId && filtered.length > 0) {
          setActivePromptId(filtered[0].id);
        }
        return filtered;
      });
      toast.success(`Project "${projectName}" deleted`);
    },
    onError: () => {
      toast.error('Failed to delete project');
    }
  });
}
