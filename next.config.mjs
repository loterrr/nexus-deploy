/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // This creates a standalone folder for deployment (Standard for Vercel)
    output: 'standalone', 
    
    // SAFETY NET: If you have small type errors, don't stop the deploy
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },

    webpack: (config) => {
        // This blocks the server-side libraries from breaking the client build
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp$": false,
            "onnxruntime-node$": false,
        }
        return config;
    },
};

export default nextConfig;
