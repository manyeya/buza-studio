import { useState, useEffect, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';

interface UseBunApiReturn {
    apiPort: number | null;
    isReady: boolean;
    fetchApi: (endpoint: string, options?: RequestInit) => Promise<Response>;
    error: string | null;
}

/**
 * React hook to manage the Bun API sidecar
 * Spawns the sidecar on mount and provides a fetch wrapper for API calls
 */
export function useBunApi(): UseBunApiReturn {
    const [apiPort, setApiPort] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isSubscribed = true;

        const startSidecar = async () => {
            try {
                console.log('🚀 Starting Bun API sidecar...');

                // Spawn the sidecar
                const command = Command.sidecar('binaries/api');

                // Listen for stdout to get the port
                command.stdout.on('data', (line: string) => {
                    if (line.includes('PORT:')) {
                        const port = parseInt(line.split(':')[1]);
                        if (isSubscribed) {
                            setApiPort(port);
                            console.log(`✅ Bun API sidecar running on port ${port}`);
                        }
                    }
                });

                // Listen for stderr for errors
                command.stderr.on('data', (line: string) => {
                    console.error('❌ Sidecar error:', line);
                    if (isSubscribed) {
                        setError(line);
                    }
                });

                // Spawn the process
                await command.spawn();

            } catch (err) {
                console.error('❌ Failed to start sidecar:', err);
                if (isSubscribed) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            }
        };

        startSidecar();

        return () => {
            isSubscribed = false;
        };
    }, []);

    const fetchApi = useCallback(
        async (endpoint: string, options?: RequestInit): Promise<Response> => {
            if (!apiPort) {
                throw new Error('API sidecar not ready yet');
            }

            const url = `http://localhost:${apiPort}${endpoint}`;
            return fetch(url, options);
        },
        [apiPort]
    );

    return {
        apiPort,
        isReady: apiPort !== null,
        fetchApi,
        error,
    };
}
