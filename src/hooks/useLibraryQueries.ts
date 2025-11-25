import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Template, Variable } from '../../types';
import { TEMPLATES } from '../../data/templates';

export function useLibraryQueries() {
  const queryClient = useQueryClient();

  // Query for templates
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      // Load from localStorage initially
      const savedTemplates = localStorage.getItem('promptStudio_templates');
      if (savedTemplates) {
        try {
          const parsedTemplates = JSON.parse(savedTemplates);
          if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
            return parsedTemplates;
          }
        } catch (e) {
          console.error("Failed to load saved templates", e);
        }
      }
      // Fallback to default templates
      return TEMPLATES;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query for variable library
  const variablesQuery = useQuery({
    queryKey: ['variableLibrary'],
    queryFn: async () => {
      const savedVars = localStorage.getItem('promptStudio_vars');
      if (savedVars) {
        try {
          const parsedVars = JSON.parse(savedVars);
          if (Array.isArray(parsedVars)) {
            return parsedVars;
          }
        } catch (e) {
          console.error("Failed to load variables", e);
        }
      }
      // Return default variables
      return [
        { id: 'glob-1', key: 'tone', value: 'Professional' },
        { id: 'glob-2', key: 'audience', value: 'Experts' },
        { id: 'glob-3', key: 'output_format', value: 'JSON' }
      ];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation to add template
  const addTemplateMutation = useMutation({
    mutationFn: async (template: Template) => {
      const currentTemplates = templatesQuery.data || [];
      const newTemplates = [...currentTemplates, template];
      localStorage.setItem('promptStudio_templates', JSON.stringify(newTemplates));
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  // Mutation to add variable to library
  const addVariableToLibraryMutation = useMutation({
    mutationFn: async (variable: Variable) => {
      const currentVariables = variablesQuery.data || [];
      const existing = currentVariables.find(v => v.key === variable.key);
      let newVariables: Variable[];

      if (existing) {
        // Update existing
        newVariables = currentVariables.map(v =>
          v.key === variable.key ? { ...v, value: variable.value } : v
        );
      } else {
        // Add new
        newVariables = [...currentVariables, { ...variable, id: crypto.randomUUID() }];
      }

      localStorage.setItem('promptStudio_vars', JSON.stringify(newVariables));
      return variable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variableLibrary'] });
    },
  });

  // Mutation to remove variable from library
  const removeVariableFromLibraryMutation = useMutation({
    mutationFn: async (variableId: string) => {
      const currentVariables = variablesQuery.data || [];
      const newVariables = currentVariables.filter(v => v.id !== variableId);

      localStorage.setItem('promptStudio_vars', JSON.stringify(newVariables));
      return variableId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variableLibrary'] });
    },
  });

  return {
    templatesQuery,
    variablesQuery,
    addTemplate: addTemplateMutation.mutateAsync,
    isAddingTemplate: addTemplateMutation.isPending,
    addVariableToLibrary: addVariableToLibraryMutation.mutateAsync,
    isAddingVariableToLibrary: addVariableToLibraryMutation.isPending,
    removeVariableFromLibrary: removeVariableFromLibraryMutation.mutateAsync,
    isRemovingVariableFromLibrary: removeVariableFromLibraryMutation.isPending,
  };
}
