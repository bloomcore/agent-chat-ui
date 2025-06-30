import { useState, useRef, useEffect, ChangeEvent } from "react";
import { toast } from "sonner";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { fileToContentBlock } from "@/lib/multimodal-utils";

// Updated MIME types for CAD files - includes common detection types
export const SUPPORTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif", 
  "image/webp",
  "application/pdf",
  // DWG file MIME types (browsers may detect differently)
  "application/acad",
  "image/vnd.dwg",
  "application/dwg",
  "image/x-dwg",
  "application/x-dwg",
  "image/x-autocad",
  "application/octet-stream", // Very common for DWG files
  // DXF file MIME types
  "application/dxf",
  "image/vnd.dxf",
  "text/plain", // DXF files are sometimes detected as plain text
];

interface UseFileUploadOptions {
  initialBlocks?: Base64ContentBlock[];
}

export function useFileUpload({
  initialBlocks = [],
}: UseFileUploadOptions = {}) {
  const [contentBlocks, setContentBlocks] =
    useState<Base64ContentBlock[]>(initialBlocks);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Enhanced function to check if a file is a CAD file based on extension
  const isCADFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    return extension === 'dwg' || extension === 'dxf';
  };

  // Enhanced file validation - prioritizes extension for CAD files
  const isValidFile = (file: File): boolean => {
    console.log('Validating file:', {
      name: file.name,
      type: file.type || 'no MIME type',
      extension: file.name.split('.').pop()?.toLowerCase()
    });

    // First check if it's a CAD file by extension (most reliable)
    if (isCADFile(file)) {
      console.log(' Valid CAD file detected by extension');
      return true;
    }

    // Then check MIME type for other files
    if (SUPPORTED_FILE_TYPES.includes(file.type)) {
      console.log(' Valid file detected by MIME type');
      return true;
    }

    // Special case: application/octet-stream might be a CAD file
    if (file.type === "application/octet-stream") {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'dwg' || extension === 'dxf') {
        console.log(' Valid CAD file detected as octet-stream');
        return true;
      }
    }

    console.log(' File validation failed');
    return false;
  };

  const isDuplicate = (file: File, blocks: Base64ContentBlock[]) => {
    if (file.type === "application/pdf") {
      return blocks.some(
        (b) =>
          b.type === "file" &&
          b.mime_type === "application/pdf" &&
          b.metadata?.filename === file.name,
      );
    }
    
    // For CAD files, check by filename since MIME types vary
    if (isCADFile(file)) {
      return blocks.some(
        (b) =>
          b.type === "file" &&
          b.metadata?.filename === file.name
      );
    }
    
    // Check for other supported types
    if (isValidFile(file)) {
      return blocks.some(
        (b) =>
          ((b.type === "image" && b.metadata?.name === file.name) ||
           (b.type === "file" && b.metadata?.filename === file.name))
      );
    }
    return false;
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const fileArray = Array.from(files);
    
    console.log('Files selected:', fileArray.map(f => ({
      name: f.name,
      type: f.type || 'no MIME type',
      size: f.size
    })));
    
    const validFiles = fileArray.filter(isValidFile);
    const invalidFiles = fileArray.filter((file) => !isValidFile(file));
    
    console.log('Valid files:', validFiles.length);
    console.log('Invalid files:', invalidFiles.length);
    
    const duplicateFiles = validFiles.filter((file) =>
      isDuplicate(file, contentBlocks),
    );
    const uniqueFiles = validFiles.filter(
      (file) => !isDuplicate(file, contentBlocks),
    );

    if (invalidFiles.length > 0) {
      console.log('Invalid files details:', invalidFiles.map(f => ({
        name: f.name,
        type: f.type,
        extension: f.name.split('.').pop()
      })));
      
      toast.error(
        `Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Please upload JPEG, PNG, GIF, WEBP images, PDF, DWG or DXF files.`,
      );
    }
    if (duplicateFiles.length > 0) {
      toast.error(
        `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
      );
    }

    if (uniqueFiles.length > 0) {
      console.log('Processing unique files:', uniqueFiles.map(f => f.name));
      try {
        const newBlocks = await Promise.all(uniqueFiles.map(fileToContentBlock));
        setContentBlocks((prev) => [...prev, ...newBlocks]);
        console.log('Successfully processed files');
      } catch (error) {
        console.error('Error processing files:', error);
        toast.error('Error processing files. Please try again.');
      }
    }
    
    e.target.value = "";
  };

  // Drag and drop handlers with enhanced validation
  useEffect(() => {
    if (!dropRef.current) return;

    // Global drag events with counter for robust dragOver state
    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current += 1;
        setDragOver(true);
      }
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          setDragOver(false);
          dragCounter.current = 0;
        }
      }
    };
    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);

      if (!e.dataTransfer) return;

      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter(isValidFile);
      const invalidFiles = files.filter((file) => !isValidFile(file));
      
      const duplicateFiles = validFiles.filter((file) =>
        isDuplicate(file, contentBlocks),
      );
      const uniqueFiles = validFiles.filter(
        (file) => !isDuplicate(file, contentBlocks),
      );

      if (invalidFiles.length > 0) {
        toast.error(
          `Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Please upload JPEG, PNG, GIF, WEBP images, PDF, DWG or DXF files.`,
        );
      }
      if (duplicateFiles.length > 0) {
        toast.error(
          `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
        );
      }

      if (uniqueFiles.length > 0) {
        try {
          const newBlocks = await Promise.all(uniqueFiles.map(fileToContentBlock));
          setContentBlocks((prev) => [...prev, ...newBlocks]);
        } catch (error) {
          console.error('Error processing dropped files:', error);
          toast.error('Error processing dropped files. Please try again.');
        }
      }
    };
    const handleWindowDragEnd = (e: DragEvent) => {
      dragCounter.current = 0;
      setDragOver(false);
    };
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragend", handleWindowDragEnd);

    // Prevent default browser behavior for dragover globally
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", handleWindowDragOver);

    // Remove element-specific drop event (handled globally)
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const element = dropRef.current;
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("dragenter", handleDragEnter);
    element.addEventListener("dragleave", handleDragLeave);

    return () => {
      element.removeEventListener("dragover", handleDragOver);
      element.removeEventListener("dragenter", handleDragEnter);
      element.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragend", handleWindowDragEnd);
      window.removeEventListener("dragover", handleWindowDragOver);
      dragCounter.current = 0;
    };
  }, [contentBlocks]);

  const removeBlock = (idx: number) => {
    setContentBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetBlocks = () => setContentBlocks([]);

  /**
   * Handle paste event for files (images, PDFs, CAD files)
   * Can be used as onPaste={handlePaste} on a textarea or input
   */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const items = e.clipboardData.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) {
      return;
    }
    e.preventDefault();
    
    const validFiles = files.filter(isValidFile);
    const invalidFiles = files.filter((file) => !isValidFile(file));
    
    const isDuplicatePaste = (file: File) => {
      if (file.type === "application/pdf") {
        return contentBlocks.some(
          (b) =>
            b.type === "file" &&
            b.mime_type === "application/pdf" &&
            b.metadata?.filename === file.name,
        );
      }
      if (isValidFile(file)) {
        return contentBlocks.some(
          (b) =>
            ((b.type === "image" && b.metadata?.name === file.name) ||
             (b.type === "file" && b.metadata?.filename === file.name))
        );
      }
      return false;
    };
    
    const duplicateFiles = validFiles.filter(isDuplicatePaste);
    const uniqueFiles = validFiles.filter((file) => !isDuplicatePaste(file));
    
    if (invalidFiles.length > 0) {
      toast.error(
        `Invalid pasted file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Please paste JPEG, PNG, GIF, WEBP images, PDF, DWG or DXF files.`,
      );
    }
    if (duplicateFiles.length > 0) {
      toast.error(
        `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
      );
    }
    if (uniqueFiles.length > 0) {
      try {
        const newBlocks = await Promise.all(uniqueFiles.map(fileToContentBlock));
        setContentBlocks((prev) => [...prev, ...newBlocks]);
      } catch (error) {
        console.error('Error processing pasted files:', error);
        toast.error('Error processing pasted files. Please try again.');
      }
    }
  };

  return {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks,
    dragOver,
    handlePaste,
  };
}

