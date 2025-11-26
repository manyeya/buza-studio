import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { projectSystem } from '../lib/project-system';
import { convertProjectToPromptData } from '../lib/convert';
import { activePromptIdAtom } from '../atoms';
import { PROJECTS_QUERY_KEY } from './useProjects';
import type { PromptData, PromptVariant, PromptVersion } from '../../types';
import { toast } from 'sonner';

export function useUpdateVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      variantName,
      variantId,
      updates
    }: {
      projectName: string;
      variantName: string;
      variantId: string;
      updates: Partial<PromptVariant>;
    }) => {
      const prompts = queryClient.getQueryData<PromptData[]>(PROJECTS_QUERY_KEY);
      const activePrompt = prompts?.find(p => p.id === activePromptId);
      const currentVariant = activePrompt?.variants.find(v => v.id === variantId);

      if (!currentVariant) throw new Error('Variant not found');

      const updatedVariant = { ...currentVariant, ...updates };

      // If renaming variant, delete old and create new
      if (updates.name && updates.name !== variantName) {
        await projectSystem.createVariant(
          projectName,
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
        await projectSystem.deleteVariant(projectName, variantName);
      } else {
        await projectSystem.updateVariant(
          projectName,
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

export function useAddVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      baseVariant
    }: {
      projectName: string;
      baseVariant?: PromptVariant;
    }) => {
      const newName = `${baseVariant?.name || 'Main'} (Copy)`;

      await projectSystem.createVariant(
        projectName,
        newName,
        baseVariant?.content || '',
        {
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          topK: 40,
          variables: []
        }
      );

      const project = await projectSystem.getProject(projectName);
      return convertProjectToPromptData(project);
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

export function useDeleteVariant() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      projectName,
      variantName
    }: {
      projectName: string;
      variantName: string;
    }) => {
      await projectSystem.deleteVariant(projectName, variantName);
      const project = await projectSystem.getProject(projectName);
      return convertProjectToPromptData(project);
    },
    onSuccess: (updatedPrompt) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p => p.id === activePromptId ? updatedPrompt : p) ?? []
      );
      toast.success(`Variant "${updatedPrompt.variants[updatedPrompt.variants.length - 1].name}" deleted`);
    },
    onError: () => {
      toast.error('Failed to delete variant');
    }
  });
}

export function useSaveVersion() {
  const updateVariant = useUpdateVariant();

  return useMutation({
    mutationFn: async ({
      projectName,
      variant,
      versionName
    }: {
      projectName: string;
      variant: PromptVariant;
      versionName?: string;
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
        }
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

export function useRestoreVersion() {
  const updateVariant = useUpdateVariant();

  return useMutation({
    mutationFn: async ({
      projectName,
      variant,
      version
    }: {
      projectName: string;
      variant: PromptVariant;
      version: PromptVersion;
    }) => {
      await updateVariant.mutateAsync({
        projectName,
        variantName: variant.name,
        variantId: variant.id,
        updates: {
          content: version.content,
          config: JSON.parse(JSON.stringify(version.config)),
          variables: JSON.parse(JSON.stringify(version.variables))
        }
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
