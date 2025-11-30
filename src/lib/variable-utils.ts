/**
 * Utility functions for extracting and managing variant variables
 */

/**
 * Extracts all variant variables ({{var}}) from content
 * Excludes project variables (@{{var}})
 * Returns a Set of unique variable names
 */
export function extractVariantVariables(content: string): Set<string> {
    const variables = new Set<string>();

    // Match {{variable}} but not @{{variable}}
    // Negative lookbehind to exclude @{{var}}
    const variantVarRegex = /(?<!@)\{\{([^}]+)\}\}/g;

    let match;
    while ((match = variantVarRegex.exec(content)) !== null) {
        const varName = match[1].trim();
        if (varName) {
            variables.add(varName);
        }
    }

    return variables;
}

/**
 * Compares two Sets and returns the differences
 */
export function getSetDifferences<T>(oldSet: Set<T>, newSet: Set<T>) {
    const added = new Set<T>();
    const removed = new Set<T>();

    // Find added items
    for (const item of newSet) {
        if (!oldSet.has(item)) {
            added.add(item);
        }
    }

    // Find removed items
    for (const item of oldSet) {
        if (!newSet.has(item)) {
            removed.add(item);
        }
    }

    return { added, removed };
}
