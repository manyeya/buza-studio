
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Workspace from './components/Workspace';
import TemplateLibraryModal from './components/TemplateLibraryModal';
import VariableLibraryModal from './components/VariableLibraryModal';
import { PromptData, Template, PromptVersion, PromptVariant, Variable } from './types';
import { TEMPLATES } from './data/templates';

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
            systemInstruction: 'You are a creative writer.'
        },
        variables: [
            { id: 'v1', key: 'topic', value: 'a space cat' },
            { id: 'v2', key: 'tone', value: 'humorous' }
        ],
        versions: []
    }
  ]
};

const INITIAL_VARS: Variable[] = [
    { id: 'glob-1', key: 'tone', value: 'Professional' },
    { id: 'glob-2', key: 'audience', value: 'Experts' },
    { id: 'glob-3', key: 'output_format', value: 'JSON' }
];

const App: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptData[]>([INITIAL_PROMPT]);
  const [activePromptId, setActivePromptId] = useState<string>('1');
  
  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isVariableLibraryOpen, setIsVariableLibraryOpen] = useState(false);
  
  // Libraries
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [variableLibrary, setVariableLibrary] = useState<Variable[]>(INITIAL_VARS);

  // Load and Migrate Data
  useEffect(() => {
    const savedPrompts = localStorage.getItem('promptStudio_data');
    if (savedPrompts) {
      try {
        const parsed = JSON.parse(savedPrompts);
        if (Array.isArray(parsed) && parsed.length > 0) {
            // Migration Strategy: Check if old structure (no variants)
            const migrated = parsed.map((p: any) => {
                if (!p.variants) {
                    // Migrate old data to new structure
                    const variantId = 'default-v';
                    return {
                        id: p.id,
                        name: p.name,
                        description: p.description || '',
                        activeVariantId: variantId,
                        variants: [{
                            id: variantId,
                            name: 'Main',
                            content: p.content,
                            config: p.config,
                            variables: p.variables || [],
                            versions: p.versions || [],
                            lastOutput: p.lastOutput,
                            lastRunTime: p.lastRunTime
                        }]
                    } as PromptData;
                }
                return p as PromptData;
            });
            setPrompts(migrated);
            setActivePromptId(migrated[0].id);
        }
      } catch (e) {
        console.error("Failed to load saved prompts", e);
      }
    }

    const savedTemplates = localStorage.getItem('promptStudio_templates');
    if (savedTemplates) {
      try {
        const parsedTemplates = JSON.parse(savedTemplates);
        if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
            setTemplates(parsedTemplates);
        }
      } catch (e) {
        console.error("Failed to load saved templates", e);
      }
    }

    const savedVars = localStorage.getItem('promptStudio_vars');
    if (savedVars) {
        try {
            const parsedVars = JSON.parse(savedVars);
            if (Array.isArray(parsedVars)) setVariableLibrary(parsedVars);
        } catch (e) {
            console.error("Failed to load variables", e);
        }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('promptStudio_data', JSON.stringify(prompts));
  }, [prompts]);

  useEffect(() => {
    localStorage.setItem('promptStudio_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('promptStudio_vars', JSON.stringify(variableLibrary));
  }, [variableLibrary]);

  const activePrompt = prompts.find(p => p.id === activePromptId) || prompts[0];
  const activeVariant = activePrompt?.variants.find(v => v.id === activePrompt.activeVariantId) || activePrompt?.variants[0];

  const handleSelectPrompt = (id: string) => {
    setActivePromptId(id);
  };

  const handleUpdateProject = (updated: Partial<PromptData>) => {
      setPrompts(prev => prev.map(p => p.id === activePromptId ? { ...p, ...updated } : p));
  };

  const handleUpdateVariant = (variantUpdates: Partial<PromptVariant>) => {
      if (!activePrompt || !activeVariant) return;

      const updatedVariants = activePrompt.variants.map(v => 
          v.id === activeVariant.id ? { ...v, ...variantUpdates } : v
      );
      
      handleUpdateProject({ variants: updatedVariants });
  };

  const handleAddVariant = () => {
      if (!activePrompt || !activeVariant) return;
      const newVariantId = crypto.randomUUID();
      const newVariant: PromptVariant = {
          ...JSON.parse(JSON.stringify(activeVariant)), // Deep copy current
          id: newVariantId,
          name: `${activeVariant.name} (Copy)`,
          versions: [], // Reset history for new variant
          lastOutput: undefined,
          lastRunTime: undefined
      };
      
      handleUpdateProject({
          variants: [...activePrompt.variants, newVariant],
          activeVariantId: newVariantId
      });
  };

  const handleDeleteVariant = (variantId: string) => {
      if (!activePrompt) return;
      if (activePrompt.variants.length <= 1) {
          alert("Cannot delete the last variant.");
          return;
      }
      
      const newVariants = activePrompt.variants.filter(v => v.id !== variantId);
      let newActiveId = activePrompt.activeVariantId;
      
      if (activePrompt.activeVariantId === variantId) {
          newActiveId = newVariants[0].id;
      }
      
      handleUpdateProject({
          variants: newVariants,
          activeVariantId: newActiveId
      });
  };

  const handleNewPrompt = () => {
    const newId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const newPrompt: PromptData = {
        id: newId,
        name: 'Untitled Prompt',
        description: '',
        activeVariantId: variantId,
        variants: [{
            id: variantId,
            name: 'Main',
            content: '',
            config: {
                model: 'gemini-2.5-flash',
                temperature: 0.7,
                topK: 40
            },
            variables: [],
            versions: []
        }]
    };
    setPrompts([...prompts, newPrompt]);
    setActivePromptId(newId);
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
        }]
    };
    setPrompts([...prompts, newPrompt]);
    setActivePromptId(newId);
    setIsTemplateModalOpen(false);
  };

  const handleSaveAsTemplate = () => {
    if (!activePrompt || !activeVariant) return;
    const newTemplate: Template = {
        name: activePrompt.name,
        description: activePrompt.description,
        content: activeVariant.content,
        config: activeVariant.config,
        variables: activeVariant.variables.map(v => ({ key: v.key, value: v.value }))
    };
    setTemplates([newTemplate, ...templates]);
  };

  const handleSaveVersion = (name: string) => {
      if (!activeVariant) return;

      const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          name: name || `Version ${activeVariant.versions.length + 1}`,
          timestamp: Date.now(),
          content: activeVariant.content,
          config: JSON.parse(JSON.stringify(activeVariant.config)),
          variables: JSON.parse(JSON.stringify(activeVariant.variables))
      };

      handleUpdateVariant({
          versions: [newVersion, ...activeVariant.versions]
      });
  };

  const handleRestoreVersion = (version: PromptVersion) => {
      handleUpdateVariant({
          content: version.content,
          config: JSON.parse(JSON.stringify(version.config)),
          variables: JSON.parse(JSON.stringify(version.variables))
      });
  };

  // Variable Library Handlers
  const handleAddToLibrary = (variable: Variable) => {
      // Check if key already exists to avoid dupes (optional, but good practice)
      const exists = variableLibrary.find(v => v.key === variable.key);
      if (exists) {
          const confirmUpdate = window.confirm(`Variable "{{${variable.key}}}" already exists. Update it?`);
          if (confirmUpdate) {
              setVariableLibrary(prev => prev.map(v => v.key === variable.key ? { ...v, value: variable.value } : v));
          }
      } else {
          setVariableLibrary(prev => [...prev, { ...variable, id: crypto.randomUUID() }]);
      }
  };

  const handleRemoveFromLibrary = (id: string) => {
      setVariableLibrary(prev => prev.filter(v => v.id !== id));
  };

  const handleImportVariable = (variable: Variable) => {
      if (!activeVariant) return;
      // Check if variant already has this key
      const exists = activeVariant.variables.some(v => v.key === variable.key);
      if (exists) {
         // Maybe just update the value? Or warn? Let's just update value for now.
         const updatedVars = activeVariant.variables.map(v => v.key === variable.key ? { ...v, value: variable.value } : v);
         handleUpdateVariant({ variables: updatedVars });
      } else {
          const newVar = { id: crypto.randomUUID(), key: variable.key, value: variable.value };
          handleUpdateVariant({ variables: [...activeVariant.variables, newVar] });
      }
  };

  return (
    <div className="flex h-screen w-screen bg-figma-bg text-white overflow-hidden font-sans antialiased selection:bg-figma-accent selection:text-white">
      <Sidebar 
        prompts={prompts}
        activePromptId={activePromptId}
        onSelectPrompt={handleSelectPrompt}
        onNewPrompt={handleNewPrompt}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
      />

      {activePrompt && activeVariant ? (
         <>
            <Workspace 
                variant={activeVariant}
                projectName={activePrompt.name}
                onUpdateVariant={handleUpdateVariant}
                onUpdateProject={handleUpdateProject}
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
                onOpenVariableLibrary={() => setIsVariableLibraryOpen(true)}
                onSaveVariableToLibrary={handleAddToLibrary}
            />
         </>
      ) : (
         <div className="flex-1 flex items-center justify-center text-figma-muted">Select or create a prompt</div>
      )}

      {isTemplateModalOpen && (
          <TemplateLibraryModal 
            templates={templates}
            onClose={() => setIsTemplateModalOpen(false)}
            onSelect={handleCreateFromTemplate}
          />
      )}

      {isVariableLibraryOpen && (
          <VariableLibraryModal 
            library={variableLibrary}
            onClose={() => setIsVariableLibraryOpen(false)}
            onImport={handleImportVariable}
            onAddToLibrary={handleAddToLibrary}
            onRemoveFromLibrary={handleRemoveFromLibrary}
          />
      )}
    </div>
  );
};

export default App;
