export function validateEnv() {
    const required = ['NEXT_PUBLIC_MODEL_PATH'];

    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
    }
}