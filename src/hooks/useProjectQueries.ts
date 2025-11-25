import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectSystem, type Project } from '../lib/project-system';
import type { PromptData, PromptVariant } from '../../types';

// Convert Project (from file system) to PromptData (for UI)
export function convertProjectToPromptData(project: Project): PromptData {
  const variants: PromptVariant[] = project.variants.map((variant, index) => {
    // Ensure variables is always an array
    let variables: any[] = [];
    if (Array.isArray(variant.metadata.variables)) {
      variables = variant.metadata.variables;
    } else if (variant.metadata.variables && typeof variant.metadata.variables === 'object') {
      // Convert object to array if needed
      variables = Object.entries(variant.metadata.variables).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value: String(value)
      }));
    }

    return {
      id: `${project.name}-${variant.name}-${index}`,
      name: variant.name,
      content: variant.content,
      config: {
        model: variant.metadata.model || 'gemini-2.5-flash',
        temperature: variant.metadata.temperature || 0.7,
        topK: variant.metadata.topK || 40,
        maxOutputTokens: variant.metadata.maxTokens,
        systemInstruction: variant.metadata.systemInstruction
      },
      variables,
      versions: [],
      lastOutput: undefined,
      lastRunTime: undefined
    };
  });

  return {
    id: project.name,
    name: project.name,
    description: '',
    activeVariantId: variants[0]?.id || '',
    variants
  };
}

export function useProjectQueries() {
  const queryClient = useQueryClient();

  // Query to get list of projects
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const projectNames = await projectSystem.listProjects();
      if (projectNames.length === 0) return [];

      const loadedProjects = await Promise.all(
        projectNames.map(name => projectSystem.getProject(name))
      );
      return loadedProjects.map(project => convertProjectToPromptData(project));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query to get a single project
  const useProject = (projectName: string) => {
    return useQuery({
      queryKey: ['project', projectName],
      queryFn: async () => {
        const project = await projectSystem.getProject(projectName);
        return convertProjectToPromptData(project);
      },
      staleTime: 5 * 60 * 1000,
    });
  };

  // Mutation to create new project
  const createProjectMutation = useMutation({
    mutationFn: async ({ name, variantName }: { name: string; variantName?: string }) => {
      await projectSystem.createProject(name);
      await projectSystem.createVariant(name, variantName || 'Main', '', {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        topK: 40,
        variables: []
      });
      return name;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Mutation to delete project
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectName: string) => {
      await projectSystem.deleteProject(projectName);
      return projectName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Mutation to update project (rename)
  const updateProjectMutation = useMutation({
    mutationFn: async ({
      oldName,
      newName
    }: {
      oldName: string;
      newName: string
    }) => {
      // Create new project
      await projectSystem.createProject(newName);

      // Get existing project data
      const oldProject = await projectSystem.getProject(oldName);

      // Copy all variants to new project
      for (const variant of oldProject.variants) {
        await projectSystem.createVariant(
          newName,
          variant.name,
          variant.content,
          variant.metadata
        );
      }

      // Delete old project
      await projectSystem.deleteProject(oldName);

      return { oldName, newName };
    },
    onSuccess: ({ oldName, newName }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', oldName] });
      queryClient.invalidateQueries({ queryKey: ['project', newName] });
    },
  });

  return {
    projectsQuery,
    useProject,
    createProject: createProjectMutation.mutateAsync,
    isCreating: createProjectMutation.isPending,
    deleteProject: deleteProjectMutation.mutateAsync,
    isDeleting: deleteProjectMutation.isPending,
    updateProject: updateProjectMutation.mutateAsync,
    isUpdating: updateProjectMutation.isPending,
  };
}
