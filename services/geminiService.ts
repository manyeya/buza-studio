
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { PromptConfig } from "../types";
import Handlebars from "handlebars";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

export const runPrompt = async (
  promptText: string,
  config: PromptConfig,
  variables: Record<string, string>
): Promise<string> => {
  try {
    const ai = getClient();

    // First, replace @{{key}} syntax (project variables) with placeholder values
    let processedPrompt = promptText;
    Object.entries(variables).forEach(([key, value]) => {
      const projectVarRegex = new RegExp(`@{{${key}}}`, 'g');
      processedPrompt = processedPrompt.replace(projectVarRegex, value);
    });

    // Then use Handlebars for {{key}} syntax (variant variables)
    const template = Handlebars.compile(processedPrompt);
    const finalPrompt = template(variables);

    const generateConfig: any = {
      temperature: config.temperature,
      topK: config.topK,
    };

    if (config.maxOutputTokens) {
      generateConfig.maxOutputTokens = config.maxOutputTokens;
    }

    if (config.systemInstruction) {
      generateConfig.systemInstruction = config.systemInstruction;
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: config.model,
      contents: finalPrompt,
      config: generateConfig,
    });

    return response.text || "No output generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Error: ${error.message || "Unknown error occurred"}`;
  }
};

export const optimizePrompt = async (currentPrompt: string): Promise<string> => {
  try {
    const ai = getClient();
    const metaPrompt = `
      You are an expert Prompt Engineer. 
      Analyze the following prompt and rewrite it to be more effective, precise, and robust for an LLM.
      Keep the intent exactly the same but improve clarity and structure.
      Maintain any {{variable}} syntax.
      
      Original Prompt:
      "${currentPrompt}"
      
      Return ONLY the optimized prompt text, no explanations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: metaPrompt,
    });

    return response.text || currentPrompt;
  } catch (error) {
    console.error("Optimization Error:", error);
    return currentPrompt; // Fallback
  }
};

export const generatePromptStructure = async (description: string): Promise<{
  content: string;
  systemInstruction?: string;
  variables: { key: string; value: string }[];
  model?: string;
}> => {
  try {
    const ai = getClient();
    const model = 'gemini-2.5-flash';

    const prompt = `
      You are an expert Prompt Engineer.
      Create a high-quality, professional LLM prompt based on the following user description.
      Structure it with a System Instruction (persona/context), the Main Prompt Content, and identify dynamic Variables.
      
      User Description: "${description}"
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            systemInstruction: { type: Type.STRING, description: "Context, persona, or rules for the model." },
            content: { type: Type.STRING, description: "The main template text of the prompt." },
            variables: {
              type: Type.ARRAY,
              description: "List of dynamic variables used in the prompt.",
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  value: { type: Type.STRING, description: "A default or example value." }
                }
              }
            },
            model: { type: Type.STRING, description: "Recommended model (e.g. gemini-2.5-flash, gemini-3-pro-preview)" }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response generated");

  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};
