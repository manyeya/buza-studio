import { useAtom } from 'jotai';
import { activePromptIdAtom, promptsAtom } from '../store/atoms';
import { useVariantQueries } from './useVariantQueries';
import { useProjectQueries, convertProjectToPromptData } from './useProjectQueries';
import { PromptVariant, PromptVersion } from '../../types';

export function useVariants() {
  const [activePromptId] = useAtom(activePromptIdAtom);
  const [prompts] = useAtom(promptsAtom);

  const { projectsQuery } = useProjectQueries();
  const {
    useVariant: useVariantQuery,
    createVariant,
    isCreatingVariant,
    updateVariant: updateVariantQuery,
    isUpdatingVariant,
    deleteVariant,
    isDeletingVariant
  } = useVariantQueries();

  const activePrompt = prompts.find(p => p.id === activePromptId);
  const activeVariant = activePrompt?.variants.find(v => v.id === activePrompt?.activeVariantId) || null;

  // Create a local version of the variant for editing
  const localVariant = useVariantQuery(activePrompt?.name || '', activeVariant?.name || '');

  const updateVariant = async (variantUpdates: Partial<PromptVariant>) => {
    if (!activePrompt || !activeVariant) return;

    if (variantUpdates.name && variantUpdates.name !== activeVariant.name) {
      // Rename variant
      try {
        await createVariant({
          projectName: activePrompt.name,
          variantName: variantUpdates.name,
          content: variantUpdates.content || activeVariant.content,
          metadata: {
            model: variantUpdates.config?.model || activeVariant.config.model,
            temperature: variantUpdates.config?.temperature || activeVariant.config.temperature,
            maxTokens: variantUpdates.config?.maxOutputTokens,
            topK: variantUpdates.config?.topK,
            systemInstruction: variantUpdates.config?.systemInstruction,
            variables: variantUpdates.variables || activeVariant.variables
          }
        });

        await deleteVariant({
          projectName: activePrompt.name,
          variantName: activeVariant.name
        });

        // Incrementally update local state until query invalidates
        const updatedVariants = activePrompt.variants.map(v =>
          v.id === activeVariant.id ? { ...activeVariant, ...variantUpdates } : v
        );
        
        // Note: This will be replaced by query invalidation
      } catch (error) {
        console.error('[Rename Variant] Error:', error);
      }
    } else {
      // Update existing variant
      await updateVariantQuery({
        projectName: activePrompt.name,
        variantName: activeVariant.name,
        content: variantUpdates.content || activeVariant.content,
        metadata: {
          model: variantUpdates.config?.model || activeVariant.config.model,
          temperature: variantUpdates.config?.temperature || activeVariant.config.temperature,
          maxTokens: variantUpdates.config?.maxOutputTokens,
          topK: variantUpdates.config?.topK,
          systemInstruction: variantUpdates.config?.systemInstruction,
          variables: variantUpdates.variables || activeVariant.variables
        }
      });

      // For immediate UI update until query invalidates
      // This will show optimistic updates
    }
  };

  const saveVariant = async () => {
    if (!activePrompt || !activeVariant) return;

    await updateVariantQuery({
      projectName: activePrompt.name,
      variantName: activeVariant.name,
      content: activeVariant.content,
      metadata: {
        model: activeVariant.config.model,
        temperature: activeVariant.config.temperature,
        maxTokens: activeVariant.config.maxOutputTokens,
        topK: activeVariant.config.topK,
        systemInstruction: activeVariant.config.systemInstruction,
        variables: activeVariant.variables
      }
    });
  };

  const addVariant = async () => {
    if (!activePrompt || !activeVariant) return;

    const newName = `${activeVariant.name} (Copy)`;
    await createVariant({
      projectName: activePrompt.name,
      variantName: newName,
      content: activeVariant.content,
      metadata: {
        model: activeVariant.config.model,
        temperature: activeVariant.config.temperature,
        maxTokens: activeVariant.config.maxOutputTokens,
        topK: activeVariant.config.topK,
        systemInstruction: activeVariant.config.systemInstruction,
        variables: activeVariant.variables
      }
    });
  };

  const deleteVariantById = async (variantId: string) => {
    if (!activePrompt) return;
    if (activePrompt.variants.length <= 1) {
      alert("Cannot delete the last variant.");
      return;
    }

    const variantToDelete = activePrompt.variants.find(v => v.id === variantId);
    if (!variantToDelete) return;

    await deleteVariant({
      projectName: activePrompt.name,
      variantName: variantToDelete.name
    });
  };

  const saveVersion = async (name: string) => {
    if (!activeVariant) return;

    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      name: name || `Version ${activeVariant.versions.length + 1}`,
      timestamp: Date.now(),
      content: activeVariant.content,
      config: JSON.parse(JSON.stringify(activeVariant.config)),
      variables: JSON.parse(JSON.stringify(activeVariant.variables))
    };

    await updateVariant({
      versions: [newVersion, ...activeVariant.versions]
    });
  };

  const restoreVersion = async (version: PromptVersion) => {
    await updateVariant({
      content: version.content,
      config: JSON.parse(JSON.stringify(version.config)),
      variables: JSON.parse(JSON.stringify(version.variables))
    });
  };

  return {
    activeVariant,
    updateVariant,
    saveVariant,
    addVariant: addVariant,
    deleteVariant: deleteVariantById,
    saveVersion,
    restoreVersion,
    isCreatingVariant,
    isUpdatingVariant,
    isDeletingVariant
  };
}
