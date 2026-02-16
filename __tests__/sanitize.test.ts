import { sanitizePDFText } from '@/lib/sanitize';

describe('Sanitization Utilities', () => {
    describe('sanitizePDFText', () => {
        it('should remove script tags', () => {
            const input = 'Hello <script>alert("xss")</script> World';
            const result = sanitizePDFText(input);
            expect(result).toBe('Hello  World');
        });

        it('should remove iframe tags', () => {
            const input = 'Content <iframe src="evil.com"></iframe> here';
            const result = sanitizePDFText(input);
            expect(result).toBe('Content  here');
        });

        it('should handle multiple script tags', () => {
            const input = '<script>bad1</script>Good<script>bad2</script>';
            const result = sanitizePDFText(input);
            expect(result).toBe('Good');
        });

        it('should trim whitespace', () => {
            const input = '  clean text  ';
            const result = sanitizePDFText(input);
            expect(result).toBe('clean text');
        });

        it('should handle clean text without modification', () => {
            const input = 'This is clean PDF text content.';
            const result = sanitizePDFText(input);
            expect(result).toBe(input);
        });
    });
});
