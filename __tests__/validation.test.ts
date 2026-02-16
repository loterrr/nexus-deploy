import { validateFile, sanitizeInput } from '@/lib/validation';

describe('Validation Utilities', () => {
    describe('validateFile', () => {
        it('should accept valid PDF files under 50MB', () => {
            const mockFile = new File(['test content'], 'test.pdf', {
                type: 'application/pdf',
            });
            Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 }); // 1MB

            const result = validateFile(mockFile);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject files larger than 50MB', () => {
            const mockFile = new File(['test'], 'large.pdf', {
                type: 'application/pdf',
            });
            Object.defineProperty(mockFile, 'size', { value: 51 * 1024 * 1024 }); // 51MB

            const result = validateFile(mockFile);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('File too large (max 50MB)');
        });

        it('should reject non-PDF files', () => {
            const mockFile = new File(['test'], 'test.txt', {
                type: 'text/plain',
            });

            const result = validateFile(mockFile);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Only PDF files supported');
        });
    });

    describe('sanitizeInput', () => {
        it('should trim whitespace', () => {
            expect(sanitizeInput('  hello  ')).toBe('hello');
        });

        it('should limit input to 2000 characters', () => {
            const longInput = 'a'.repeat(3000);
            const result = sanitizeInput(longInput);
            expect(result.length).toBe(2000);
        });

        it('should handle empty strings', () => {
            expect(sanitizeInput('')).toBe('');
            expect(sanitizeInput('   ')).toBe('');
        });
    });
});
