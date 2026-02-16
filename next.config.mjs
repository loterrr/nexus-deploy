/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            'onnxruntime-node': false,
        };

        config.resolve.fallback = {
            ...config.resolve.fallback,
            'onnxruntime-node': false,
            'onnxruntime-common': false,
            'sharp': false,
            'fs': false,
            'path': false,
        };

        return config;
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://raw.githubusercontent.com; img-src 'self' data: blob:;"
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    }
                ]
            }
        ];
    }
};

export default nextConfig;
