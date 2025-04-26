import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Primary Meta Tags */}
        <meta name="title" content="ifuckrocks - Rock Solid File Sharing" />
        <meta name="description" content="Rock solid file sharing platform. Upload and share files with ease." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ifuck.rocks/" />
        <meta property="og:title" content="ifuckrocks - Rock Solid File Sharing" />
        <meta property="og:description" content="Rock solid file sharing platform. Upload and share files with ease." />
        <meta property="og:image" content="https://ifuck.rocks/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://ifuck.rocks/" />
        <meta property="twitter:title" content="ifuckrocks - Rock Solid File Sharing" />
        <meta property="twitter:description" content="Rock solid file sharing platform. Upload and share files with ease." />
        <meta property="twitter:image" content="https://ifuck.rocks/og-image.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
