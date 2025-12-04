/**
 * Breadcrumb Component
 * 
 * Displays folder path segments with clickable navigation.
 * Shows the current folder hierarchy and allows users to navigate
 * to any parent folder by clicking on a segment.
 * 
 * _Requirements: 3.2, 3.3_
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRightIcon, HomeIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbProps {
    /** Array of folder names from root to current */
    path: string[];
    /** Callback when a segment is clicked. Index -1 means root. */
    onNavigate: (index: number) => void;
    /** Optional className for styling */
    className?: string;
}

export interface BreadcrumbItem {
    /** Display name of the segment */
    name: string;
    /** Full path to this segment */
    path: string;
}

// ============================================================================
// Breadcrumb Component
// ============================================================================

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
    path,
    onNavigate,
    className,
}) => {
    // Don't render if at root level (empty path)
    if (path.length === 0) {
        return null;
    }

    return (
        <nav
            className={cn(
                'flex items-center gap-1 text-xs overflow-x-auto',
                className
            )}
            aria-label="Folder breadcrumb"
        >
            {/* Root/Home segment */}
            <button
                onClick={() => onNavigate(-1)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-figma-muted hover:text-white hover:bg-figma-hover transition-colors flex-shrink-0"
                title="Go to root"
            >
                <HomeIcon className="w-3 h-3" />
                <span className="sr-only">Root</span>
            </button>

            {/* Path segments */}
            {path.map((segment, index) => {
                const isLast = index === path.length - 1;

                return (
                    <React.Fragment key={index}>
                        {/* Separator */}
                        <ChevronRightIcon className="w-3 h-3 text-figma-muted flex-shrink-0" />

                        {/* Segment */}
                        {isLast ? (
                            // Current folder (not clickable)
                            <span
                                className="px-1.5 py-0.5 text-white font-medium truncate max-w-[120px]"
                                title={segment}
                            >
                                {segment}
                            </span>
                        ) : (
                            // Parent folder (clickable)
                            <button
                                onClick={() => onNavigate(index)}
                                className="px-1.5 py-0.5 rounded text-figma-muted hover:text-white hover:bg-figma-hover transition-colors truncate max-w-[120px]"
                                title={`Go to ${segment}`}
                            >
                                {segment}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};

// ============================================================================
// Connected Breadcrumb Component (uses Jotai atoms)
// ============================================================================

import { useAtom, useSetAtom } from 'jotai';
import { breadcrumbPathAtom, navigateToFolderAtom } from '@/atoms/folder-atoms';

export interface ConnectedBreadcrumbProps {
    /** Optional className for styling */
    className?: string;
}

/**
 * ConnectedBreadcrumb
 * 
 * A version of Breadcrumb that automatically connects to Jotai atoms
 * for folder state management. Use this when you want the breadcrumb
 * to automatically sync with the folder navigation state.
 */
export const ConnectedBreadcrumb: React.FC<ConnectedBreadcrumbProps> = ({
    className,
}) => {
    const [path] = useAtom(breadcrumbPathAtom);
    const navigateToFolder = useSetAtom(navigateToFolderAtom);

    const handleNavigate = (index: number) => {
        if (index === -1) {
            // Navigate to root
            navigateToFolder(null);
        } else {
            // Build path up to the clicked segment
            const targetPath = path.slice(0, index + 1).join('/');
            navigateToFolder(targetPath);
        }
    };

    return (
        <Breadcrumb
            path={path}
            onNavigate={handleNavigate}
            className={className}
        />
    );
};

export default Breadcrumb;
