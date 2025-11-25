import React, { useState, useEffect } from 'react';
import Sidebar from './src/components/Sidebar';
import PropertiesPanel from './src/components/PropertiesPanel';
import Workspace from './src/components/Workspace';
import TemplateLibraryModal from './src/components/TemplateLibraryModal';
import VariableLibraryModal from './src/components/VariableLibraryModal';
import { projectSystem } from './src/lib/project-system';
import * as GeminiService from './services/geminiService';
import type { Project } from './src/lib/project-system';
import type { PromptData, Variable, Template, PromptVariant, PromptVersion } from './types';

const INITIAL_PROMPT: PromptData = {
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

const INITIAL_VARS: Variable[] = [
  { id: 'glob-1', key: 'tone', value: 'Professional' },
  { id: 'glob-2', key: 'audience', value: 'Experts' },
  { id: 'glob-3', key: 'output_format', value: 'JSON' }
];

function convertProjectToPromptData(project: Project): PromptData {
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

const App: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptData[]>([INITIAL_PROMPT]);
  const [activePromptId, setActivePromptId] = useState<string>('1');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isVariableLibraryOpen, setIsVariableLibraryOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variableLibrary, setVariableLibrary] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and Load Projects from File System
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        await projectSystem.initialize();

        const projectNames = await projectSystem.listProjects();

        if (projectNames.length > 0) {
          const loadedProjects = await Promise.all(
            projectNames.map(name => projectSystem.getProject(name))
          );
          const promptsData = loadedProjects.map(project => convertProjectToPromptData(project));
          setPrompts(promptsData);
          setActivePromptId(promptsData[0].id);
        } else {
          await projectSystem.createProject('Story Generator');
          await projectSystem.createVariant(
            'Story Generator',
            'Main',
            'Write a creative short story about {{topic}}. The tone should be {{tone}}.',
            {
              model: 'gemini-2.5-flash',
              temperature: 0.7,
              topK: 40,
              systemInstruction: '',
              variables: [
                { id: 'v1', key: 'topic', value: 'a space cat' },
                { id: 'v2', key: 'tone', value: 'humorous' }
              ]
            }
          );

          const project = await projectSystem.getProject('Story Generator');
          const promptData = convertProjectToPromptData(project);
          setPrompts([promptData]);
          setActivePromptId(promptData.id);
        }

        // Load variable library from file system
        const vars = await projectSystem.getVariableLibrary();
        setVariableLibrary(vars);

        // Load template library from file system
        const tmpl = await projectSystem.getTemplateLibrary();
        setTemplates(tmpl);
      } catch (error) {
        console.error('Failed to initialize file system:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFileSystem();
  }, []);

  // Get computed values
  const activePrompt = prompts.find(p => p.id === activePromptId) || null;
  const activeVariant = activePrompt?.variants.find(v => v.id === activePrompt.activeVariantId) || null;

  // No need for localStorage sync - everything uses file system now

  // Event handlers
  const handleSelectPrompt = (id: string) => {
    setActivePromptId(id);
  };

  const handleNewPrompt = async () => {
    const newName = `Untitled Prompt ${Date.now()}`;
    await projectSystem.createProject(newName);
    await projectSystem.createVariant(
      newName,
      'Main',
      '',
      {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        topK: 40,
        variables: []
      }
    );

    const project = await projectSystem.getProject(newName);
    const promptData = convertProjectToPromptData(project);
    setPrompts(prev => [...prev, promptData]);
    setActivePromptId(promptData.id);
  };

  const handleCreateFromTemplate = (template: Template) => {
    const newId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const newPrompt: PromptData = {
      id: newId,
      name: template.name,
      description: template.description,
      activeVariantId: variantId,
      variants: [{
        id: variantId,
        name: 'Main',
        content: template.content,
        config: template.config,
        variables: template.variables.map(v => ({
          id: crypto.randomUUID(),
          key: v.key,
          value: v.value
        })),
        versions: []
      }],
      projectVariables: template.projectVariables?.map(v => ({
        id: crypto.randomUUID(),
        key: v.key,
        value: v.value
      })) || []
    };
    setPrompts([...prompts, newPrompt]);
    setActivePromptId(newId);
    setIsTemplateModalOpen(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!activePrompt || !activeVariant) return;
    const newTemplate: Template = {
      name: activePrompt.name,
      description: activePrompt.description,
      content: activeVariant.content,
      config: activeVariant.config,
      variables: activeVariant.variables.map(v => ({ key: v.key, value: v.value })),
      projectVariables: activePrompt.projectVariables?.map(v => ({ key: v.key, value: v.value })) || []
    };
    const updated = [newTemplate, ...templates];
    await projectSystem.updateTemplateLibrary(updated);
    setTemplates(updated);
  };

  const handleAddToLibrary = async (variable: Variable) => {
    const existing = variableLibrary.find(v => v.key === variable.key);
    if (existing) {
      const confirmUpdate = window.confirm(`Variable "{{${variable.key}}}" already exists. Update it?`);
      if (confirmUpdate) {
        const updated = variableLibrary.map(v => v.key === variable.key ? { ...v, value: variable.value } : v);
        await projectSystem.updateVariableLibrary(updated);
        setVariableLibrary(updated);
      }
    } else {
      const newVar = { ...variable, id: crypto.randomUUID() };
      const updated = [...variableLibrary, newVar];
      await projectSystem.updateVariableLibrary(updated);
      setVariableLibrary(updated);
    }
  };

  const handleRemoveFromLibrary = async (id: string) => {
    const updated = variableLibrary.filter(v => v.id !== id);
    await projectSystem.updateVariableLibrary(updated);
    setVariableLibrary(updated);
  };

  const handleImportVariable = async (variable: Variable) => {
    if (!activeVariant) return;
    const exists = activeVariant.variables.some(v => v.key === variable.key);
    if (exists) {
      const updatedVars = activeVariant.variables.map(v =>
        v.key === variable.key ? { ...v, value: variable.value } : v
      );

      await handleUpdateVariant({ variables: updatedVars });
    } else {
      const newVar = { id: crypto.randomUUID(), key: variable.key, value: variable.value };

      await handleUpdateVariant({ variables: [...activeVariant.variables, newVar] });
    }
  };

  // Missing handler functions that components need
  const handleUpdateProject = async (updates: Partial<PromptData>) => {
    if (!activePrompt) return;

    if (updates.name && updates.name !== activePrompt.name) {
      // Rename project
      await projectSystem.createProject(updates.name);
      const existingProject = await projectSystem.getProject(activePrompt.name);

      // Copy all variants to new project
      for (const variant of existingProject.variants) {
        await projectSystem.createVariant(
          updates.name,
          variant.name,
          variant.content,
          variant.metadata
        );
      }

      await projectSystem.deleteProject(activePrompt.name);

      const newProject = await projectSystem.getProject(updates.name);
      const updatedPrompt = convertProjectToPromptData(newProject);
      setPrompts(prev => prev.map(p =>
        p.id === activePromptId ? { ...updatedPrompt, name: updates.name } : p
      ));
      setActivePromptId(updatedPrompt.id);
    } else {
      // Update description or other fields
      if (updates.description !== undefined) {
        await projectSystem.updateProjectDescription(activePrompt.name, updates.description);
      }

      setPrompts(prev => prev.map(p =>
        p.id === activePromptId ? { ...p, ...updates } : p
      ));
    }
  };

  const handleUpdateProjectVariables = async (variables: Variable[]) => {
    if (!activePrompt) return;
    await projectSystem.updateProjectVariables(activePrompt.name, variables);

    // Update local state
    setPrompts(prev => prev.map(p =>
      p.id === activePromptId ? { ...p, projectVariables: variables } : p
    ));
  };

  const handleInsertVariable = (variableKey: string) => {
    if (!activeVariant) return;
    const variableText = `@{{${variableKey}}}`;
    const currentContent = activeVariant.content;
    const newContent = currentContent ? `${currentContent} ${variableText}` : variableText;
    handleUpdateVariant({ content: newContent });
  };

  const handleUpdateVariant = async (updates: Partial<PromptVariant>) => {
    if (!activeVariant || !activePrompt) return;

    // Find the current variant and update it
    const updatedVariant = { ...activeVariant, ...updates };

    // If renaming variant, we need to delete and recreate
    if (updates.name && updates.name !== activeVariant.name) {
      await projectSystem.createVariant(
        activePrompt.name,
        updates.name,
        updatedVariant.content,
        {
          model: updatedVariant.config.model,
          temperature: updatedVariant.config.temperature,
          maxTokens: updatedVariant.config.maxOutputTokens,
          topK: updatedVariant.config.topK,
          systemInstruction: updatedVariant.config.systemInstruction,
          variables: updatedVariant.variables
        }
      );

      await projectSystem.deleteVariant(activePrompt.name, activeVariant.name);

      // Update local state
      const updatedPrompt = {
        ...activePrompt,
        variants: activePrompt.variants.map(v =>
          v.id === activeVariant.id ? { ...updatedVariant, name: updates.name } : v
        )
      };

      setPrompts(prev => prev.map(p =>
        p.id === activePromptId ? updatedPrompt : p
      ));
    } else {
      // Just update content/config/variables
      await projectSystem.updateVariant(
        activePrompt.name,
        activeVariant.name,
        updatedVariant.content,
        {
          model: updatedVariant.config.model,
          temperature: updatedVariant.config.temperature,
          maxTokens: updatedVariant.config.maxOutputTokens,
          topK: updatedVariant.config.topK,
          systemInstruction: updatedVariant.config.systemInstruction,
          variables: updatedVariant.variables
        }
      );

      // Update local state
      setPrompts(prev => prev.map(p =>
        p.id === activePromptId ? {
          ...p,
          variants: p.variants.map(v =>
            v.id === activeVariant.id ? updatedVariant : v
          )
        } : p
      ));
    }
  };

  const handleSaveVariant = async () => {
    if (!activeVariant || !activePrompt) return;

    await projectSystem.updateVariant(
      activePrompt.name,
      activeVariant.name,
      activeVariant.content,
      {
        model: activeVariant.config.model,
        temperature: activeVariant.config.temperature,
        maxTokens: activeVariant.config.maxOutputTokens,
        topK: activeVariant.config.topK,
        systemInstruction: activeVariant.config.systemInstruction,
        variables: activeVariant.variables
      }
    );
  };

  const handleAddVariant = async () => {
    if (!activePrompt) return;

    const newName = `${activePrompt.variants[0]?.name || 'Main'} (Copy)`;

    await projectSystem.createVariant(
      activePrompt.name,
      newName,
      activePrompt.variants[0]?.content || '',
      {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        topK: 40,
        variables: []
      }
    );

    const project = await projectSystem.getProject(activePrompt.name);
    const updatedPrompt = convertProjectToPromptData(project);
    setPrompts(prev => prev.map(p => p.id === activePromptId ? updatedPrompt : p));
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!activePrompt) return;
    if (activePrompt.variants.length <= 1) {
      alert('Cannot delete the last variant.');
      return;
    }

    const variantToDelete = activePrompt.variants.find(v => v.id === variantId);
    if (!variantToDelete) return;

    await projectSystem.deleteVariant(activePrompt.name, variantToDelete.name);

    const project = await projectSystem.getProject(activePrompt.name);
    const updatedPrompt = convertProjectToPromptData(project);
    setPrompts(prev => prev.map(p => p.id === activePromptId ? updatedPrompt : p));
  };

  const handleSaveVersion = async (name: string) => {
    if (!activeVariant) return;

    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      name: name || `Version ${activeVariant.versions.length + 1}`,
      timestamp: Date.now(),
      content: activeVariant.content,
      config: JSON.parse(JSON.stringify(activeVariant.config)),
      variables: JSON.parse(JSON.stringify(activeVariant.variables))
    };

    await handleUpdateVariant({
      versions: [newVersion, ...activeVariant.versions]
    });
  };

  const handleRestoreVersion = async (version: PromptVersion) => {
    await handleUpdateVariant({
      content: version.content,
      config: JSON.parse(JSON.stringify(version.config)),
      variables: JSON.parse(JSON.stringify(version.variables))
    });
  };

  // Modal handlers
  const openTemplateModal = () => setIsTemplateModalOpen(true);
  const closeTemplateModal = () => setIsTemplateModalOpen(false);
  const openVariableLibrary = () => setIsVariableLibraryOpen(true);
  const closeVariableLibrary = () => setIsVariableLibraryOpen(false);

  const handleRunPrompt = async () => {
    if (!activeVariant || !activePrompt) return;

    // Merge variables: project variables as base, variant variables override
    const vars: Record<string, string> = {};

    // Add project variables first
    activePrompt.projectVariables?.forEach(v => {
      vars[v.key] = v.value;
    });

    // Add/override with variant variables
    activeVariant.variables.forEach(v => {
      vars[v.key] = v.value;
    });

    const output = await GeminiService.runPrompt(activeVariant.content, activeVariant.config, vars);
    await handleUpdateVariant({
      lastOutput: output,
      lastRunTime: Date.now()
    });
  };

  const handleOptimizePrompt = async () => {
    if (!activeVariant) return;

    const optimizedContent = await GeminiService.optimizePrompt(activeVariant.content);
    if (optimizedContent) {
      await handleUpdateVariant({ content: optimizedContent });
    }
  };

  const handleGenerateStructure = async (description: string) => {
    const result = await GeminiService.generatePromptStructure(description);
    if (result) {
      await handleUpdateVariant({
        content: result.content,
        config: {
          ...activeVariant!.config,
          systemInstruction: result.systemInstruction || '',
          model: result.model || activeVariant!.config.model
        },
        variables: result.variables.map(v => ({
          id: crypto.randomUUID(),
          key: v.key,
          value: v.value
        }))
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-figma-bg text-white items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading projects...</div>
          <div className="text-figma-muted text-sm">Initializing file system</div>
        </div>
      </div>
    );
  }

  // Temporary debug fallback
  const showWorkspaceAnyway = prompts.length > 0; // Temporarily show workspace if we have projects

  return (
    <div className="flex h-screen w-screen bg-figma-bg text-white overflow-hidden font-sans antialiased selection:bg-figma-accent selection:text-white">
      <Sidebar
        prompts={prompts}
        activePromptId={activePromptId}
        onSelectPrompt={handleSelectPrompt}
        onNewPrompt={handleNewPrompt}
        onOpenTemplates={openTemplateModal}
        onUpdateProjectVariables={handleUpdateProjectVariables}
        onInsertVariable={handleInsertVariable}
      />

      {(activePrompt && activeVariant) || showWorkspaceAnyway ? (
        <>
          <Workspace
            variant={activeVariant}
            projectName={activePrompt.name}
            onUpdateVariant={handleUpdateVariant}
            onUpdateProject={handleUpdateProject}
            onSave={handleSaveVariant}
            onRun={handleRunPrompt}
            onOptimize={handleOptimizePrompt}
            onGenerateStructure={handleGenerateStructure}
          />
          <PropertiesPanel
            prompt={activePrompt}
            activeVariant={activeVariant}
            onUpdateVariant={handleUpdateVariant}
            onUpdateProject={handleUpdateProject}
            onAddVariant={handleAddVariant}
            onDeleteVariant={handleDeleteVariant}
            onSaveAsTemplate={handleSaveAsTemplate}
            onSaveVersion={handleSaveVersion}
            onRestoreVersion={handleRestoreVersion}
            onOpenVariableLibrary={openVariableLibrary}
            onSaveVariableToLibrary={handleAddToLibrary}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-figma-muted">Select or create a prompt</div>
      )}

      {isTemplateModalOpen && (
        <TemplateLibraryModal
          templates={templates}
          onClose={closeTemplateModal}
          onSelect={handleCreateFromTemplate}
        />
      )}

      {isVariableLibraryOpen && (
        <VariableLibraryModal
          library={variableLibrary}
          onClose={closeVariableLibrary}
          onImport={handleImportVariable}
          onAddToLibrary={handleAddToLibrary}
          onRemoveFromLibrary={handleRemoveFromLibrary}
        />
      )}
    </div>
  );
};

export default App;
