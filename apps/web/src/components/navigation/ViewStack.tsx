import React, { memo } from 'react';

interface ViewStackProps {
  activePath: string;
  children: {
    path: string;
    element: React.ReactNode;
    isExact?: boolean;
  }[];
}

/**
 * ViewStack keeps components mounted but hidden when not active.
 * This matches Instagram's behavior where the Home feed stays exactly where 
 * you left it when you switch to Profile and back.
 */
export const ViewStack = memo(({ activePath, children }: ViewStackProps) => {
  return (
    <div className="relative w-full h-full">
      {children.map((view) => {
        const isActive = view.isExact
          ? activePath === view.path
          : activePath.startsWith(view.path);

        return (
          <div
            key={view.path}
            className="w-full h-full"
            style={{
              display: isActive ? 'block' : 'none',
              visibility: isActive ? 'visible' : 'hidden'
            }}
          >
            {view.element}
          </div>
        );
      })}
    </div>
  );
});

ViewStack.displayName = 'ViewStack';
