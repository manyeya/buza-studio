/**
 * React Query hooks for variant operations with folder awareness
 * 
 * Provides mutations for variant CRUD operations that support
 * projects in hierarchical folder organization.
 * 
 * _Requirements: 2.3, 2.4, 6.2_
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { projectSystem } from '../lib/project-system';
import { convertProjectToPromptData } from '../lib/convert';
import { activePromptIdAtom } from '../atoms';
import { PROJECTS_QUERY_KEY } from './useProjects';
import type { PromptData, PromptVariant, PromptVersion } from '../../types';
import { toast } from 'sonner';

/**
 * Get the full project path from name and folder path
 */
function getProjectPath(projectName: string, folderPath: string | null): string {
  return folderPath ? `${folderPath}/${projectName}` : projectName;
}

/**
 * Hook to update a variant
 * 
 * Automatically looks up the folder path from existing project data.
 * 
 * _Requirements: 2.4_
 */
export function useUpdateVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      variantName,
      variantId,
      updates,
      folderPath
    }: {
      projectName: string;
      variantName: string;
      variantId: string;
      updates: Partial<PromptVariant>;
      folderPath?: string | null;
    }) => {
      const prompts = queryClient.getQueryData<PromptData[]>(PROJECTS_QUERY_KEY);
      const activePrompt = prompts?.find(p => p.id === activePromptId);
      const currentVariant = activePrompt?.variants.find(v => v.id === variantId);

      if (!currentVariant) throw new Error('Variant not found');

      // If folderPath not provided, look it up from existing project data
      let currentFolderPath = folderPath;
      if (currentFolderPath === undefined) {
        currentFolderPath = activePrompt?.folderPath ?? null;
      }
      
      const projectPath = getProjectPath(projectName, currentFolderPath);
      const updatedVariant = { ...currentVariant, ...updates };

      // If renaming variant, delete old and create new
      if (updates.name && updates.name !== variantName) {
        await projectSystem.createVariant(
          projectPath,
          updates.name,
          updatedVariant.content,
          {
            model: updatedVariant.config.model,
            temperature: updatedVariant.config.temperature,
            maxTokens: updatedVariant.config.maxOutputTokens,
            topK: updatedVariant.config.topK,
            systemInstruction: updatedVariant.config.systemInstruction,
            variables: updatedVariant.variables
          }
        );
        await projectSystem.deleteVariant(projectPath, variantName);
      } else {
        await projectSystem.updateVariant(
          projectPath,
          variantName,
          updatedVariant.content,
          {
            model: updatedVariant.config.model,
            temperature: updatedVariant.config.temperature,
            maxTokens: updatedVariant.config.maxOutputTokens,
            topK: updatedVariant.config.topK,
            systemInstruction: updatedVariant.config.systemInstruction,
            variables: updatedVariant.variables
          }
        );
      }

      return { variantId, updates, newName: updates.name };
    },
    onSuccess: ({ variantId, updates, newName }) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p =>
          p.id === activePromptId
            ? {
              ...p,
              variants: p.variants.map(v =>
                v.id === variantId
                  ? { ...v, ...updates, name: newName || v.name }
                  : v
              )
            }
            : p
        ) ?? []
      );
    },
    onError: () => {
      toast.error('Failed to update variant');
    }
  });
}


/**
 * Hook to add a new variant to a project
 * 
 * Automatically looks up the folder path from existing project data.
 * 
 * _Requirements: 2.4_
 */
export function useAddVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      baseVariant,
      folderPath
    }: {
      projectName: string;
      baseVariant?: PromptVariant;
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
      const newName = `${baseVariant?.name || 'Main'} (Copy)`;

      await projectSystem.createVariant(
        projectPath,
        newName,
        baseVariant?.content || '',
        {
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          topK: 40,
          variables: []
        }
      );

      const project = await projectSystem.getProject(projectPath);
      return convertProjectToPromptData(project, { folderPath: currentFolderPath });
    },
    onSuccess: (updatedPrompt) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p => p.id === activePromptId ? updatedPrompt : p) ?? []
      );
      toast.success(`Variant "${updatedPrompt.variants[updatedPrompt.variants.length - 1].name}" added`);
    },
    onError: () => {
      toast.error('Failed to add variant');
    }
  });
}

/**
 * Hook to delete a variant from a project
 * 
 * Automatically looks up the folder path from existing project data.
 * 
 * _Requirements: 2.4_
 */
export function useDeleteVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      variantName,
      folderPath
    }: {
      projectName: string;
      variantName: string;
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
      await projectSystem.deleteVariant(projectPath, variantName);
      const project = await projectSystem.getProject(projectPath);
      return convertProjectToPromptData(project, { folderPath: currentFolderPath });
    },
    onSuccess: (updatedPrompt) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p => p.id === activePromptId ? updatedPrompt : p) ?? []
      );
      toast.success(`Variant deleted`);
    },
    onError: () => {
      toast.error('Failed to delete variant');
    }
  });
}

/**
 * Hook to save a version of a variant
 * 
 * _Requirements: 2.4_
 */
export function useSaveVersion() {
  const updateVariant = useUpdateVariant();

  return useMutation({
    mutationFn: async ({
      projectName,
      variant,
      versionName,
      folderPath
    }: {
      projectName: string;
      variant: PromptVariant;
      versionName?: string;
      folderPath?: string | null;
    }) => {
      const newVersion: PromptVersion = {
        id: crypto.randomUUID(),
        name: versionName || `Version ${variant.versions.length + 1}`,
        timestamp: Date.now(),
        content: variant.content,
        config: JSON.parse(JSON.stringify(variant.config)),
        variables: JSON.parse(JSON.stringify(variant.variables))
      };

      await updateVariant.mutateAsync({
        projectName,
        variantName: variant.name,
        variantId: variant.id,
        updates: {
          versions: [newVersion, ...variant.versions]
        },
        folderPath
      }, {
        onSuccess: () => {
          toast.success(`Version "${newVersion.name}" saved`);
        },
        onError: () => {
          toast.error('Failed to save version');
        }
      });
      return newVersion;
    }
  });
}

/**
 * Hook to restore a version of a variant
 * 
 * _Requirements: 2.4_
 */
export function useRestoreVersion() {
  const updateVariant = useUpdateVariant();

  return useMutation({
    mutationFn: async ({
      projectName,
      variant,
      version,
      folderPath
    }: {
      projectName: string;
      variant: PromptVariant;
      version: PromptVersion;
      folderPath?: string | null;
    }) => {
      await updateVariant.mutateAsync({
        projectName,
        variantName: variant.name,
        variantId: variant.id,
        updates: {
          content: version.content,
          config: JSON.parse(JSON.stringify(version.config)),
          variables: JSON.parse(JSON.stringify(version.variables))
        },
        folderPath
      }, {
        onSuccess: () => {
          toast.success(`Version "${version.name}" restored`);
        },
        onError: () => {
          toast.error('Failed to restore version');
        }
      });
    }
  });
}
