import { useLibraryQueries } from './useLibraryQueries';
import { useVariantQueries } from './useVariantQueries';
import type { Template, Variable } from '../../types';

export function useLibraries() {
  const {
    templatesQuery,
    variablesQuery,
    addTemplate,
    isAddingTemplate,
    addVariableToLibrary,
    isAddingVariableToLibrary,
    removeVariableFromLibrary,
    isRemovingVariableFromLibrary,
  } = useLibraryQueries();

  const { updateVariant } = useVariantQueries();

  const createFromTemplate = (template: Template) => {
    const newPrompt = {
      id: crypto.randomUUID(),
      name: template.name,
      description: template.description,
      activeVariantId: crypto.randomUUID(),
      variants: [{
        id: crypto.randomUUID(),
        name: 'Main',
        content: template.content,
        config: template.config,
        variables: template.variables.map(v => ({
          id: crypto.randomUUID(),
          key: v.key,
          value: v.value
        })),
        versions: []
      }]
    };
    return newPrompt;
  };

  const saveAsTemplate = async (activePrompt: any, activeVariant: any) => {
    const newTemplate: Template = {
      name: activePrompt.name,
      description: activePrompt.description,
      content: activeVariant.content,
      config: activeVariant.config,
      variables: activeVariant.variables.map((v: Variable) => ({ key: v.key, value: v.value }))
    };
    await addTemplate(newTemplate);
  };

  const addToVariableLibrary = async (variable: Variable) => {
    await addVariableToLibrary(variable);
  };

  const removeFromVariableLibrary = async (id: string) => {
    await removeVariableFromLibrary(id);
  };

  const importVariable = async (variable: Variable, activeVariant: any, updateVariantFn: (updates: any) => void) => {
    if (!activeVariant) return;
    // Check if variant already has this key
    const exists = activeVariant.variables.some((v: Variable) => v.key === variable.key);
    if (exists) {
      // Update existing variable value
      const updatedVars = activeVariant.variables.map((v: Variable) =>
        v.key === variable.key ? { ...v, value: variable.value } : v
      );
      updateVariantFn({ variables: updatedVars });
    } else {
      // Add new variable to variant
      const newVar = { id: crypto.randomUUID(), key: variable.key, value: variable.value };
      updateVariantFn({ variables: [...activeVariant.variables, newVar] });
    }
  };

  return {
    templates: templatesQuery.data || [],
    variableLibrary: variablesQuery.data || [],
    isLoading: templatesQuery.isLoading || variablesQuery.isLoading,
    createFromTemplate,
    saveAsTemplate,
    addToVariableLibrary,
    removeFromVariableLibrary,
    importVariable
  };
}
