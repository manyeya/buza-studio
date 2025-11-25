
export interface Variable {
  id: string;
  key: string;
  value: string;
}

export interface PromptConfig {
  model: string;
  temperature: number;
  topK: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export interface PromptVersion {
  id: string;
  name: string;
  timestamp: number;
  content: string;
  config: PromptConfig;
  variables: Variable[];
}

export interface PromptVariant {
  id: string;
  name: string;
  content: string;
  config: PromptConfig;
  variables: Variable[];
  versions: PromptVersion[];
  lastOutput?: string;
  lastRunTime?: number;
}

export interface PromptData {
  id: string;
  name: string;
  description: string;
  activeVariantId: string;
  variants: PromptVariant[];
  projectVariables: Variable[];
}

export interface Template {
  name: string;
  description: string;
  content: string;
  config: PromptConfig;
  variables: { key: string; value: string }[];
}

export enum ViewMode {
  DESIGN = 'DESIGN',
  CODE = 'CODE',
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
