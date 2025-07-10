import React, { useEffect, useRef } from 'react';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkOrientationMarkerWidget from '@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget';
import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';
import { useArtifact } from '@/utils/use-artifact';

interface VtpRendererProps {
  vtpData?: string;
  vtpUrl?: string;
  title?: string;
  description?: string;
}

export const VtpRenderer: React.FC<VtpRendererProps> = ({
  vtpData,
  vtpUrl,
  title = "3D Geometry",
  description = "Generated FreeCAD geometry"
}) => {
  // Get artifact from thread meta
  const artifact = useArtifact();
  
  if (!artifact) {
    return (
      <div className="text-red-500 p-4 border border-red-200 rounded">
        Artifact context not available
      </div>
    );
  }

  const [Artifact, { open, setOpen }] = artifact;
  const containerRef = useRef<HTMLDivElement>(null);
  const fullScreenRendererRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const renderWindowRef = useRef<any>(null);
  const orientationWidgetRef = useRef<any>(null);

  const loadVtpData = async (data: string | ArrayBuffer) => {
    if (!rendererRef.current || !renderWindowRef.current) return;

    try {
      const reader = vtkXMLPolyDataReader.newInstance();
      
      if (typeof data === 'string') {
        // If data is base64 or raw string, convert to ArrayBuffer
        const encoder = new TextEncoder();
        const arrayBuffer = encoder.encode(data).buffer;
        reader.parseAsArrayBuffer(arrayBuffer);
      } else {
        reader.parseAsArrayBuffer(data);
      }

      const polydata = reader.getOutputData(0);

      const mapper = vtkMapper.newInstance();
      mapper.setInputData(polydata);
      mapper.setScalarModeToUsePointData();
      mapper.setColorModeToDirectScalars();

      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
      rendererRef.current.addActor(actor);

      // Auto-fit camera to geometry
      const bounds = polydata.getBounds();
      const camera = rendererRef.current.getActiveCamera();
      const center = [
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2
      ];
      const maxDim = Math.max(
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4]
      );
      const distance = maxDim * 2;

      camera.set({
        position: [center[0], center[1] - distance, center[2]],
        focalPoint: center,
        viewUp: [0, 0, 1]
      });

      rendererRef.current.resetCamera();
      renderWindowRef.current.render();

      // Add orientation axes
      if (!orientationWidgetRef.current) {
        const axes = vtkAxesActor.newInstance();
        const orientationWidget = vtkOrientationMarkerWidget.newInstance({
          actor: axes,
          interactor: renderWindowRef.current.getInteractor(),
        });

        orientationWidget.setEnabled(true);
        orientationWidget.setViewportCorner(
          vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
        );
        orientationWidget.setViewportSize(0.15);
        orientationWidget.setMinPixelSize(100);
        orientationWidget.setMaxPixelSize(300);

        orientationWidgetRef.current = orientationWidget;
      }

      // Cleanup
      reader.delete();
      mapper.delete();
      actor.delete();
    } catch (error) {
      console.error('Error loading VTP data:', error);
    }
  };

  const loadVtpFromUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      await loadVtpData(buffer);
    } catch (error) {
      console.error('Error loading VTP from URL:', error);
    }
  };

  // Auto-open the artifact when component mounts
  useEffect(() => {
    if (vtpData || vtpUrl) {
      setOpen(true);
    }
  }, [vtpData, vtpUrl, setOpen]);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    // Clean up previous renderer
    if (fullScreenRendererRef.current) {
      fullScreenRendererRef.current.delete();
      fullScreenRendererRef.current = null;
    }

    // Create VTK container
    const vtkContainer = document.createElement('div');
    vtkContainer.style.width = '100%';
    vtkContainer.style.height = '100%';
    container.appendChild(vtkContainer);

    const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      background: [0.2, 0.2, 0.2],
      container: vtkContainer,
    });
    fullScreenRendererRef.current = fullScreenRenderer;

    const renderer = fullScreenRenderer.getRenderer();
    const renderWindow = fullScreenRenderer.getRenderWindow();

    rendererRef.current = renderer;
    renderWindowRef.current = renderWindow;

    const interactor = renderWindow.getInteractor();
    interactor.initialize();
    interactor.bindEvents(vtkContainer);

    // Load VTP data
    if (vtpData) {
      loadVtpData(vtpData);
    } else if (vtpUrl) {
      loadVtpFromUrl(vtpUrl);
    }

    return () => {
      // Cleanup
      if (orientationWidgetRef.current) {
        orientationWidgetRef.current.delete();
        orientationWidgetRef.current = null;
      }
      if (fullScreenRendererRef.current) {
        fullScreenRendererRef.current.delete();
        fullScreenRendererRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
      rendererRef.current = null;
      renderWindowRef.current = null;
    };
  }, [open, vtpData, vtpUrl]);

  return (
    <>
      <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <p className="font-medium text-green-800 dark:text-green-200">{title}</p>
        <p className="text-sm text-green-600 dark:text-green-300">{description}</p>
        <p className="text-xs text-green-500 dark:text-green-400 mt-1">
          3D geometry is now displayed in the side panel →
        </p>
      </div>

      <Artifact title={title}>
        <div className="w-full h-full min-h-[600px] bg-gray-100 
                        dark:bg-gray-900 rounded-lg">
          <div 
            ref={containerRef}
            className="w-full h-full"
            style={{ position: 'relative' }}
          />
        </div>
      </Artifact>
    </>
  );
};

export default VtpRenderer;