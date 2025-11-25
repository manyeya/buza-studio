import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { projectSystem } from '../lib/project-system';
import { activePromptIdAtom, isLoadingAtom } from '../store/atoms';
import { useProjectQueries } from './useProjectQueries';
import type { PromptData } from '../../types';

export function useProjects() {
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);
  const [, setIsLoading] = useAtom(isLoadingAtom);

  const { projectsQuery, createProject, updateProject } = useProjectQueries();

  // Initialize file system and load projects on mount
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        // Initialize project system
        await projectSystem.initialize();

        // Check for localStorage data to migrate
        const savedPrompts = localStorage.getItem('promptStudio_data');
        if (savedPrompts) {
          try {
            const parsed = JSON.parse(savedPrompts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Migrate localStorage data to file system
              for (const prompt of parsed) {
                const projectName = prompt.name || 'Untitled';

                // Create project
                await projectSystem.createProject(projectName);

                // Create variants
                if (prompt.variants && Array.isArray(prompt.variants)) {
                  for (const variant of prompt.variants) {
                    await projectSystem.createVariant(
                      projectName,
                      variant.name,
                      variant.content,
                      {
                        model: variant.config?.model,
                        temperature: variant.config?.temperature,
                        maxTokens: variant.config?.maxOutputTokens,
                        topK: variant.config?.topK,
                        systemInstruction: variant.config?.systemInstruction,
                        variables: variant.variables || []
                      }
                    );
                  }
                }
              }

              // Clear localStorage after migration
              localStorage.removeItem('promptStudio_data');
              console.log('Migrated localStorage data to file system');
            }
          } catch (e) {
            console.error("Failed to migrate localStorage data", e);
          }
        }

        // Query will load the projects automatically through TanStack Query
        // Set first project as active if available
        if (projectsQuery.data && projectsQuery.data.length > 0) {
          setActivePromptId(projectsQuery.data[0].id);
        } else {
          // Create initial project if none exist
          await createInitialProject();
        }
      } catch (error) {
        console.error('Failed to initialize file system:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const createInitialProject = async () => {
      try {
        await projectSystem.createProject('Story Generator');
        await projectSystem.createVariant(
          'Story Generator',
          'Main',
          'Write a creative short story about {{topic}}. The tone should be {{tone}}.',
          {
            model: 'gemini-2.5-flash',
            temperature: 0.7,
            topK: 40,
            systemInstruction: 'You are a creative writer.',
            variables: [
              { id: 'v1', key: 'topic', value: 'a space cat' },
              { id: 'v2', key: 'tone', value: 'humorous' }
            ]
          }
        );
      } catch (error) {
        console.error('Failed to create initial project:', error);
      }
    };

    initializeFileSystem();
  }, []);

  // Set active prompt when projects load
  useEffect(() => {
    if (projectsQuery.data && projectsQuery.data.length > 0 && !activePromptId) {
      setActivePromptId(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, activePromptId, setActivePromptId]);

  const selectPrompt = (id: string) => {
    setActivePromptId(id);
  };

  const handleUpdatePrompt = async (updated: Partial<PromptData>) => {
    if (!activePromptId || !activePrompt) return;

    // If renaming project, use the query mutation
    if (updated.name && updated.name !== activePrompt.name) {
      await updateProject({
        oldName: activePrompt.name,
        newName: updated.name
      });
      setActivePromptId(updated.name);
    }

    // For other updates, they would be handled through individual variant updates
    // since PromptData is mostly derived from file system
  };

  const createNewPrompt = async () => {
    const newName = `Untitled Prompt ${Date.now()}`;
    try {
      await createProject({ name: newName, variantName: 'Main' });
      setActivePromptId(newName);
    } catch (error) {
      console.error('Failed to create new prompt:', error);
    }
  };

  const activePrompt = projectsQuery.data?.find(p => p.id === activePromptId);

  return {
    prompts: projectsQuery.data || [],
    activePrompt,
    activePromptId,
    isLoading: projectsQuery.isLoading,
    selectPrompt,
    updatePrompt: handleUpdatePrompt,
    createNewPrompt
  };
}
