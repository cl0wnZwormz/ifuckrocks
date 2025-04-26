import { NextApiRequest, NextApiResponse } from 'next';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';
import { rateLimit } from '@/lib/rateLimit';
import formidable from 'formidable';
import { promises as fsPromises } from 'fs';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

// Create a rate limiter that allows 10 uploads per hour per IP
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour in milliseconds
  limit: 10,                // 10 uploads per hour
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Apply rate limiting
  limiter(req, res, async () => {
    try {
      // Check if environment variables are set
      if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
        return res.status(500).json({ message: 'Server configuration error' });
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (!turnstileSecret) {
        return res.status(500).json({ message: 'Server configuration error' });
      }

      const form = formidable({
        maxFileSize: MAX_FILE_SIZE,
        filter: () => true,
      });

      const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              reject(new Error('File size exceeds 200MB limit'));
            } else {
              reject(err);
            }
            return;
          }
          resolve([fields, files]);
        });
      });

      // Verify Turnstile token
      const turnstileResponse = fields['cf-turnstile-response'];
      const turnstileToken = turnstileResponse 
        ? (Array.isArray(turnstileResponse) ? turnstileResponse[0] : turnstileResponse)
        : null;

      if (!turnstileToken) {
        return res.status(400).json({ message: 'Missing Turnstile token' });
      }

      const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
          remoteip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
        }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        return res.status(403).json({ message: 'Turnstile verification failed' });
      }

      const fileArray = files.file;
      if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const file = fileArray[0];
      
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ message: 'File size exceeds 200MB limit' });
      }

      const buffer = await fsPromises.readFile(file.filepath);
      const key = `${Date.now()}-${file.originalFilename}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype || 'application/octet-stream',
        })
      );

      try {
        await fsPromises.unlink(file.filepath);
      } catch {
        // Continue even if we can't delete the temp file
      }

      const url = `${process.env.R2_PUBLIC_URL}/${key}`;
      return res.status(200).json({ url });
    } catch (error) {
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Upload failed' 
      });
    }
  });
} 