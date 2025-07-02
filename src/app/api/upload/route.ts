import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// S3 configuration - using server-side env vars (without NEXT_PUBLIC_)
const s3Client = new S3Client({
  region: process.env.APP_AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY || '',
    secretAccessKey: process.env.APP_AWS_SECRET_KEY || '',
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME || 'keystone-user-content-files';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.dwg') && !fileName.endsWith('.dxf')) {
      return NextResponse.json({ error: 'Only .dwg and .dxf files are supported' }, { status: 400 });
    }

    // Generate unique key for the file
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const uniqueId = uuidv4();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Create organized S3 key structure
    const s3Key = `user-uploads/drawings/${year}/${month}/${uniqueId}.${fileExtension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ContentLength: file.size,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);

    // Return structured result matching our S3UploadResult interface
    const result = {
      s3_key: s3Key,
      s3_bucket: BUCKET_NAME,
      s3_region: process.env.APP_AWS_REGION || 'eu-north-1',
      metadata: {
        filename: `${uniqueId}.${fileExtension}`,
        original_name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('S3 upload failed:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}