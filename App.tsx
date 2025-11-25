import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Workspace from './components/Workspace';
import TemplateLibraryModal from './components/TemplateLibraryModal';
import VariableLibraryModal from './components/VariableLibraryModal';
import { projectSystem } from './src/lib/project-system';
import type { Project, Variant } from './src/lib/project-system';
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

/**
 * Convert Project (from file system) to PromptData (for UI)
 */
function convertProjectToPromptData(project: Project): PromptData {
    const variants: PromptVariant[] = project.variants.map((variant, index) => {
        // Ensure variables is always an array
        let variables: Variable[] = [];
        if (Array.isArray(variant.metadata.variables)) {
            variables = variant.metadata.variables;
        } else if (variant.metadata.variables && typeof variant.metadata.variables === 'object') {
            // Convert object to array if needed
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
                systemInstruction: variant.metadata.systemInstruction
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
        description: '',
        activeVariantId: variants[0]?.id || '',
        variants
    };
}

const App: React.FC = () => {
    const [prompts, setPrompts] = useState<PromptData[]>([INITIAL_PROMPT]);
    const [activePromptId, setActivePromptId] = useState<string>('1');

    // Modals
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isVariableLibraryOpen, setIsVariableLibraryOpen] = useState(false);

    // Libraries
    const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
    const [variableLibrary, setVariableLibrary] = useState<Variable[]>(INITIAL_VARS);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Initialize and Load Projects from File System
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

                // Load projects from file system
                const projectNames = await projectSystem.listProjects();

                if (projectNames.length > 0) {
                    // Load all projects
                    const loadedProjects = await Promise.all(
                        projectNames.map(name => projectSystem.getProject(name))
                    );

                    // Convert to PromptData format
                    const promptsData: PromptData[] = loadedProjects.map(project => convertProjectToPromptData(project));
                    setPrompts(promptsData);
                    setActivePromptId(promptsData[0].id);
                } else {
                    // No projects exist, create initial project
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

                    // Reload
                    const project = await projectSystem.getProject('Story Generator');
                    const promptData = convertProjectToPromptData(project);
                    setPrompts([promptData]);
                    setActivePromptId(promptData.id);
                }

                // Load templates and variables from localStorage (keep these for now)
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
            } catch (error) {
                console.error('Failed to initialize file system:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeFileSystem();
    }, []);

    // Keep localStorage sync for templates and variables
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

    const handleUpdateProject = async (updated: Partial<PromptData>) => {
        if (!activePrompt) return;

        // If renaming project, we need to rename the folder
        if (updated.name && updated.name !== activePrompt.name) {
            try {
                // Create new project with new name
                await projectSystem.createProject(updated.name);

                // Copy all variants to new project
                for (const variant of activePrompt.variants) {
                    await projectSystem.createVariant(
                        updated.name,
                        variant.name,
                        variant.content,
                        {
                            model: variant.config.model,
                            temperature: variant.config.temperature,
                            maxTokens: variant.config.maxOutputTokens,
                            topK: variant.config.topK,
                            systemInstruction: variant.config.systemInstruction,
                            variables: variant.variables
                        }
                    );
                }

                // Delete old project
                await projectSystem.deleteProject(activePrompt.name);

                // Update local state
                setPrompts(prev => prev.map(p =>
                    p.id === activePromptId ? { ...p, ...updated, id: updated.name } : p
                ));
                setActivePromptId(updated.name!);
            } catch (error) {
                console.error('[Rename Project] Error:', error);
            }
        } else {
            // Just update local state for other changes (like description)
            setPrompts(prev => prev.map(p => p.id === activePromptId ? { ...p, ...updated } : p));
        }
    };

    const handleUpdateVariant = async (variantUpdates: Partial<PromptVariant>) => {
        if (!activePrompt || !activeVariant) return;

        const updatedVariant = { ...activeVariant, ...variantUpdates };

        // If renaming variant, we need to rename the file
        if (variantUpdates.name && variantUpdates.name !== activeVariant.name) {
            try {
                // Create new variant file with new name
                await projectSystem.createVariant(
                    activePrompt.name,
                    variantUpdates.name,
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

                // Delete old variant file
                await projectSystem.deleteVariant(activePrompt.name, activeVariant.name);

                // Update local state
                const updatedVariants = activePrompt.variants.map(v =>
                    v.id === activeVariant.id ? updatedVariant : v
                );
                setPrompts(prev => prev.map(p =>
                    p.id === activePromptId ? { ...p, variants: updatedVariants } : p
                ));
            } catch (error) {
                console.error('[Rename Variant] Error:', error);
            }
        } else {
            // Just update local state for other changes
            const updatedVariants = activePrompt.variants.map(v =>
                v.id === activeVariant.id ? updatedVariant : v
            );
            setPrompts(prev => prev.map(p =>
                p.id === activePromptId ? { ...p, variants: updatedVariants } : p
            ));
        }
    };

    const handleSave = async () => {
        if (!activePrompt || !activeVariant) return;

        try {
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
        } catch (error) {
            console.error('[Save] Error:', error);
        }
    };

    const handleAddVariant = async () => {
        if (!activePrompt || !activeVariant) return;

        const newName = `${activeVariant.name} (Copy)`;

        // Create variant in file system
        await projectSystem.createVariant(
            activePrompt.name,
            newName,
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

        // Reload project
        const project = await projectSystem.getProject(activePrompt.name);
        const promptData = convertProjectToPromptData(project);
        setPrompts(prev => prev.map(p => p.id === activePromptId ? promptData : p));
    };

    const handleDeleteVariant = async (variantId: string) => {
        if (!activePrompt) return;
        if (activePrompt.variants.length <= 1) {
            alert("Cannot delete the last variant.");
            return;
        }

        const variantToDelete = activePrompt.variants.find(v => v.id === variantId);
        if (!variantToDelete) return;

        // Delete from file system
        await projectSystem.deleteVariant(activePrompt.name, variantToDelete.name);

        // Reload project
        const project = await projectSystem.getProject(activePrompt.name);
        const promptData = convertProjectToPromptData(project);
        setPrompts(prev => prev.map(p => p.id === activePromptId ? promptData : p));
    };

    const handleNewPrompt = async () => {
        const newName = `Untitled Prompt ${Date.now()}`;

        // Create project in file system
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

        // Reload all projects
        const projectNames = await projectSystem.listProjects();
        const loadedProjects = await Promise.all(
            projectNames.map(name => projectSystem.getProject(name))
        );
        const promptsData = loadedProjects.map(project => convertProjectToPromptData(project));
        setPrompts(promptsData);
        setActivePromptId(newName);
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

    const handleImportVariable = async (variable: Variable) => {
        if (!activeVariant) return;
        // Check if variant already has this key
        const exists = activeVariant.variables.some(v => v.key === variable.key);
        if (exists) {
            // Maybe just update the value? Or warn? Let's just update value for now.
            const updatedVars = activeVariant.variables.map(v => v.key === variable.key ? { ...v, value: variable.value } : v);
            await handleUpdateVariant({ variables: updatedVars });
        } else {
            const newVar = { id: crypto.randomUUID(), key: variable.key, value: variable.value };
            await handleUpdateVariant({ variables: [...activeVariant.variables, newVar] });
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
                        onSave={handleSave}
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
