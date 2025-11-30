import { GoogleGenerativeAI } from '@google/genai';
import { PromptConfig } from '../types';

// Initialize the API client
// We use process.env.GEMINI_API_KEY as defined in vite.config.ts
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Run a prompt with the given configuration and variables
 */
export async function runPrompt(
    content: string,
    config: PromptConfig,
    variables: Record<string, string>
): Promise<string> {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please check your .env file.');
    }

    try {
        // Replace variables in content
        let finalContent = content;
        Object.entries(variables).forEach(([key, value]) => {
            // Replace {{key}} and @{{key}}
            finalContent = finalContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            finalContent = finalContent.replace(new RegExp(`@\\{\\{${key}\\}\\}`, 'g'), value);
        });

        const model = genAI.getGenerativeModel({
            model: config.model,
            generationConfig: {
                temperature: config.temperature,
                topK: config.topK,
                maxOutputTokens: config.maxOutputTokens,
            },
            systemInstruction: config.systemInstruction,
        });

        const result = await model.generateContent(finalContent);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error running prompt:', error);
        throw error;
    }
}

/**
 * Optimize a prompt using Gemini
 */
export async function optimizePrompt(content: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing');
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Optimize the following prompt to be more effective, clear, and likely to produce high-quality results. 
    Maintain the original intent and any variables ({{variable}}).
    
    Original Prompt:
    ${content}
    
    Optimized Prompt:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error optimizing prompt:', error);
        throw error;
    }
}

/**
 * Generate a structured prompt from a description
 */
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
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `Create a structured prompt based on this description: "${description}".
    
    Return a JSON object with the following structure:
    {
      "content": "The main prompt text with {{variables}}",
      "systemInstruction": "System instructions for the model",
      "model": "Recommended model (e.g., gemini-1.5-pro, gemini-1.5-flash)",
      "variables": [
        { "key": "variable_name", "value": "default value or example" }
      ]
    }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text);
    } catch (error) {
        console.error('Error generating prompt structure:', error);
        throw error;
    }
}
