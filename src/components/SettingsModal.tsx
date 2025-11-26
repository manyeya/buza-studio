import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverStatus: {
        isReady: boolean;
        port: number | null;
        error: string | null;
    };
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, serverStatus }) => {
    const [serverInfo, setServerInfo] = React.useState<any>(null);
    const [isLoadingInfo, setIsLoadingInfo] = React.useState(false);

    // Fetch server status when modal opens
    React.useEffect(() => {
        if (isOpen && serverStatus.isReady && serverStatus.port) {
            setIsLoadingInfo(true);
            fetch(`http://localhost:${serverStatus.port}/api/status`)
                .then(res => res.json())
                .then(data => {
                    setServerInfo(data);
                    setIsLoadingInfo(false);
                })
                .catch(err => {
                    console.error('Failed to fetch server info:', err);
                    setIsLoadingInfo(false);
                });
        }
    }, [isOpen, serverStatus.isReady, serverStatus.port]);

    const formatUptime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-figma-panel border-figma-border text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">Settings</DialogTitle>
                    <DialogDescription className="text-figma-muted">
                        Manage your Buza Studio configuration and server settings
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Server Status Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Server Status</h3>

                        <div className="bg-figma-bg border border-figma-border rounded-lg p-4 space-y-3">
                            {/* Status Indicator */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${serverStatus.isReady ? 'bg-green-500' : 'bg-yellow-500'} shadow-lg`} />
                                    <span className="text-sm font-medium">
                                        {serverStatus.isReady ? 'Running' : 'Starting...'}
                                    </span>
                                </div>
                                {serverStatus.isReady && serverStatus.port && (
                                    <span className="text-xs text-figma-muted font-mono">
                                        Port: {serverStatus.port}
                                    </span>
                                )}
                            </div>

                            {/* Error Display */}
                            {serverStatus.error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                                    <p className="text-xs text-red-400 font-mono">{serverStatus.error}</p>
                                </div>
                            )}

                            {/* Server Info */}
                            {serverStatus.isReady && serverInfo && !isLoadingInfo && (
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-figma-border">
                                    <div>
                                        <p className="text-[10px] text-figma-muted uppercase tracking-wider mb-1">Uptime</p>
                                        <p className="text-sm font-mono text-white">{formatUptime(serverInfo.uptime)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-figma-muted uppercase tracking-wider mb-1">Status</p>
                                        <p className="text-sm font-mono text-green-400">{serverInfo.status}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] text-figma-muted uppercase tracking-wider mb-1">Data Path</p>
                                        <p className="text-xs font-mono text-white break-all">{serverInfo.dataPath}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] text-figma-muted uppercase tracking-wider mb-1">Last Updated</p>
                                        <p className="text-xs font-mono text-figma-muted">
                                            {new Date(serverInfo.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {isLoadingInfo && (
                                <div className="flex items-center justify-center py-4">
                                    <div className="text-xs text-figma-muted">Loading server info...</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Server Controls Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Server Controls</h3>

                        <div className="bg-figma-bg border border-figma-border rounded-lg p-4">
                            <p className="text-xs text-figma-muted mb-3">
                                The server starts automatically with the application. Manual controls will be available in a future update.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled
                                    className="px-4 py-2 bg-figma-hover text-figma-muted rounded text-sm cursor-not-allowed opacity-50"
                                >
                                    Restart Server
                                </button>
                                <button
                                    disabled
                                    className="px-4 py-2 bg-figma-hover text-figma-muted rounded text-sm cursor-not-allowed opacity-50"
                                >
                                    Stop Server
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Configuration Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Configuration</h3>

                        <div className="bg-figma-bg border border-figma-border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white font-medium">Auto-save</p>
                                    <p className="text-xs text-figma-muted">Automatically save changes</p>
                                </div>
                                <div className="text-xs text-figma-muted">Coming soon</div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-figma-border">
                                <div>
                                    <p className="text-sm text-white font-medium">Theme</p>
                                    <p className="text-xs text-figma-muted">Customize appearance</p>
                                </div>
                                <div className="text-xs text-figma-muted">Coming soon</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-4 border-t border-figma-border">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-medium rounded text-sm transition-colors"
                    >
                        Done
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SettingsModal;
