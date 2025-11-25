import { atom } from 'jotai';
import { PromptData, Template, Variable } from '../../types';

// Core project state
export const promptsAtom = atom<PromptData[]>([]);
export const activePromptIdAtom = atom<string>('');

// Modal state
export const isTemplateModalOpenAtom = atom<boolean>(false);
export const isVariableLibraryOpenAtom = atom<boolean>(false);

// Library state
export const templatesAtom = atom<Template[]>([]);
export const variableLibraryAtom = atom<Variable[]>([]);

// Loading state
export const isLoadingAtom = atom<boolean>(true);

// Initial data atoms
export const initialPromptsAtom = atom<PromptData[]>([]);
export const initialVariableLibraryAtom = atom<Variable[]>([]);

// Computed atoms
export const activePromptAtom = atom(
  (get) => {
    const prompts = get(promptsAtom);
    const activeId = get(activePromptIdAtom);
    return prompts.find(p => p.id === activeId);
  }
);

export const activeVariantAtom = atom(
  (get) => {
    const activePrompt = get(activePromptAtom);
    if (!activePrompt) return null;
    return activePrompt.variants.find(v => v.id === activePrompt.activeVariantId) || activePrompt.variants[0];
  }
);

// Action atoms for complex state updates
export const projectActionsAtom = atom(
  null,
  (get, set, action: { type: string; payload?: any }) => {
    const currentPrompts = get(promptsAtom);
    const currentActiveId = get(activePromptIdAtom);

    switch (action.type) {
      case 'SET_PROMPTS':
        set(promptsAtom, action.payload);
        break;
      case 'SET_ACTIVE_PROMPT':
        set(activePromptIdAtom, action.payload);
        break;
      case 'ADD_PROMPT':
        const updatedPrompts = [...currentPrompts, action.payload];
        set(promptsAtom, updatedPrompts);
        set(activePromptIdAtom, action.payload.id);
        break;
      case 'UPDATE_PROMPT':
        const updatedAfterUpdate = currentPrompts.map(p =>
          p.id === currentActiveId ? { ...p, ...action.payload } : p
        );
        set(promptsAtom, updatedAfterUpdate);
        break;
      case 'SET_LOADING':
        set(isLoadingAtom, action.payload);
        break;
      default:
        break;
    }
  }
);

export const modalActionsAtom = atom(
  null,
  (get, set, action: { type: string; payload?: any }) => {
    switch (action.type) {
      case 'OPEN_TEMPLATE_MODAL':
        set(isTemplateModalOpenAtom, true);
        break;
      case 'CLOSE_TEMPLATE_MODAL':
        set(isTemplateModalOpenAtom, false);
        break;
      case 'OPEN_VARIABLE_LIBRARY':
        set(isVariableLibraryOpenAtom, true);
        break;
      case 'CLOSE_VARIABLE_LIBRARY':
        set(isVariableLibraryOpenAtom, false);
        break;
      default:
        break;
    }
  }
);

export const templateActionsAtom = atom(
  null,
  (get, set, action: { type: string; payload?: any }) => {
    const currentTemplates = get(templatesAtom);

    switch (action.type) {
      case 'SET_TEMPLATES':
        set(templatesAtom, action.payload);
        break;
      case 'ADD_TEMPLATE':
        set(templatesAtom, [...currentTemplates, action.payload]);
        break;
      default:
        break;
    }
  }
);

export const variableLibraryActionsAtom = atom(
  null,
  (get, set, action: { type: string; payload?: any }) => {
    const currentVariables = get(variableLibraryAtom);

    switch (action.type) {
      case 'SET_VARIABLE_LIBRARY':
        set(variableLibraryAtom, action.payload);
        break;
      case 'ADD_VARIABLE_TO_LIBRARY':
        const existing = currentVariables.find(v => v.key === action.payload.key);
        if (existing) {
          // Update existing
          set(variableLibraryAtom, currentVariables.map(v =>
            v.key === action.payload.key ? { ...v, value: action.payload.value } : v
          ));
        } else {
          // Add new
          set(variableLibraryAtom, [...currentVariables, { ...action.payload, id: crypto.randomUUID() }]);
        }
        break;
      case 'REMOVE_VARIABLE_FROM_LIBRARY':
        set(variableLibraryAtom, currentVariables.filter(v => v.id !== action.payload));
        break;
      case 'IMPORT_VARIABLE':
        // This will be handled in the hook
        break;
      default:
        break;
    }
  }
);
