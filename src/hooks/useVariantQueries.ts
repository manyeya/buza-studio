import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectSystem } from '../lib/project-system';
import { convertProjectToPromptData } from './useProjectQueries';

export function useVariantQueries() {
  const queryClient = useQueryClient();

  // Query for a specific variant
  const useVariant = (projectName: string, variantName: string) => {
    return useQuery({
      queryKey: ['variant', projectName, variantName],
      queryFn: async () => {
        const variant = await projectSystem.readVariant(projectName, variantName);
        return convertProjectToPromptData(await projectSystem.getProject(projectName)).variants.find(v => v.name === variantName);
      },
      staleTime: 5 * 60 * 1000,
    });
  };

  // Mutation to create new variant
  const createVariantMutation = useMutation({
    mutationFn: async ({
      projectName,
      variantName,
      content = '',
      metadata = {}
    }: {
      projectName: string;
      variantName: string;
      content?: string;
      metadata?: any;
    }) => {
      await projectSystem.createVariant(projectName, variantName, content, metadata);
      return { projectName, variantName };
    },
    onSuccess: ({ projectName }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectName] });
    },
  });

  // Mutation to update variant
  const updateVariantMutation = useMutation({
    mutationFn: async ({
      projectName,
      variantName,
      content,
      metadata
    }: {
      projectName: string;
      variantName: string;
      content: string;
      metadata: any;
    }) => {
      await projectSystem.updateVariant(projectName, variantName, content, metadata);
      return { projectName, variantName };
    },
    onSuccess: ({ projectName }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectName] });
      queryClient.invalidateQueries({ queryKey: ['variant', projectName] });
    },
  });

  // Mutation to delete variant
  const deleteVariantMutation = useMutation({
    mutationFn: async ({
      projectName,
      variantName
    }: {
      projectName: string;
      variantName: string;
    }) => {
      await projectSystem.deleteVariant(projectName, variantName);
      return { projectName, variantName };
    },
    onSuccess: ({ projectName }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectName] });
      queryClient.invalidateQueries({ queryKey: ['variant', projectName] });
    },
  });

  return {
    useVariant,
    createVariant: createVariantMutation.mutateAsync,
    isCreatingVariant: createVariantMutation.isPending,
    updateVariant: updateVariantMutation.mutateAsync,
    isUpdatingVariant: updateVariantMutation.isPending,
    deleteVariant: deleteVariantMutation.mutateAsync,
    isDeletingVariant: deleteVariantMutation.isPending,
  };
}
