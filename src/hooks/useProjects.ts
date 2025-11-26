import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { projectSystem } from '../lib/project-system';
import { convertProjectToPromptData, INITIAL_PROMPT } from '../lib/convert';
import { activePromptIdAtom } from '../atoms';
import type { PromptData, Variable } from '../../types';

export const PROJECTS_QUERY_KEY = ['projects'];

async function initializeAndFetchProjects(): Promise<PromptData[]> {
  await projectSystem.initialize();
  const projectNames = await projectSystem.listProjects();

  if (projectNames.length > 0) {
    const loadedProjects = await Promise.all(
      projectNames.map(name => projectSystem.getProject(name))
    );
    return loadedProjects.map(project => convertProjectToPromptData(project));
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
  return [convertProjectToPromptData(project)];
}

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: initializeAndFetchProjects,
    staleTime: Infinity, // Data is managed locally, won't go stale
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const [, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async (name?: string) => {
      const newName = name || `Untitled Prompt ${Date.now()}`;
      await projectSystem.createProject(newName);
      await projectSystem.createVariant(
        newName,
        'Main',
        '',
        {
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          topK: 40,
          variables: []
        }
      );
      const project = await projectSystem.getProject(newName);
      return convertProjectToPromptData(project);
    },
    onSuccess: (newPrompt) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) => 
        old ? [...old, newPrompt] : [newPrompt]
      );
      setActivePromptId(newPrompt.id);
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({ 
      currentName, 
      updates 
    }: { 
      currentName: string; 
      updates: Partial<PromptData> 
    }) => {
      if (updates.name && updates.name !== currentName) {
        // Rename project
        await projectSystem.createProject(updates.name);
        const existingProject = await projectSystem.getProject(currentName);

        for (const variant of existingProject.variants) {
          await projectSystem.createVariant(
            updates.name,
            variant.name,
            variant.content,
            variant.metadata
          );
        }

        await projectSystem.deleteProject(currentName);

        const newProject = await projectSystem.getProject(updates.name);
        return convertProjectToPromptData(newProject);
      } else {
        if (updates.description !== undefined) {
          await projectSystem.updateProjectDescription(currentName, updates.description);
        }
        return { currentName, updates };
      }
    },
    onSuccess: (result) => {
      if ('id' in result) {
        // Full project returned (renamed)
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p => p.id === activePromptId ? result : p) ?? []
        );
        setActivePromptId(result.id);
      } else {
        // Partial update
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p => p.id === activePromptId ? { ...p, ...result.updates } : p) ?? []
        );
      }
    }
  });
}

export function useUpdateProjectVariables() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({ 
      projectName, 
      variables 
    }: { 
      projectName: string; 
      variables: Variable[] 
    }) => {
      await projectSystem.updateProjectVariables(projectName, variables);
      return variables;
    },
    onSuccess: (variables) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p => p.id === activePromptId ? { ...p, projectVariables: variables } : p) ?? []
      );
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async (projectName: string) => {
      await projectSystem.deleteProject(projectName);
      return projectName;
    },
    onSuccess: (deletedName) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) => {
        const filtered = old?.filter(p => p.name !== deletedName) ?? [];
        if (activePromptId === deletedName && filtered.length > 0) {
          setActivePromptId(filtered[0].id);
        }
        return filtered;
      });
    }
  });
}
