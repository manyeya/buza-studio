import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Template, Variable } from '../../types';
import { TEMPLATES } from '../../data/templates';
import { projectSystem } from '../lib/project-system';

export function useLibraryQueries() {
    const queryClient = useQueryClient();

    // Query for templates - NOW USING FILE SYSTEM
    const templatesQuery = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const templates = await projectSystem.getTemplateLibrary();
            // If no templates exist, return default templates
            if (templates.length === 0) {
                return TEMPLATES;
            }
            return templates;
        },
        staleTime: 5 * 60 * 1000,
    });

    // Query for variable library - NOW USING FILE SYSTEM
    const variablesQuery = useQuery({
        queryKey: ['variableLibrary'],
        queryFn: async () => {
            return await projectSystem.getVariableLibrary();
        },
        staleTime: 5 * 60 * 1000,
    });

    // Mutation to add template - NOW USING FILE SYSTEM
    const addTemplateMutation = useMutation({
        mutationFn: async (template: Template) => {
            const currentTemplates = templatesQuery.data || [];
            const newTemplates = [...currentTemplates, template];
            await projectSystem.updateTemplateLibrary(newTemplates);
            return template;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
        },
    });

    // Mutation to add variable to library - NOW USING FILE SYSTEM
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

            await projectSystem.updateVariableLibrary(newVariables);
            return variable;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variableLibrary'] });
        },
    });

    // Mutation to remove variable from library - NOW USING FILE SYSTEM
    const removeVariableFromLibraryMutation = useMutation({
        mutationFn: async (variableId: string) => {
            const currentVariables = variablesQuery.data || [];
            const newVariables = currentVariables.filter(v => v.id !== variableId);

            await projectSystem.updateVariableLibrary(newVariables);
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
