import React from 'react';
import { useAtom } from 'jotai';
import Sidebar from './src/components/Sidebar';
import PropertiesPanel from './src/components/PropertiesPanel';
import Workspace from './src/components/Workspace';
import TemplateLibraryModal from './src/components/TemplateLibraryModal';
import VariableLibraryModal from './src/components/VariableLibraryModal';
import SettingsModal from './src/components/SettingsModal';
import {
  activePromptIdAtom,
  isTemplateModalOpenAtom,
  isVariableLibraryOpenAtom,
  isSettingsModalOpenAtom
} from './src/atoms';
import { useBunApi } from './src/hooks/useBunApi';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useUpdateProjectVariables,
  useUpdateVariant,
  useAddVariant,
  useDeleteVariant,
  useDeleteProject,
  useSaveVersion,
  useRestoreVersion,
  useVariableLibrary,
  useAddToVariableLibrary,
  useRemoveFromVariableLibrary,
  useTemplateLibrary,
  useSaveAsTemplate,
  useRunPrompt,
  useOptimizePrompt,
  useGeneratePromptStructure
} from './src/hooks';
import { projectSystem } from './src/lib/project-system';
import type { PromptData, Variable, Template, PromptVariant, PromptVersion } from './types';

const App: React.FC = () => {
  // Jotai atoms for UI state
  const [activePromptId, setActivePromptId] = useAtom(activePromptIdAtom);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useAtom(isTemplateModalOpenAtom);
  const [isVariableLibraryOpen, setIsVariableLibraryOpen] = useAtom(isVariableLibraryOpenAtom);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useAtom(isSettingsModalOpenAtom);

  // React Query hooks for data
  const { data: prompts = [], isLoading } = useProjects();
  const { data: variableLibrary = [] } = useVariableLibrary();
  const { data: templates = [] } = useTemplateLibrary();

  // Mutation hooks
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const updateProjectVariables = useUpdateProjectVariables();
  const updateVariant = useUpdateVariant();
  const addVariant = useAddVariant();
  const deleteVariant = useDeleteVariant();
  const deleteProject = useDeleteProject();
  const saveVersion = useSaveVersion();
  const restoreVersion = useRestoreVersion();
  const addToVariableLibrary = useAddToVariableLibrary();
  const removeFromVariableLibrary = useRemoveFromVariableLibrary();
  const saveAsTemplate = useSaveAsTemplate();
  const runPrompt = useRunPrompt();
  const optimizePrompt = useOptimizePrompt();
  const generateStructure = useGeneratePromptStructure();

  // Bun API sidecar integration
  const { isReady: isBunApiReady, apiPort, fetchApi, error: bunApiError } = useBunApi();


  // Set initial active prompt when projects load
  React.useEffect(() => {
    if (prompts.length > 0 && !prompts.find(p => p.id === activePromptId)) {
      setActivePromptId(prompts[0].id);
    }
  }, [prompts, activePromptId, setActivePromptId]);

  // Computed values
  const activePrompt = prompts.find(p => p.id === activePromptId) || null;
  const activeVariant = activePrompt?.variants.find(v => v.id === activePrompt.activeVariantId) || null;

  // Event handlers
  const handleSelectPrompt = (id: string) => {
    setActivePromptId(id);
  };

  const handleNewPrompt = () => {
    createProject.mutate(undefined, {
      onSuccess: () => {
        setActivePromptId(prompts[prompts.length - 1].id);
      }
    });
  };

  const handleCreateFromTemplate = async (template: Template) => {
    const newName = template.name;
    await projectSystem.createProject(newName);
    await projectSystem.createVariant(
      newName,
      'Main',
      template.content,
      {
        model: template.config.model,
        temperature: template.config.temperature,
        topK: template.config.topK,
        maxTokens: template.config.maxOutputTokens,
        systemInstruction: template.config.systemInstruction,
        variables: template.variables.map(v => ({
          id: crypto.randomUUID(),
          key: v.key,
          value: v.value
        }))
      }
    );
    if (template.projectVariables?.length) {
      await projectSystem.updateProjectVariables(
        newName,
        template.projectVariables.map(v => ({
          id: crypto.randomUUID(),
          key: v.key,
          value: v.value
        }))
      );
    }
    setIsTemplateModalOpen(false);
  };

  const handleSaveAsTemplate = () => {
    if (!activePrompt || !activeVariant) return;
    const newTemplate: Template = {
      name: activePrompt.name,
      description: activePrompt.description,
      content: activeVariant.content,
      config: activeVariant.config,
      variables: activeVariant.variables.map(v => ({ key: v.key, value: v.value })),
      projectVariables: activePrompt.projectVariables?.map(v => ({ key: v.key, value: v.value })) || []
    };
    saveAsTemplate.mutate(newTemplate);
  };

  const handleAddToLibrary = (variable: Variable) => {
    addToVariableLibrary.mutate(variable);
  };

  const handleRemoveFromLibrary = (id: string) => {
    removeFromVariableLibrary.mutate(id);
  };

  const handleImportVariable = (variable: Variable) => {
    if (!activeVariant || !activePrompt) return;
    const exists = activeVariant.variables.some(v => v.key === variable.key);
    const updatedVars = exists
      ? activeVariant.variables.map(v =>
        v.key === variable.key ? { ...v, value: variable.value } : v
      )
      : [...activeVariant.variables, { id: crypto.randomUUID(), key: variable.key, value: variable.value }];

    updateVariant.mutate({
      projectName: activePrompt.name,
      variantName: activeVariant.name,
      variantId: activeVariant.id,
      updates: { variables: updatedVars }
    });
  };

  const handleUpdateProject = (updates: Partial<PromptData>) => {
    if (!activePrompt) return;
    updateProject.mutate({ currentName: activePrompt.name, updates });
  };

  const handleUpdateProjectVariables = (variables: Variable[]) => {
    if (!activePrompt) return;
    updateProjectVariables.mutate({ projectName: activePrompt.name, variables });
  };

  const handleInsertVariable = (variableKey: string) => {
    if (!activeVariant || !activePrompt) return;
    const variableText = `@{{${variableKey}}}`;
    const currentContent = activeVariant.content;
    const newContent = currentContent ? `${currentContent} ${variableText}` : variableText;
    updateVariant.mutate({
      projectName: activePrompt.name,
      variantName: activeVariant.name,
      variantId: activeVariant.id,
      updates: { content: newContent }
    });
  };

  const handleUpdateVariant = (updates: Partial<PromptVariant>) => {
    if (!activeVariant || !activePrompt) return;
    updateVariant.mutate({
      projectName: activePrompt.name,
      variantName: activeVariant.name,
      variantId: activeVariant.id,
      updates
    });
  };

  const handleSaveVariant = () => {
    if (!activeVariant || !activePrompt) return;
    updateVariant.mutate({
      projectName: activePrompt.name,
      variantName: activeVariant.name,
      variantId: activeVariant.id,
      updates: {}
    });
  };

  const handleAddVariant = () => {
    if (!activePrompt) return;
    addVariant.mutate({
      projectName: activePrompt.name,
      baseVariant: activePrompt.variants[0]
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    if (!activePrompt) return;
    if (activePrompt.variants.length <= 1) {
      alert('Cannot delete the last variant.');
      return;
    }
    const variantToDelete = activePrompt.variants.find(v => v.id === variantId);
    if (!variantToDelete) return;
    deleteVariant.mutate({ projectName: activePrompt.name, variantName: variantToDelete.name });
  };

  const handleSaveVersion = (name: string) => {
    if (!activeVariant || !activePrompt) return;
    saveVersion.mutate({ projectName: activePrompt.name, variant: activeVariant, versionName: name });
  };

  const handleRestoreVersion = (version: PromptVersion) => {
    if (!activeVariant || !activePrompt) return;
    restoreVersion.mutate({ projectName: activePrompt.name, variant: activeVariant, version });
  };

  // Modal handlers
  const openTemplateModal = () => setIsTemplateModalOpen(true);
  const closeTemplateModal = () => setIsTemplateModalOpen(false);
  const openVariableLibrary = () => setIsVariableLibraryOpen(true);
  const closeVariableLibrary = () => setIsVariableLibraryOpen(false);
  const openSettings = () => setIsSettingsModalOpen(true);
  const closeSettings = () => setIsSettingsModalOpen(false);

  const handleRunPrompt = () => {
    if (!activeVariant || !activePrompt) return;
    runPrompt.mutate({
      variant: activeVariant,
      projectVariables: activePrompt.projectVariables || []
    });
  };

  const handleOptimizePrompt = () => {
    if (!activeVariant) return;
    optimizePrompt.mutate({ variant: activeVariant });
  };

  const handleGenerateStructure = (description: string) => {
    if (!activeVariant) return;
    generateStructure.mutate({ description, variant: activeVariant });
  };

  const handleDeleteProject = (projectName: string) => {
    const isActiveProject = activePrompt?.name === projectName;
    const confirmMessage = isActiveProject
      ? `Are you sure you want to delete "${projectName}"? This is your currently active project and cannot be undone.`
      : `Are you sure you want to delete "${projectName}"? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      deleteProject.mutate(projectName);
    }
  };



  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading projects...</div>
          <div className="text-muted-foreground text-sm">Initializing file system</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans antialiased selection:bg-primary selection:text-primary-foreground" style={{ height: '100vh' }}>
      <div className="flex w-full h-full">
        <Sidebar
          prompts={prompts}
          activePromptId={activePromptId}
          onSelectPrompt={handleSelectPrompt}
          onNewPrompt={handleNewPrompt}
          onOpenTemplates={openTemplateModal}
          onUpdateProjectVariables={handleUpdateProjectVariables}
          onInsertVariable={handleInsertVariable}
          onDeleteProject={handleDeleteProject}
          onOpenSettings={openSettings}
        />

        {activePrompt && activeVariant ? (
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Select or create a prompt</div>
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

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={closeSettings}
            serverStatus={{
              isReady: isBunApiReady,
              port: apiPort,
              error: bunApiError
            }}
          />
        )}
      </div>
    </div>
  );
};

export default App;
