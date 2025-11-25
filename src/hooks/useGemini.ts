import { useAtom } from 'jotai';
import * as GeminiService from '../../services/geminiService';
import { activeVariantAtom } from '../store/atoms';

export function useGemini() {
  const [activeVariant] = useAtom(activeVariantAtom);

  const runPrompt = async () => {
    if (!activeVariant) return null;

    // Prepare variables map
    const vars: Record<string, string> = {};
    activeVariant.variables.forEach(v => {
      vars[v.key] = v.value;
    });

    const output = await GeminiService.runPrompt(activeVariant.content, activeVariant.config, vars);
    return output;
  };

  const optimizePrompt = async () => {
    if (!activeVariant || !activeVariant.content.trim()) return null;

    const optimizedContent = await GeminiService.optimizePrompt(activeVariant.content);
    return optimizedContent;
  };

  const generatePromptStructure = async (description: string) => {
    if (!description.trim()) return null;

    const result = await GeminiService.generatePromptStructure(description);
    return result;
  };

  return {
    runPrompt,
    optimizePrompt,
    generatePromptStructure
  };
}
