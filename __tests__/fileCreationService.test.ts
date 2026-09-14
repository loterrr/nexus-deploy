import { FileCreationService } from '@/services/fileCreationService';

describe('FileCreationService', () => {
    describe('detectFileCreationIntent', () => {
        it('should detect "create a file" intent', () => {
            expect(FileCreationService.detectFileCreationIntent('create a file called test.txt')).toBe(true);
            expect(FileCreationService.detectFileCreationIntent('make a file named output.json')).toBe(true);
            expect(FileCreationService.detectFileCreationIntent('generate a file for me')).toBe(true);
        });

        it('should detect "save as" intent', () => {
            expect(FileCreationService.detectFileCreationIntent('save this as report.md')).toBe(true);
            expect(FileCreationService.detectFileCreationIntent('export this to summary.txt')).toBe(true);
        });

        it('should not detect non-file-creation messages', () => {
            expect(FileCreationService.detectFileCreationIntent('what is machine learning?')).toBe(false);
            expect(FileCreationService.detectFileCreationIntent('summarize this document')).toBe(false);
        });
    });

    describe('extractFilename', () => {
        it('should extract filename with "called" pattern', () => {
            expect(FileCreationService.extractFilename('create a file called test.txt')).toBe('test.txt');
        });

        it('should extract filename with "named" pattern', () => {
            expect(FileCreationService.extractFilename('make a file named output.json')).toBe('output.json');
        });

        it('should extract filename with "save as" pattern', () => {
            expect(FileCreationService.extractFilename('save this as report.md')).toBe('report.md');
        });

        it('should return null when no filename found', () => {
            expect(FileCreationService.extractFilename('create a file')).toBeNull();
        });
    });

    describe('sanitizeFilename', () => {
        it('should remove path traversal', () => {
            expect(FileCreationService.sanitizeFilename('../../etc/passwd')).not.toContain('..');
        });

        it('should replace special characters with underscores', () => {
            const result = FileCreationService.sanitizeFilename('my file (1).txt');
            expect(result).not.toContain(' ');
            expect(result).not.toContain('(');
        });

        it('should add .txt extension if missing', () => {
            const result = FileCreationService.sanitizeFilename('noextension');
            expect(result).toBe('noextension.txt');
        });

        it('should preserve valid filenames', () => {
            expect(FileCreationService.sanitizeFilename('valid-file_name.md')).toBe('valid-file_name.md');
        });
    });

    describe('getMimeType', () => {
        it('should return correct MIME types', () => {
            expect(FileCreationService.getMimeType('file.txt')).toBe('text/plain');
            expect(FileCreationService.getMimeType('file.json')).toBe('application/json');
            expect(FileCreationService.getMimeType('file.md')).toBe('text/markdown');
            expect(FileCreationService.getMimeType('file.csv')).toBe('text/csv');
        });

        it('should default to text/plain for unknown extensions', () => {
            expect(FileCreationService.getMimeType('file.xyz')).toBe('text/plain');
        });
    });

    describe('extractContent', () => {
        it('should extract content from code blocks in AI response', () => {
            const aiResponse = 'Here is the content:\n```json\n{"key": "value"}\n```';
            expect(FileCreationService.extractContent('create file', aiResponse)).toBe('{"key": "value"}');
        });

        it('should extract quoted content from AI response', () => {
            const aiResponse = 'The content is: "Hello World"';
            expect(FileCreationService.extractContent('create file', aiResponse)).toBe('Hello World');
        });

        it('should extract content from user message with "with" pattern', () => {
            const content = FileCreationService.extractContent('create a file with content: hello world');
            expect(content).toBe('hello world');
        });

        it('should return empty string when no content found', () => {
            expect(FileCreationService.extractContent('create a file')).toBe('');
        });
    });
});
