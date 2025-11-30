import { useEffect, useState } from 'react';
import { extractVariantVariables, getSetDifferences } from '../lib/variable-utils';
import type { Variable } from '../../types';

/**
 * Hook to track variant variables from content and sync with the variant's variables array
 */
export function useVariableTracking(
    content: string,
    currentVariables: Variable[],
    onUpdateVariables: (variables: Variable[]) => void
) {
    const [detectedVars, setDetectedVars] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Extract variables from content
        const newDetectedVars = extractVariantVariables(content);

        // Compare with previous detected variables
        const { added, removed } = getSetDifferences(detectedVars, newDetectedVars);

        // Only update if there are changes
        if (added.size > 0 || removed.size > 0) {
            setDetectedVars(newDetectedVars);

            // Create a map of existing variables for quick lookup
            const existingVarsMap = new Map(
                currentVariables.map(v => [v.key, v])
            );

            // Build updated variables array
            const updatedVariables: Variable[] = [];

            // Add all detected variables (preserving existing values)
            for (const varName of newDetectedVars) {
                const existing = existingVarsMap.get(varName);
                if (existing) {
                    // Keep existing variable with its value
                    updatedVariables.push(existing);
                } else {
                    // Create new variable with empty value
                    updatedVariables.push({
                        id: crypto.randomUUID(),
                        key: varName,
                        value: ''
                    });
                }
            }

            // Update the variant's variables
            onUpdateVariables(updatedVariables);
        }
    }, [content]); // Only depend on content changes

    return detectedVars;
}
