import { buildUserMessage, SYSTEM_PROMPT, INITIAL_GREETING } from '@/lib/constants';

describe('Constants and Shared Utilities', () => {
    describe('SYSTEM_PROMPT', () => {
        it('should contain key instructions', () => {
            expect(SYSTEM_PROMPT).toContain('The Archive');
            expect(SYSTEM_PROMPT).toContain('[Source: filename.pdf]');
            expect(SYSTEM_PROMPT).toContain('ONLY');
        });

        it('should be a non-empty string', () => {
            expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
        });
    });

    describe('INITIAL_GREETING', () => {
        it('should mention The Archive', () => {
            expect(INITIAL_GREETING).toContain('The Archive');
        });
    });

    describe('buildUserMessage', () => {
        it('should build context-aware message when context is provided', () => {
            const message = buildUserMessage('What is ML?', 'Context about machine learning');
            expect(message).toContain('Reference Context');
            expect(message).toContain('Context about machine learning');
            expect(message).toContain('What is ML?');
            expect(message).toContain('ONLY');
        });

        it('should build no-documents message when context is not provided', () => {
            const message = buildUserMessage('What is ML?');
            expect(message).toContain('No documents uploaded');
            expect(message).toContain('What is ML?');
            expect(message).not.toContain('Reference Context');
        });

        it('should build no-documents message when context is empty string', () => {
            const message = buildUserMessage('test');
            expect(message).toContain('No documents uploaded');
        });
    });
});
