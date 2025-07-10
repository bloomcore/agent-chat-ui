import type { Base64ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";
import { uploadFileToS3 } from "./s3-upload";

// Extended content block type that supports S3 references
export interface S3ContentBlock {
  type: "file";
  source_type: "s3";
  s3_key: string;
  s3_bucket: string;
  s3_region: string;
  metadata: {
    filename: string;
    original_name: string;
    size: number;
    mime_type: string;
    uploaded_at: string;
  };
}

export type ContentBlock = Base64ContentBlock | S3ContentBlock;

// Returns a Promise of a typed multimodal block for images, PDFs, or CAD files
export async function fileToContentBlock(
  file: File,
): Promise<ContentBlock> {
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

  const supportedPythonTypes = [
    "text/x-python",
    "application/x-python-code",
  ];
  
  const supportedFileTypes = [
    ...supportedImageTypes, 
    "application/pdf",
    ...supportedCADTypes,
    ...supportedPythonTypes,
    "text/plain", // DXF files and Python files are sometimes detected as plain text
  ];

  // Helper function to check if a file is a CAD file based on extension
  const isCADFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.dwg') || fileName.endsWith('.dxf');
  };

  // Helper function to check if a file is a Python file based on extension
  const isPythonFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.py');
  };

  // Check if file is supported by MIME type or file extension (for CAD and Python files)
  const isSupported = supportedFileTypes.includes(file.type) || isCADFile(file) || isPythonFile(file);

  if (!isSupported) {
    toast.error(
      `Unsupported file type: ${file.type}. Supported types are: images (JPEG, PNG, GIF, WEBP), PDF, DWG, DXF, and Python files.`,
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

  // Handle CAD files (DWG and DXF) and Python files - Upload to S3 instead of base64
  if (supportedCADTypes.includes(file.type) || isCADFile(file) || supportedPythonTypes.includes(file.type) || isPythonFile(file)) {
    try {
      toast.info(`Uploading ${file.name} to cloud storage...`);
      const s3Result = await uploadFileToS3(file);
      toast.success(`${file.name} uploaded successfully!`);
      
      return {
        type: "file",
        source_type: "s3",
        s3_key: s3Result.s3_key,
        s3_bucket: s3Result.s3_bucket,
        s3_region: s3Result.s3_region,
        metadata: s3Result.metadata,
      };
    } catch (error) {
      console.error("S3 upload failed:", error);
      toast.error(`Failed to upload ${file.name}. Please try again.`);
      return Promise.reject(error);
    }
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

// Type guard for ContentBlock (both Base64 and S3)
export function isContentBlock(
  block: unknown,
): block is ContentBlock {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;
  
  // S3 file type (CAD files)
  if (
    (block as { type: unknown }).type === "file" &&
    "source_type" in block &&
    (block as { source_type: unknown }).source_type === "s3" &&
    "s3_key" in block &&
    "s3_bucket" in block &&
    "s3_region" in block
  ) {
    return true;
  }
  
  // Base64 file type (legacy + PDFs)
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
      mimeType === "image/x-dwg" ||
      mimeType === "text/x-python" ||
      mimeType === "application/x-python-code"
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

// Backward compatibility - keep the old function name
export function isBase64ContentBlock(
  block: unknown,
): block is Base64ContentBlock {
  return isContentBlock(block) && (block as any).source_type === "base64";
}

