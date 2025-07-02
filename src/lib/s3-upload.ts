// No longer need direct S3 client in frontend - using backend API endpoint

export interface S3UploadResult {
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

/**
 * Upload a file to S3 via backend API endpoint
 */
export async function uploadFileToS3(file: File): Promise<S3UploadResult> {
  try {
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', file);

    // Upload via backend API
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: S3UploadResult = await response.json();
    return result;
  } catch (error) {
    console.error("S3 upload failed:", error);
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check if a file should be uploaded to S3 (currently only .dwg files)
 */
export function shouldUploadToS3(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.dwg') || fileName.endsWith('.dxf');
}

/**
 * Get file size in a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}