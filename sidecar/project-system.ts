import { readFile, writeFile, readdir, mkdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export interface VariantMetadata {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topK?: number;
    topP?: number;
    systemInstruction?: string;
    variables?: Array<{ id: string; key: string; value: string }>;
    [key: string]: any;
}

export interface Variant {
    name: string;
    path: string;
    metadata: VariantMetadata;
    content: string;
}

export interface Project {
    name: string;
    path: string;
    variants: Variant[];
    variables: Array<{ id: string; key: string; value: string }>;
    description?: string;
    createdAt: number;
    updatedAt: number;
}

const DEFAULT_TEMPLATES = [
    {
        name: "Text Summarizer",
        description: "Condense long text into concise bullet points.",
        content: "Please analyze the following text and provide a concise summary in bullet points. Focus on the main arguments and key takeaways.\n\nText:\n{{input_text}}",
        config: { model: 'gemini-2.5-flash', temperature: 0.3, topK: 40 },
        variables: [
            { key: 'input_text', value: 'Paste your text here...' }
        ],
        projectVariables: []
    },
    {
        name: "Code Generator",
        description: "Generate robust, documented code functions.",
        content: "Write a {{language}} function that {{functionality}}. \n\nRequirements:\n- Include JSDoc/Docstring comments.\n- Handle edge cases and errors.\n- Follow best practices for {{language}}.",
        config: { model: 'gemini-3-pro-preview', temperature: 0.2, topK: 40 },
        variables: [
            { key: 'functionality', value: 'calculates the Levenshtein distance between two strings' }
        ],
        projectVariables: [
            { key: 'language', value: 'TypeScript' }
        ]
    },
    {
        name: "Blog Post Creator",
        description: "Write engaging, SEO-friendly blog content.",
        content: "Write a comprehensive blog post about {{topic}}. \n\nTarget Audience: {{audience}}\nTone: {{tone}}\n\nStructure:\n1. Catchy Title\n2. Introduction (Hook)\n3. Key Points (use H2 headers)\n4. Conclusion\n5. Call to Action",
        config: { model: 'gemini-2.5-flash', temperature: 0.8, topK: 50 },
        variables: [
            { key: 'topic', value: 'The Future of AI in Healthcare' }
        ],
        projectVariables: [
            { key: 'audience', value: 'Tech enthusiasts and medical professionals' },
            { key: 'tone', value: 'Optimistic and informative' }
        ]
    },
    {
        name: "Unit Test Writer",
        description: "Generate unit tests for existing code.",
        content: "I have the following code:\n\n```\n{{code}}\n```\n\nPlease write comprehensive unit tests using {{framework}}. Cover happy paths and edge cases.",
        config: { model: 'gemini-3-pro-preview', temperature: 0.2, topK: 40 },
        variables: [
            { key: 'code', value: 'function add(a, b) { return a + b; }' }
        ],
        projectVariables: [
            { key: 'framework', value: 'Jest' }
        ]
    },
    {
        name: "Language Translator",
        description: "Translate text while preserving nuance and tone.",
        content: "Translate the following text from {{source_lang}} to {{target_lang}}.\n\nContext/Tone: {{context}}\n\nText:\n{{text}}",
        config: { model: 'gemini-2.5-flash', temperature: 0.4, topK: 40 },
        variables: [
            { key: 'text', value: 'We are pleased to inform you that your proposal has been accepted.' }
        ],
        projectVariables: [
            { key: 'source_lang', value: 'English' },
            { key: 'target_lang', value: 'Spanish' },
            { key: 'context', value: 'Professional business email' }
        ]
    },
    {
        name: "Explain Like I'm 5",
        description: "Simplify complex topics for beginners.",
        content: "Explain {{topic}} to a 5-year-old. Use simple analogies, avoid jargon, and keep it fun.",
        config: { model: 'gemini-2.5-flash', temperature: 0.7, topK: 40 },
        variables: [
            { key: 'topic', value: 'Quantum Computing' }
        ],
        projectVariables: []
    }
];

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: VariantMetadata; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { metadata: {}, body: content };
    }

    const [, yamlContent, body] = match;
    const metadata: VariantMetadata = {};

    // Simple YAML parser for key-value pairs
    yamlContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim();
            const trimmedKey = key.trim();

            // Try to parse as JSON first (for arrays and objects)
            if (value.startsWith('[') || value.startsWith('{')) {
                try {
                    metadata[trimmedKey] = JSON.parse(value);
                    return;
                } catch (e) {
                    // If JSON parse fails, treat as string
                }
            }

            // Try to parse as number or boolean
            if (value === 'true') metadata[trimmedKey] = true;
            else if (value === 'false') metadata[trimmedKey] = false;
            else if (!isNaN(Number(value))) metadata[trimmedKey] = Number(value);
            else metadata[trimmedKey] = value.replace(/^["']|["']$/g, ''); // Remove quotes
        }
    });

    return { metadata, body: body.trim() };
}

