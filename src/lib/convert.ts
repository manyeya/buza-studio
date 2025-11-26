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
  projectVariables: []
};

export function convertProjectToPromptData(project: Project): PromptData {
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

  return {
    id: project.name,
    name: project.name,
    description: project.description || '',
    activeVariantId: variants[0]?.id || '',
    variants,
    projectVariables: project.variables || []
  };
}
