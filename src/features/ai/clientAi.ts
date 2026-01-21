import { PromptConfig } from '../../types';
import { runPrompt } from '../../services/aiService';

export async function clientSideCompletion(
    content: string,
    config: PromptConfig,
    variables: Record<string, string>
) {
    return await runPrompt(content, config, variables);
}