/**
 * Serialize metadata and content to markdown with frontmatter
 */
function serializeFrontmatter(metadata: VariantMetadata, content: string): string {
    if (Object.keys(metadata).length === 0) {
        return content;
    }

    const yamlLines = Object.entries(metadata).map(([key, value]) => {
        // Handle arrays and objects by JSON stringifying them
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return `${key}: ${JSON.stringify(value)}`;
        }
        if (typeof value === 'string') {
            return `${key}: "${value}"`;
        }
        return `${key}: ${value}`;
    });

    return `---\n${yamlLines.join('\n')}\n---\n\n${content}`;
}

export class ProjectSystem {
    private basePath: string;

    constructor(basePath?: string) {
        // Default to ~/Documents/buza-projects to match Tauri app
        this.basePath = basePath || join(homedir(), 'Documents', 'buza-projects');
    }

    /**
     * Initialize the base directory for projects
     */
    async initialize(): Promise<void> {
        if (!existsSync(this.basePath)) {
            await mkdir(this.basePath, { recursive: true });
        }
    }

    /**
     * Create a new project (folder)
     */
    async createProject(projectName: string): Promise<void> {
        const projectPath = join(this.basePath, projectName);
        await mkdir(projectPath, { recursive: true });

        const now = Date.now();

        // Create project.json with empty variables and timestamps
        await this.updateProjectVariables(projectName, []);
        await this.updateProjectTimestamps(projectName, now, now);

        // Create a default Main.md variant
        await this.createVariant(projectName, 'Main', '', {});
    }

    /**
     * Create a new variant (markdown file)
     */
    async createVariant(
        projectName: string,
        variantName: string,
        content: string,
        metadata: VariantMetadata
    ): Promise<void> {
        const filePath = join(this.basePath, projectName, `${variantName}.md`);
        const fileContent = serializeFrontmatter(metadata, content);

        await writeFile(filePath, fileContent, 'utf-8');
    }

    /**
     * Read a variant file
     */
    async readVariant(projectName: string, variantName: string): Promise<Variant> {
        const filePath = join(this.basePath, projectName, `${variantName}.md`);
        const fileContent = await readFile(filePath, 'utf-8');

        const { metadata, body } = parseFrontmatter(fileContent);

        return {
            name: variantName,
            path: filePath,
            metadata,
            content: body
        };
    }

    /**
     * Update a variant file
     */
    async updateVariant(
        projectName: string,
        variantName: string,
        content: string,
        metadata: VariantMetadata
    ): Promise<void> {
        await this.createVariant(projectName, variantName, content, metadata);
    }

    /**
     * List all variants in a project
     */
    async listVariants(projectName: string): Promise<string[]> {
        const projectPath = join(this.basePath, projectName);
        const entries = await readdir(projectPath, { withFileTypes: true });

        return entries
            .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
            .map(entry => entry.name.replace('.md', ''));
    }

    /**
     * List all projects
     */
    async listProjects(): Promise<string[]> {
        const entries = await readdir(this.basePath, { withFileTypes: true });

        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    }

    /**
     * Get project variables
     */
    async getProjectVariables(projectName: string): Promise<Array<{ id: string; key: string; value: string }>> {
        const filePath = join(this.basePath, projectName, 'project.json');
        try {
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.variables || [];
        } catch (e) {
            // If file doesn't exist or is invalid, return empty array
            return [];
        }
    }

