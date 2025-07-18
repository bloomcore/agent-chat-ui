import React from 'react';
import { useArtifact } from "./thread/artifact";

export interface WriterProps {
  title?: string;
  content?: string;
  description?: string;
}

export function Writer(props: WriterProps) {
  const [Artifact, { open, setOpen }] = useArtifact();

  return (
    <>
      <div className="space-y-2">
        <button
          onClick={() => setOpen(!open)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {open ? 'Close Side Panel' : 'Open Side Panel'}
        </button>
        
      </div>

      <Artifact title="Side Panel Test">
        <div className="w-full h-full min-h-[600px] bg-gray-100 dark:bg-gray-900 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Side Panel is Working!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This is a simple test to verify the side panel functionality.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 font-medium">
                ✓ Side panel is functioning correctly
              </p>
              <p className="text-blue-600 dark:text-blue-300 text-sm mt-1">
                Ready for 3D content integration
              </p>
            </div>
          </div>
        </div>
      </Artifact>
    </>
  );
}

export default Writer;
