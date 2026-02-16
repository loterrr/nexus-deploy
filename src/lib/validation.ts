export function validateFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 50 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
        return { valid: false, error: 'File too large (max 50MB)' };
    }

    if (file.type !== 'application/pdf') {
        return { valid: false, error: 'Only PDF files supported' };
    }

    return { valid: true };
}
export function sanitizeInput(input: string): string {
    return input.trim().slice(0, 2000);
}