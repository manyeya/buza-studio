import {
    mkdir,
    writeTextFile,
    readTextFile,
    readDir,
    exists,
    BaseDirectory
} from '@tauri-apps/plugin-fs';

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
}

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
        if (typeof value === 'string') {
            return `${key}: "${value}"`;
        }
        return `${key}: ${value}`;
    });

    return `---\n${yamlLines.join('\n')}\n---\n\n${content}`;
}

export class ProjectSystem {
    private basePath: string;

    constructor(basePath: string = 'buza-projects') {
        this.basePath = basePath;
    }

    /**
     * Initialize the base directory for projects
     */
    async initialize(): Promise<void> {
        const baseExists = await exists(this.basePath, { baseDir: BaseDirectory.Document });
        if (!baseExists) {
            await mkdir(this.basePath, { baseDir: BaseDirectory.Document, recursive: true });
        }
    }

    /**
     * Create a new project (folder)
     */
    async createProject(projectName: string): Promise<void> {
        const projectPath = `${this.basePath}/${projectName}`;
        await mkdir(projectPath, { baseDir: BaseDirectory.Document, recursive: true });

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
        const filePath = `${this.basePath}/${projectName}/${variantName}.md`;
        const fileContent = serializeFrontmatter(metadata, content);

        await writeTextFile(filePath, fileContent, { baseDir: BaseDirectory.Document });
    }

    /**
     * Read a variant file
     */
    async readVariant(projectName: string, variantName: string): Promise<Variant> {
        const filePath = `${this.basePath}/${projectName}/${variantName}.md`;
        const fileContent = await readTextFile(filePath, { baseDir: BaseDirectory.Document });

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
        const projectPath = `${this.basePath}/${projectName}`;
        const entries = await readDir(projectPath, { baseDir: BaseDirectory.Document });

        return entries
            .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))
            .map(entry => entry.name.replace('.md', ''));
    }

    /**
     * List all projects
     */
    async listProjects(): Promise<string[]> {
        const entries = await readDir(this.basePath, { baseDir: BaseDirectory.Document });

        return entries
            .filter(entry => entry.isDirectory)
            .map(entry => entry.name);
    }

    /**
     * Get full project with all variants
     */
    async getProject(projectName: string): Promise<Project> {
        const variantNames = await this.listVariants(projectName);
        const variants = await Promise.all(
            variantNames.map(name => this.readVariant(projectName, name))
        );

        return {
            name: projectName,
            path: `${this.basePath}/${projectName}`,
            variants
        };
    }

    /**
     * Delete a variant
     */
    async deleteVariant(projectName: string, variantName: string): Promise<void> {
        const { remove } = await import('@tauri-apps/plugin-fs');
        const filePath = `${this.basePath}/${projectName}/${variantName}.md`;
        await remove(filePath, { baseDir: BaseDirectory.Document });
    }

    /**
     * Delete a project and all its variants
     */
    async deleteProject(projectName: string): Promise<void> {
        const { remove } = await import('@tauri-apps/plugin-fs');
        const projectPath = `${this.basePath}/${projectName}`;
        await remove(projectPath, { baseDir: BaseDirectory.Document, recursive: true });
    }
}

// Export a singleton instance
export const projectSystem = new ProjectSystem();
