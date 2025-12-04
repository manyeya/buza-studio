import { atom } from 'jotai';

// UI State atoms
export const activePromptIdAtom = atom<string>('1');
export const isTemplateModalOpenAtom = atom<boolean>(false);
export const isVariableLibraryOpenAtom = atom<boolean>(false);
export const isSettingsModalOpenAtom = atom<boolean>(false);

// Derived atom for active variant ID within a prompt
export const activeVariantIdAtom = atom<string | null>(null);

// Atom to track detected variant variables from content
export const detectedVariantVariablesAtom = atom<Set<string>>(new Set<string>());

// Re-export folder atoms
export * from './folder-atoms';
