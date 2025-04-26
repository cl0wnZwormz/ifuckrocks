import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from '@/styles/Home.module.css';

// Add type declaration for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        theme?: string;
        action?: string;
      }) => string;
    };
  }
}

// Create a client-side only Turnstile component
const TurnstileWidget = dynamic(() => Promise.resolve(({ onVerify }: { onVerify: (token: string) => void }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoading(false);
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && widgetRef.current && window.turnstile && !widgetId.current) {
      const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!sitekey) {
        console.error('Turnstile site key is missing');
        return;
      }
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey,
        callback: (token: string) => {
          setIsVerified(true);
          onVerify(token);
        },
        theme: 'dark',
        action: 'upload'
      });
    }
  }, [isLoading, onVerify]);

  if (isLoading) {
    return <div className={styles.turnstileLoading}>Loading verification...</div>;
  }

  if (isVerified) {
    return null;
  }

  return (
    <div className={styles.turnstileContainer}>
      <div className={styles.turnstileWrapper}>
        <div ref={widgetRef} />
      </div>
    </div>
  );
}), { ssr: false });

interface UploadedFile {
  file: File;
  url: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

const descriptions: string[] = [
  "Rock-solid file sharing",
  "Your files drive me rock hard",
  "50/50 chance of being solid and crumbling apart.",
  "Don't take it for boulder.",
  "We don't take shit for granite.",
  "Get your rocks off — literally.",
  "Hard as a boulder, fast as an avalanche.",
  "Sediment? Nah, we bedrockin' your files!",
  "Rock solid sharing, no pebbles in the gears.",
  "Built to stone — break it if you can.",
  "Geologically speaking, we're the hardest MF around.",
  "Not just another pebble in the pond — we make waves.",
  "Crumble-proof. Like your ex's dreams.",
  "Drop your load like a landslide."
];

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [description, setDescription] = useState("Rock-solid file sharing");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set random description only on client-side
  useEffect(() => {
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
    setDescription(randomDescription);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      const newFile: UploadedFile = {
        file,
        url: '',
        progress: 0,
        status: 'error',
        errorMessage: 'Your rock is too heavy idoit'
      };
      setUploadedFiles(prev => [...prev, newFile]);
      return;
    }

    if (!turnstileToken) {
      const newFile: UploadedFile = {
        file,
        url: '',
        progress: 0,
        status: 'error',
        errorMessage: 'Please complete the verification below'
      };
      setUploadedFiles(prev => [...prev, newFile]);
      return;
    }
    
    const newFile: UploadedFile = {
      file,
      url: '',
      progress: 0,
      status: 'uploading'
    };
    
    setUploadedFiles(prev => [...prev, newFile]);

    try {
      const progressInterval = setInterval(() => {
        setUploadedFiles(prev => prev.map(f => 
          f.file === file 
            ? { ...f, progress: Math.min(f.progress + 10, 90) }
            : f
        ));
      }, 300);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cf-turnstile-response', turnstileToken);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          throw new Error(errorData.message || 'Rate limit exceeded');
        }
        
        throw new Error(errorData.message || 'Upload failed');
      }
      
      const data = await response.json();
      
      clearInterval(progressInterval);
      setUploadedFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, progress: 100, status: 'success', url: data.url }
          : f
      ));
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, status: 'error', errorMessage: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ));
    }
  };

  const handleTurnstileVerify = (token: string) => {
    console.log('Setting Turnstile token:', token);
    setTurnstileToken(token);
  };

  useEffect(() => {
    // Load Ko-fi script
    const script = document.createElement('script');
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
    script.async = true;
    script.onload = () => {
      // @ts-expect-error - Ko-fi widget is loaded dynamically
      window.kofiWidgetOverlay.draw('ifrocks', {
        'type': 'floating-chat',
        'floating-chat.donateButton.text': 'Support Us',
        'floating-chat.donateButton.background-color': '#323842',
        'floating-chat.donateButton.text-color': '#fff'
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          <span className={styles.titlePurple}>i</span>
          <span className={styles.titlePink}>fuck</span>
          <span className={styles.titleBlue}>rocks</span>
        </h1>
        <p className={styles.description}>{description}</p>

        <div
          className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.uploadContent}>
            <div className={styles.rockEmoji}>🪨</div>
            <div className={styles.uploadText}>
              <p>Drop your files here</p>
              <p>or</p>
              <div className={styles.uploadButton}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.button}
                >
                  Upload File
                </button>
              </div>
            </div>
          </div>
        </div>

        <TurnstileWidget onVerify={handleTurnstileVerify} />

        {/* Display uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className={styles.uploadedFiles}>
            {uploadedFiles.map((uploadedFile, index) => (
              <div key={index} className={styles.uploadedFile}>
                <div className={styles.fileHeader}>
                  <p className={styles.fileName}>{uploadedFile.file.name}</p>
                  <span className={`${styles.fileStatus} ${
                    uploadedFile.status === 'success' ? styles.success :
                    uploadedFile.status === 'error' ? styles.error :
                    styles.uploading
                  }`}>
                    {uploadedFile.status === 'success' ? 'Uploaded' :
                     uploadedFile.status === 'error' ? 'Failed' :
                     'Uploading...'}
                  </span>
                </div>
                
                {uploadedFile.status === 'uploading' && (
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${uploadedFile.progress}%` }}
                    ></div>
                  </div>
                )}
                
                {uploadedFile.status === 'success' && (
                  <div className={styles.urlContainer}>
                    <input 
                      type="text" 
                      value={uploadedFile.url} 
                      readOnly 
                      className={styles.urlInput}
                    />
                    <button 
                      onClick={() => navigator.clipboard.writeText(uploadedFile.url)}
                      className={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                )}
                
                {uploadedFile.status === 'error' && (
                  <p className={styles.errorMessage}>
                    {uploadedFile.errorMessage || 'Upload failed. Please try again.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <p>Supported formats: All files welcome</p>
          <p>Maximum file size: 200MB</p>
          <p>Copyright 2025 ifuckrocks</p>
          <p>The site is funded only by donations</p>
          <p>
            Made with <span>❤️</span> by{' '}
            <a 
              href="https://github.com/cl0wnZwormz" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ textDecoration: 'underline' }}
            >
              kamikaze
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
