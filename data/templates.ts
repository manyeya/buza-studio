import { Template } from '../types';

export const TEMPLATES: Template[] = [
  {
    name: "Text Summarizer",
    description: "Condense long text into concise bullet points.",
    content: "Please analyze the following text and provide a concise summary in bullet points. Focus on the main arguments and key takeaways.\n\nText:\n{{input_text}}",
    config: { model: 'gemini-2.5-flash', temperature: 0.3, topK: 40 },
    variables: [
        { key: 'input_text', value: 'Paste your text here...' }
    ]
  },
  {
    name: "Code Generator",
    description: "Generate robust, documented code functions.",
    content: "Write a {{language}} function that {{functionality}}. \n\nRequirements:\n- Include JSDoc/Docstring comments.\n- Handle edge cases and errors.\n- Follow best practices for {{language}}.",
    config: { model: 'gemini-3-pro-preview', temperature: 0.2, topK: 40 },
    variables: [
        { key: 'language', value: 'TypeScript' },
        { key: 'functionality', value: 'calculates the Levenshtein distance between two strings' }
    ]
  },
  {
    name: "Blog Post Creator",
    description: "Write engaging, SEO-friendly blog content.",
    content: "Write a comprehensive blog post about {{topic}}. \n\nTarget Audience: {{audience}}\nTone: {{tone}}\n\nStructure:\n1. Catchy Title\n2. Introduction (Hook)\n3. Key Points (use H2 headers)\n4. Conclusion\n5. Call to Action",
    config: { model: 'gemini-2.5-flash', temperature: 0.8, topK: 50 },
    variables: [
        { key: 'topic', value: 'The Future of AI in Healthcare' },
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
        { key: 'code', value: 'function add(a, b) { return a + b; }' },
        { key: 'framework', value: 'Jest' }
    ]
  },
  {
    name: "Language Translator",
    description: "Translate text while preserving nuance and tone.",
    content: "Translate the following text from {{source_lang}} to {{target_lang}}.\n\nContext/Tone: {{context}}\n\nText:\n{{text}}",
    config: { model: 'gemini-2.5-flash', temperature: 0.4, topK: 40 },
    variables: [
        { key: 'source_lang', value: 'English' },
        { key: 'target_lang', value: 'Spanish' },
        { key: 'context', value: 'Professional business email' },
        { key: 'text', value: 'We are pleased to inform you that your proposal has been accepted.' }
    ]
  },
  {
    name: "Explain Like I'm 5",
    description: "Simplify complex topics for beginners.",
    content: "Explain {{topic}} to a 5-year-old. Use simple analogies, avoid jargon, and keep it fun.",
    config: { model: 'gemini-2.5-flash', temperature: 0.7, topK: 40 },
    variables: [
        { key: 'topic', value: 'Quantum Computing' }
    ]
  }
];