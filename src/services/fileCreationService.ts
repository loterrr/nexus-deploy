export interface FileCreationRequest {
    filename: string;
    content: string;
    mimeType: string;
}

export interface FileCreationResult {
    success: boolean;
    filename?: string;
    error?: string;
}

export class FileCreationService {
    static detectFileCreationIntent(message: string): boolean {
        const patterns = [
            /create\s+(?:a\s+)?file/i,
            /make\s+(?:a\s+)?file/i,
            /save\s+(?:this\s+)?as/i,
            /generate\s+(?:a\s+)?file/i,
            /write\s+(?:a\s+)?file/i,
            /export\s+(?:this\s+)?(?:to|as)/i,
        ];

        return patterns.some(pattern => pattern.test(message));
    }

    static extractFilename(message: string): string | null {
        const patterns = [
            /(?:called|named)\s+["']?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)["']?/i,
            /(?:save|export)\s+(?:this\s+)?(?:as|to)\s+["']?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)["']?/i,
            /file\s+["']?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)["']?/i,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return this.sanitizeFilename(match[1]);
            }
        }

        return null;
    }

    static sanitizeFilename(filename: string): string {
        let sanitized = filename.replace(/\.\./g, '');
        sanitized = sanitized.replace(/[^a-zA-Z0-9._\-]/g, '_');

        if (!sanitized.includes('.')) {
            sanitized += '.txt';
        }

        return sanitized;
    }

    static getMimeType(filename: string): string {
        const extension = filename.split('.').pop()?.toLowerCase();

        const mimeTypes: Record<string, string> = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'csv': 'text/csv',
            'html': 'text/html',
            'xml': 'application/xml',
            'js': 'text/javascript',
            'ts': 'text/typescript',
            'py': 'text/x-python',
            'java': 'text/x-java',
            'cpp': 'text/x-c++src',
            'c': 'text/x-csrc',
            'sh': 'application/x-sh',
            'yaml': 'text/yaml',
            'yml': 'text/yaml',
        };

        return mimeTypes[extension || 'txt'] || 'text/plain';
    }

    static extractContent(message: string, aiResponse?: string): string {
        if (aiResponse) {
            const codeBlockMatch = aiResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
                return codeBlockMatch[1].trim();
            }

            const quotedMatch = aiResponse.match(/"([\s\S]*?)"/);
            if (quotedMatch && quotedMatch[1]) {
                return quotedMatch[1];
            }
        }
        const withMatch = message.match(/with\s+(?:content|text|data)?:?\s*["']?([\s\S]+?)["']?$/i);
        if (withMatch && withMatch[1]) {
            return withMatch[1].trim();
        }

        return '';
    }

    static createFile(request: FileCreationRequest): void {
        try {
            const blob = new Blob([request.content], { type: request.mimeType });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = request.filename;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log(`✅ File created: ${request.filename}`);
        } catch (error) {
            console.error('❌ File creation failed:', error);
            throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async handleFileCreation(
        userMessage: string,
        aiResponse?: string
    ): Promise<{ success: boolean; filename?: string; error?: string }> {
        try {
            if (!this.detectFileCreationIntent(userMessage)) {
                return { success: false, error: 'Not a file creation request' };
            }

            const filename = this.extractFilename(userMessage);
            if (!filename) {
                return { success: false, error: 'Could not extract filename from message' };
            }

            const content = this.extractContent(userMessage, aiResponse);
            if (!content) {
                return { success: false, error: 'No content found to write to file' };
            }
            const mimeType = this.getMimeType(filename);

            this.createFile({ filename, content, mimeType });

            return { success: true, filename };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
