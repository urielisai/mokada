import type { ReactNode } from 'react';

interface IconButtonProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export const IconButton = ({ title, onClick, disabled, children }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-ink-2 hover:bg-gray-200 hover:text-ink disabled:bg-gray-50 disabled:text-gray-300"
  >
    {children}
  </button>
);
