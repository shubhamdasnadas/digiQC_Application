'use client';

import type { ReactNode } from 'react';

interface TabsPageShellProps {
  title: string;
  description?: string;
  onAdd?: () => void;
  addLabel?: string;
  filters?: ReactNode;
  rightActions?: ReactNode;
  children: ReactNode;
}

export default function TabsPageShell({
  title,
  description,
  onAdd,
  addLabel = 'Add',
  filters,
  rightActions,
  children,
}: TabsPageShellProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rightActions}
          {onAdd && (
            <button onClick={onAdd} className="btn-primary">
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {filters}

      {children}
    </div>
  );
}
