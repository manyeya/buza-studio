import type { Project } from './project-system';
import type { PromptData, Variable, PromptVariant } from '../../types';

export const INITIAL_PROMPT: PromptData = {
  id: '1',
  name: 'Story Generator',
  description: 'Generates a short story based on a topic.',
  activeVariantId: 'v-main',
  variants: [
    {
      id: 'v-main',
      name: 'Main',
      content: 'Write a creative short story about {{topic}}. The tone should be {{tone}}.',
      config: {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        topK: 40,
        systemInstruction: ''
      },
      variables: [
        { id: 'v1', key: 'topic', value: 'a space cat' },
        { id: 'v2', key: 'tone', value: 'humorous' }
      ],
      versions: []
    }
  ],
  projectVariables: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  folderPath: null
};

/**
 * Options for converting a project to PromptData
 */
export interface ConvertOptions {
  /** The folder path where the project is located (null for root level) */
  folderPath?: string | null;
}

/**
 * Convert a Project to PromptData format
 * 
 * @param project - The project to convert
 * @param options - Optional conversion options including folder path
 * @returns PromptData representation of the project
 * 
 * _Requirements: 2.3, 2.4, 6.2_
 */
export function convertProjectToPromptData(project: Project, options?: ConvertOptions): PromptData {
  const folderPath = options?.folderPath ?? null;
  
  const variants: PromptVariant[] = project.variants.map((variant, index) => {
    let variables: Variable[] = [];
    if (Array.isArray(variant.metadata.variables)) {
      variables = variant.metadata.variables;
    } else if (variant.metadata.variables && typeof variant.metadata.variables === 'object') {
      variables = Object.entries(variant.metadata.variables).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value: String(value)
      }));
    }

    return {
      id: `${project.name}-${variant.name}-${index}`,
      name: variant.name,
      content: variant.content,
      config: {
        model: variant.metadata.model || 'gemini-2.5-flash',
        temperature: variant.metadata.temperature || 0.7,
        topK: variant.metadata.topK || 40,
        maxOutputTokens: variant.metadata.maxTokens,
        systemInstruction: variant.metadata.systemInstruction || ''
      },
      variables,
      versions: [],
      lastOutput: undefined,
      lastRunTime: undefined
    };
  });

  // Generate a unique ID that includes folder path for uniqueness across folders
  const uniqueId = folderPath ? `${folderPath}/${project.name}` : project.name;

  return {
    id: uniqueId,
    name: project.name,
    description: project.description || '',
    activeVariantId: variants[0]?.id || '',
    variants,
    projectVariables: project.variables || [],
    createdAt: project.createdAt || Date.now(),
    updatedAt: project.updatedAt || Date.now(),
    folderPath
  };
}
