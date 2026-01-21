import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import Handlebars from 'handlebars';
import { PromptConfig } from '../../types';

const apiKey = process.env.GEMINI_API_KEY || '';

const google = createGoogleGenerativeAI({
    apiKey,
});

export async function runPrompt(
    content: string,
    config: PromptConfig,
    variables: Record<string, string>
): Promise<string> {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please check your .env file.');
    }

    try {
        let finalContent = content;
        Object.entries(variables).forEach(([key, value]) => {
            finalContent = finalContent.replace(new RegExp(`@\\{\\{${key}\\}\\}`, 'g'), value);
        });

        try {
            const template = Handlebars.compile(finalContent, { noEscape: true });
            finalContent = template(variables);
        } catch (templateError) {
            console.warn('Handlebars compilation failed, falling back to simple replacement:', templateError);
            Object.entries(variables).forEach(([key, value]) => {
                finalContent = finalContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            });
        }

        let modelName = config.model;
        
        if (modelName === 'gemini-1.5-flash') {
             modelName = 'gemini-1.5-flash'; 
        }

        const { text } = await generateText({
            model: google(modelName),
            prompt: finalContent,
            system: config.systemInstruction,
            temperature: config.temperature,
            topK: config.topK, 
        });

        return text;
    } catch (error) {
        console.error('Error running prompt:', error);
        throw error;
    }
}

export async function optimizePrompt(content: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing');
    }

    try {
        const metaPrompt = `
      You are an expert Prompt Engineer. 
      Analyze the following prompt and rewrite it to be more effective, precise, and robust for an LLM.
      Keep the intent exactly the same but improve clarity and structure.
      Maintain any {{variable}} syntax.
      
      Original Prompt:
      "${content}"
      
      Return ONLY the optimized prompt text, no explanations.
    `;

        const { text } = await generateText({
            model: google('gemini-2.0-flash'),
            prompt: metaPrompt,
        });

        return text.trim();
    } catch (error) {
        console.error('Error optimizing prompt:', error);
        throw error;
    }
}

export async function generatePromptStructure(description: string): Promise<{
    content: string;
    systemInstruction: string;
    model: string;
    variables: { key: string; value: string }[];
}> {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing');
    }

    try {
        const systemInstruction = `
      You are an expert Prompt Engineer.
      Create a high-quality, professional LLM prompt based on the following user description.
      Structure it with a System Instruction (persona/context), the Main Prompt Content, and identify dynamic Variables.
    `;

        const { output } = await generateText({
            model: google('gemini-2.0-flash'),
            system: systemInstruction,
            prompt: `User Description: "${description}"`,
            output: Output.object({
                schema: z.object({
                    content: z.string().describe('The main prompt text with {{variables}}'),
                    systemInstruction: z.string().describe('System instructions for the model'),
                    model: z.string().describe('Recommended model (e.g., gemini-1.5-pro, gemini-2.0-flash)'),
                    variables: z.array(z.object({
                        key: z.string(),
                        value: z.string().describe('A default or example value')
                    })).describe('List of dynamic variables used in the prompt')
                }),
            }),
        });

        return output;
    } catch (error) {
        console.error('Error generating prompt structure:', error);
        throw error;
    }
}
