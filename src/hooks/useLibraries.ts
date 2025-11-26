import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectSystem } from '../lib/project-system';
import type { Variable, Template } from '../../types';

export const VARIABLE_LIBRARY_KEY = ['variableLibrary'];
export const TEMPLATE_LIBRARY_KEY = ['templateLibrary'];

// Variable Library Hooks
export function useVariableLibrary() {
  return useQuery({
    queryKey: VARIABLE_LIBRARY_KEY,
    queryFn: () => projectSystem.getVariableLibrary(),
    staleTime: Infinity,
  });
}

export function useAddToVariableLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variable: Variable) => {
      const current = queryClient.getQueryData<Variable[]>(VARIABLE_LIBRARY_KEY) ?? [];
      const existing = current.find(v => v.key === variable.key);

      if (existing) {
        const confirmUpdate = window.confirm(`Variable "{{${variable.key}}}" already exists. Update it?`);
        if (!confirmUpdate) {
          throw new Error('User cancelled update');
        }
        const updated = current.map(v => 
          v.key === variable.key ? { ...v, value: variable.value } : v
        );
        await projectSystem.updateVariableLibrary(updated);
        return updated;
      } else {
        const newVar = { ...variable, id: crypto.randomUUID() };
        const updated = [...current, newVar];
        await projectSystem.updateVariableLibrary(updated);
        return updated;
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(VARIABLE_LIBRARY_KEY, updated);
    }
  });
}

export function useRemoveFromVariableLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const current = queryClient.getQueryData<Variable[]>(VARIABLE_LIBRARY_KEY) ?? [];
      const updated = current.filter(v => v.id !== id);
      await projectSystem.updateVariableLibrary(updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(VARIABLE_LIBRARY_KEY, updated);
    }
  });
}

// Template Library Hooks
export function useTemplateLibrary() {
  return useQuery({
    queryKey: TEMPLATE_LIBRARY_KEY,
    queryFn: () => projectSystem.getTemplateLibrary(),
    staleTime: Infinity,
  });
}

export function useSaveAsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Template) => {
      const current = queryClient.getQueryData<Template[]>(TEMPLATE_LIBRARY_KEY) ?? [];
      const updated = [template, ...current];
      await projectSystem.updateTemplateLibrary(updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(TEMPLATE_LIBRARY_KEY, updated);
    }
  });
}
