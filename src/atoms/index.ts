import { atom } from 'jotai';

// UI State atoms
export const activePromptIdAtom = atom<string>('1');
export const isTemplateModalOpenAtom = atom<boolean>(false);
export const isVariableLibraryOpenAtom = atom<boolean>(false);

// Derived atom for active variant ID within a prompt
export const activeVariantIdAtom = atom<string | null>(null);
