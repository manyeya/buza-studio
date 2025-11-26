import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface Option {
    label: string;
    value: string;
}

interface UniversalDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
}

export const UniversalDropdown: React.FC<UniversalDropdownProps> = ({
    value,
    onChange,
    options,
    placeholder = "Select...",
    className
}) => {
    const selectedOption = options.find(opt => opt.value === value);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                "flex items-center justify-between w-full bg-transparent text-xs text-white focus:outline-none hover:text-figma-accent transition-colors truncate gap-2",
                className
            )}>
                <span className="truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDownIcon className="w-3 h-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-figma-panel border-figma-border text-white min-w-[150px]">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className="text-xs focus:bg-figma-hover focus:text-white cursor-pointer"
                    >
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
