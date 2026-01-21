import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import * as AiService from '../services/aiService';
import { activePromptIdAtom } from '../atoms';
import { PROJECTS_QUERY_KEY } from './useProjects';
import type { PromptData, PromptVariant } from '../../types';
import { toast } from 'sonner';

export function useRunPrompt() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      variant,
      projectVariables
    }: {
      variant: PromptVariant;
      projectVariables: { key: string; value: string }[];
    }) => {
      const vars: Record<string, string> = {};

      projectVariables?.forEach(v => {
        vars[v.key] = v.value;
      });

      variant.variables.forEach(v => {
        vars[v.key] = v.value;
      });

      const output = await AiService.runPrompt(variant.content, variant.config, vars);
      return { output, variantId: variant.id };
    },
    onSuccess: ({ output, variantId }) => {
      queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
        old?.map(p =>
          p.id === activePromptId
            ? {
                ...p,
                variants: p.variants.map(v =>
                  v.id === variantId
                    ? { ...v, lastOutput: output, lastRunTime: Date.now() }
                    : v
                )
              }
            : p
        ) ?? []
      );
    },
    onError: (error) => {
      console.error("Run prompt failed:", error);
      toast.error('Failed to run prompt');
    }
  });
}

export function useOptimizePrompt() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      variant,
      model = 'gemini-2.0-flash'
    }: {
      variant: PromptVariant;
      model?: string;
    }) => {
      const optimizedContent = await AiService.optimizePrompt(variant.content, model);
      return { optimizedContent, variantId: variant.id };
    },
    onSuccess: ({ optimizedContent, variantId }) => {
      if (optimizedContent) {
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p =>
            p.id === activePromptId
              ? {
                  ...p,
                  variants: p.variants.map(v =>
                    v.id === variantId
                      ? { ...v, content: optimizedContent }
                      : v
                  )
                }
              : p
          ) ?? []
        );
      }
    },
    onError: (error) => {
        console.error("Optimize prompt failed:", error);
      toast.error('Failed to optimize prompt');
    }
  });
}

export function useGeneratePromptStructure() {
  const queryClient = useQueryClient();
  const [activePromptId] = useAtom(activePromptIdAtom);

  return useMutation({
    mutationFn: async ({
      description,
      variant,
      model = 'gemini-2.0-flash'
    }: {
      description: string;
      variant: PromptVariant;
      model?: string;
    }) => {
      const result = await AiService.generatePromptStructure(description, model);
      return { result, variantId: variant.id, currentConfig: variant.config };
    },
    onSuccess: ({ result, variantId, currentConfig }) => {
      if (result) {
        queryClient.setQueryData<PromptData[]>(PROJECTS_QUERY_KEY, (old) =>
          old?.map(p =>
            p.id === activePromptId
              ? {
                  ...p,
                  variants: p.variants.map(v =>
                    v.id === variantId
                      ? {
                          ...v,
                          content: result.content,
                          config: {
                            ...currentConfig,
                            systemInstruction: result.systemInstruction || '',
                            model: result.model || currentConfig.model
                          },
                          variables: result.variables.map(rv => ({
                            id: crypto.randomUUID(),
                            key: rv.key,
                            value: rv.value
                          }))
                        }
                      : v
                  )
                }
              : p
          ) ?? []
        );
      }
    },
    onError: (error) => {
        console.error("Generate prompt structure failed:", error);
      toast.error('Failed to generate prompt structure');
    }
  });
}
