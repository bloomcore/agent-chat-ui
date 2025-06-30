import type { Base64ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

// Returns a Promise of a typed multimodal block for images, PDFs, or CAD files
export async function fileToContentBlock(
  file: File,
): Promise<Base64ContentBlock> {
  const supportedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  
  const supportedCADTypes = [
    "application/acad",
    "image/vnd.dwg",
    "application/dwg",
    "image/x-dwg",
    "application/dxf",
    "image/vnd.dxf",
    "application/octet-stream", // DWG files often detected as this
    "application/x-dwg",
    "image/x-autocad"
  ];
  
  const supportedFileTypes = [
    ...supportedImageTypes, 
    "application/pdf",
    ...supportedCADTypes,
    "text/plain", // DXF files are sometimes detected as plain text
  ];

  // Helper function to check if a file is a CAD file based on extension
  const isCADFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.dwg') || fileName.endsWith('.dxf');
  };

  // Check if file is supported by MIME type or file extension (for CAD files)
  const isSupported = supportedFileTypes.includes(file.type) || isCADFile(file);

  if (!isSupported) {
    toast.error(
      `Unsupported file type: ${file.type}. Supported types are: images (JPEG, PNG, GIF, WEBP), PDF, DWG, and DXF files.`,
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  const data = await fileToBase64(file);

  // Handle regular image types
  if (supportedImageTypes.includes(file.type)) {
    return {
      type: "image",
      source_type: "base64",
      mime_type: file.type,
      data,
      metadata: { name: file.name },
    };
  }

  // Handle PDF files
  if (file.type === "application/pdf") {
    return {
      type: "file",
      source_type: "base64",
      mime_type: "application/pdf",
      data,
      metadata: { filename: file.name },
    };
  }

  // Handle CAD files (DWG and DXF)
  if (supportedCADTypes.includes(file.type) || isCADFile(file)) {
    // Determine the correct MIME type for CAD files
    let mimeType = file.type;
    if (!mimeType || mimeType === "text/plain") {
      // Fallback based on file extension
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.dwg')) {
        mimeType = 'application/acad';
      } else if (fileName.endsWith('.dxf')) {
        mimeType = 'application/dxf';
      }
    }

    return {
      type: "file",
      source_type: "base64",
      mime_type: mimeType,
      data,
      metadata: { filename: file.name },
    };
  }

  // This shouldn't happen given our validation above, but just in case
  toast.error(`Unexpected file type: ${file.type}`);
  return Promise.reject(new Error(`Unexpected file type: ${file.type}`));
}

// Helper to convert File to base64 string
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Type guard for Base64ContentBlock
export function isBase64ContentBlock(
  block: unknown,
): block is Base64ContentBlock {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;
  
  // file type (legacy + CAD files)
  if (
    (block as { type: unknown }).type === "file" &&
    "source_type" in block &&
    (block as { source_type: unknown }).source_type === "base64" &&
    "mime_type" in block &&
    typeof (block as { mime_type?: unknown }).mime_type === "string"
  ) {
    const mimeType = (block as { mime_type: string }).mime_type;
    return (
      mimeType.startsWith("image/") ||
      mimeType === "application/pdf" ||
      mimeType === "application/acad" ||
      mimeType === "application/dwg" ||
      mimeType === "application/dxf" ||
      mimeType === "image/vnd.dwg" ||
      mimeType === "image/vnd.dxf" ||
      mimeType === "image/x-dwg"
    );
  }
  
  // image type (new)
  if (
    (block as { type: unknown }).type === "image" &&
    "source_type" in block &&
    (block as { source_type: unknown }).source_type === "base64" &&
    "mime_type" in block &&
    typeof (block as { mime_type?: unknown }).mime_type === "string" &&
    (block as { mime_type: string }).mime_type.startsWith("image/")
  ) {
    return true;
  }
  
  return false;
}