    /**
     * Update project variables
     */
    async updateProjectVariables(projectName: string, variables: Array<{ id: string; key: string; value: string }>): Promise<void> {
        const filePath = join(this.basePath, projectName, 'project.json');

        // Read existing data to preserve description
        let existingData: any = {};
        try {
            const content = await readFile(filePath, 'utf-8');
            existingData = JSON.parse(content);
        } catch (e) {
            // File doesn't exist yet, that's ok
        }

        const content = JSON.stringify({ ...existingData, variables, updatedAt: Date.now() }, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    /**
     * Get project description
     */
    async getProjectDescription(projectName: string): Promise<string> {
        const filePath = join(this.basePath, projectName, 'project.json');
        try {
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.description || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Update project timestamps
     */
    async updateProjectTimestamps(projectName: string, createdAt?: number, updatedAt?: number): Promise<void> {
        const filePath = join(this.basePath, projectName, 'project.json');

        // Read existing data to preserve other fields
        let existingData: any = {};
        try {
            const content = await readFile(filePath, 'utf-8');
            existingData = JSON.parse(content);
        } catch (e) {
            // File doesn't exist yet, that's ok
        }

        const updates: any = {};
        if (createdAt !== undefined) updates.createdAt = createdAt;
        if (updatedAt !== undefined) updates.updatedAt = updatedAt;

        const content = JSON.stringify({ ...existingData, ...updates }, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    /**
     * Get project timestamps
     */
    async getProjectTimestamps(projectName: string): Promise<{ createdAt: number; updatedAt: number }> {
        const filePath = join(this.basePath, projectName, 'project.json');
        try {
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            const now = Date.now();
            return {
                createdAt: data.createdAt || now,
                updatedAt: data.updatedAt || now
            };
        } catch (e) {
            // If file doesn't exist, return current time as fallback
            const now = Date.now();
            return { createdAt: now, updatedAt: now };
        }
    }

    /**
     * Update project description
     */
    async updateProjectDescription(projectName: string, description: string): Promise<void> {
        const filePath = join(this.basePath, projectName, 'project.json');

        // Read existing data to preserve variables
        let existingData: any = {};
        try {
            const content = await readFile(filePath, 'utf-8');
            existingData = JSON.parse(content);
        } catch (e) {
            // File doesn't exist yet, that's ok
        }

        const content = JSON.stringify({ ...existingData, description, updatedAt: Date.now() }, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    async getProject(projectName: string): Promise<Project> {
        const variantNames = await this.listVariants(projectName);
        const variants = await Promise.all(
            variantNames.map(name => this.readVariant(projectName, name))
        );
        const variables = await this.getProjectVariables(projectName);
        const description = await this.getProjectDescription(projectName);
        const timestamps = await this.getProjectTimestamps(projectName);

        return {
            name: projectName,
            path: join(this.basePath, projectName),
            variants,
            variables,
            description,
            createdAt: timestamps.createdAt,
            updatedAt: timestamps.updatedAt
        };
    }

    /**
     * Delete a variant
     */
    async deleteVariant(projectName: string, variantName: string): Promise<void> {
        const filePath = join(this.basePath, projectName, `${variantName}.md`);
        await rm(filePath);
    }

    /**
     * Delete a project and all its variants
     */
    async deleteProject(projectName: string): Promise<void> {
        const projectPath = join(this.basePath, projectName);
        await rm(projectPath, { recursive: true });
    }

    /**
     * Get variable library
     */
    async getVariableLibrary(): Promise<Array<{ id: string; key: string; value: string }>> {
        const filePath = join(this.basePath, 'library.json');
        try {
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.variables || [];
        } catch (e) {
            // If file doesn't exist or is invalid, return default variables
            return [
                { id: 'glob-1', key: 'tone', value: 'Professional' },
                { id: 'glob-2', key: 'audience', value: 'Experts' },
                { id: 'glob-3', key: 'output_format', value: 'JSON' }
            ];
        }
    }

    /**
     * Update variable library
     */
    async updateVariableLibrary(variables: Array<{ id: string; key: string; value: string }>): Promise<void> {
        const filePath = join(this.basePath, 'library.json');
        const content = JSON.stringify({ variables }, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    /**
     * Get template library
     */
    async getTemplateLibrary(): Promise<any[]> {
        const filePath = join(this.basePath, 'templates.json');
        try {
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.templates || [];
        } catch (e) {
            // If file doesn't exist, create it with default templates
            await this.updateTemplateLibrary(DEFAULT_TEMPLATES);
            return DEFAULT_TEMPLATES;
        }
    }

    /**
     * Update template library
     */
    async updateTemplateLibrary(templates: any[]): Promise<void> {
        const filePath = join(this.basePath, 'templates.json');
        const content = JSON.stringify({ templates }, null, 2);
        await writeFile(filePath, content, 'utf-8');
    }

    /**
     * Rename a project
     */
    async renameProject(oldName: string, newName: string): Promise<void> {
        const oldPath = join(this.basePath, oldName);
        const newPath = join(this.basePath, newName);

        // Check if new name already exists
        if (existsSync(newPath)) {
            throw new Error(`Project "${newName}" already exists`);
        }

        // Rename directory
        await mkdir(newPath, { recursive: true });
        const entries = await readdir(oldPath);

        for (const entry of entries) {
            const oldEntryPath = join(oldPath, entry);
            const newEntryPath = join(newPath, entry);
            const stats = await stat(oldEntryPath);

            if (stats.isFile()) {
                const content = await readFile(oldEntryPath);
                await writeFile(newEntryPath, content);
            }
        }

        await rm(oldPath, { recursive: true });
    }

    /**
     * Rename a variant
     */
    async renameVariant(projectName: string, oldName: string, newName: string): Promise<void> {
        const oldPath = join(this.basePath, projectName, `${oldName}.md`);
        const newPath = join(this.basePath, projectName, `${newName}.md`);

        // Check if new name already exists
        if (existsSync(newPath)) {
            throw new Error(`Variant "${newName}" already exists`);
        }

        const content = await readFile(oldPath);
        await writeFile(newPath, content);
        await rm(oldPath);
    }
}

// Export a singleton instance
export const projectSystem = new ProjectSystem();
