import React from 'react';
import VtpRenderer from './VtpRenderer';

interface GeometryResultProps {
  vtpFilePath?: string;
  description?: string;
  codeExecutionResult?: string;
}

/**
 * Component to display geometry generation results with VTP viewer
 * This component will be rendered when the markdown contains the GeometryResult tag
 */
export const GeometryResult: React.FC<GeometryResultProps> = ({
  vtpFilePath,
  description = "Generated 3D geometry from DWG analysis",
  codeExecutionResult
}) => {
  // Extract VTP file path from execution result if provided
  const vtpPath = vtpFilePath || extractVtpPath(codeExecutionResult) || "/structural_building.vtp";
  
  return (
    <div className="my-4">
      <VtpRenderer
        vtpUrl={vtpPath}
        title="Generated 3D Building Structure"
        description={description}
      />
    </div>
  );
};

// Helper function to extract VTP path from execution result string
function extractVtpPath(result?: string): string | undefined {
  if (!result) return undefined;
  
  const match = result.match(/VTP file created: (\/tmp\/[^\s]+\.vtp)/);
  return match ? match[1] : undefined;
}

export default GeometryResult;