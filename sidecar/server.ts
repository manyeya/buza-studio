// server.ts
import { serve } from "bun";
import { projectSystem } from "./project-system";

// Initialize project system
await projectSystem.initialize();

const server = serve({
    port: 0, // 0 lets the OS pick a random free port
    async fetch(req: { url: string | URL; method: string; json: () => any; body: BodyInit; }) {
        const url = new URL(req.url);

        // CORS headers for all responses
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle preflight requests
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // ============ PROJECT ENDPOINTS ============

            // List all projects
            if (url.pathname === "/api/projects" && req.method === "GET") {
                const projects = await projectSystem.listProjects();
                return new Response(JSON.stringify({ projects }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Create a new project
            if (url.pathname === "/api/projects" && req.method === "POST") {
                const body = await req.json();
                const { name } = body;

                if (!name) {
                    return new Response(JSON.stringify({ error: "Project name is required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                await projectSystem.createProject(name);
                return new Response(JSON.stringify({ success: true, name }), {
                    status: 201,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get project details
            const projectMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)$/);
            if (projectMatch && req.method === "GET") {
                const projectName = decodeURIComponent(projectMatch[1]);
                const project = await projectSystem.getProject(projectName);
                return new Response(JSON.stringify(project), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Delete a project
            if (projectMatch && req.method === "DELETE") {
                const projectName = decodeURIComponent(projectMatch[1]);
                await projectSystem.deleteProject(projectName);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Update project description
            const descMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/description$/);
            if (descMatch && req.method === "PUT") {
                const projectName = decodeURIComponent(descMatch[1]);
                const body = await req.json();
                const { description } = body;

                await projectSystem.updateProjectDescription(projectName, description || '');
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Rename project
            const renameProjectMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/rename$/);
            if (renameProjectMatch && req.method === "PUT") {
                const oldName = decodeURIComponent(renameProjectMatch[1]);
                const body = await req.json();
                const { newName } = body;

                if (!newName) {
                    return new Response(JSON.stringify({ error: "New name is required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                await projectSystem.renameProject(oldName, newName);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // ============ VARIANT ENDPOINTS ============

            // List variants in a project
            const variantsMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/variants$/);
            if (variantsMatch && req.method === "GET") {
                const projectName = decodeURIComponent(variantsMatch[1]);
                const variants = await projectSystem.listVariants(projectName);
                return new Response(JSON.stringify({ variants }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Create a new variant
            if (variantsMatch && req.method === "POST") {
                const projectName = decodeURIComponent(variantsMatch[1]);
                const body = await req.json();
                const { name, content, metadata } = body;

                if (!name) {
                    return new Response(JSON.stringify({ error: "Variant name is required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                await projectSystem.createVariant(projectName, name, content || '', metadata || {});
                return new Response(JSON.stringify({ success: true }), {
                    status: 201,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get a specific variant
            const variantMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/variants\/([^\/]+)$/);
            if (variantMatch && req.method === "GET") {
                const projectName = decodeURIComponent(variantMatch[1]);
                const variantName = decodeURIComponent(variantMatch[2]);
                const variant = await projectSystem.readVariant(projectName, variantName);
                return new Response(JSON.stringify(variant), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Update a variant
            if (variantMatch && req.method === "PUT") {
                const projectName = decodeURIComponent(variantMatch[1]);
                const variantName = decodeURIComponent(variantMatch[2]);
                const body = await req.json();
                const { content, metadata } = body;

                await projectSystem.updateVariant(projectName, variantName, content || '', metadata || {});
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Delete a variant
            if (variantMatch && req.method === "DELETE") {
                const projectName = decodeURIComponent(variantMatch[1]);
                const variantName = decodeURIComponent(variantMatch[2]);
                await projectSystem.deleteVariant(projectName, variantName);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Rename variant
            const renameVariantMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/variants\/([^\/]+)\/rename$/);
            if (renameVariantMatch && req.method === "PUT") {
                const projectName = decodeURIComponent(renameVariantMatch[1]);
                const oldName = decodeURIComponent(renameVariantMatch[2]);
                const body = await req.json();
                const { newName } = body;

                if (!newName) {
                    return new Response(JSON.stringify({ error: "New name is required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                await projectSystem.renameVariant(projectName, oldName, newName);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // ============ VARIABLE ENDPOINTS ============

            // Get project variables
            const projectVarsMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/variables$/);
            if (projectVarsMatch && req.method === "GET") {
                const projectName = decodeURIComponent(projectVarsMatch[1]);
                const variables = await projectSystem.getProjectVariables(projectName);
                return new Response(JSON.stringify({ variables }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Update project variables
            if (projectVarsMatch && req.method === "PUT") {
                const projectName = decodeURIComponent(projectVarsMatch[1]);
                const body = await req.json();
                const { variables } = body;

                await projectSystem.updateProjectVariables(projectName, variables || []);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get variable library
            if (url.pathname === "/api/library/variables" && req.method === "GET") {
                const variables = await projectSystem.getVariableLibrary();
                return new Response(JSON.stringify({ variables }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Update variable library
            if (url.pathname === "/api/library/variables" && req.method === "PUT") {
                const body = await req.json();
                const { variables } = body;

                await projectSystem.updateVariableLibrary(variables || []);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // ============ TEMPLATE ENDPOINTS ============

            // Get template library
            if (url.pathname === "/api/templates" && req.method === "GET") {
                const templates = await projectSystem.getTemplateLibrary();
                return new Response(JSON.stringify({ templates }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Update template library
            if (url.pathname === "/api/templates" && req.method === "PUT") {
                const body = await req.json();
                const { templates } = body;

                await projectSystem.updateTemplateLibrary(templates || []);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // ============ LEGACY ENDPOINTS ============

            // Hello endpoint
            if (url.pathname === "/api/hello") {
                return new Response(JSON.stringify({ message: "Hello from Bun!" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Echo endpoint
            if (url.pathname === "/api/echo" && req.method === "POST") {
                return new Response(req.body, {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Status endpoint
            if (url.pathname === "/api/status") {
                return new Response(JSON.stringify({
                    status: "running",
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                    dataPath: projectSystem['basePath'],
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Health check
            if (url.pathname === "/health") {
                return new Response(JSON.stringify({ healthy: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            return new Response(JSON.stringify({ error: "Not Found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (error: any) {
            console.error("API Error:", error);
            return new Response(JSON.stringify({
                error: error.message || "Internal server error"
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
});

// CRITICAL: Print the port so Tauri knows where to connect
console.log(`PORT:${server.port}`);
