import { NextRequest, NextResponse } from 'next/server';
import { OLLAMA_MODEL, OLLAMA_STOP_SEQUENCES, OLLAMA_REPEAT_PENALTY } from '@/lib/constants';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Health check / connection check
        if (body.action === 'check') {
            try {
                const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`, {
                    signal: AbortSignal.timeout(5000),
                });

                if (!tagsRes.ok) {
                    return NextResponse.json({ connected: false, modelAvailable: false });
                }

                const tagsData = await tagsRes.json();
                const models = tagsData.models || [];
                const targetModel = body.model || OLLAMA_MODEL;

                const isMatch = (installed: string, target: string) => {
                    const cleanTarget = target.toLowerCase();
                    const cleanInstalled = installed.toLowerCase();
                    return (
                        cleanInstalled === cleanTarget ||
                        cleanInstalled === `${cleanTarget}:latest` ||
                        cleanInstalled.startsWith(`${cleanTarget}:`) ||
                        cleanInstalled.split(':')[0] === cleanTarget
                    );
                };

                const matchedModel = models.find((m: any) => isMatch(m.name, targetModel));
                const modelAvailable = !!matchedModel;

                return NextResponse.json({
                    connected: true,
                    modelAvailable,
                    matchedModel: matchedModel?.name || targetModel,
                    availableModels: models.map((m: any) => m.name),
                });
            } catch {
                return NextResponse.json({ connected: false, modelAvailable: false });
            }
        }

        // Chat request
        if (body.action === 'chat') {
            const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: body.model,
                    messages: body.messages,
                    stream: body.stream ?? true,
                    options: {
                        temperature: 0.1,
                        num_ctx: 4096,
                        repeat_penalty: OLLAMA_REPEAT_PENALTY,
                        stop: OLLAMA_STOP_SEQUENCES,
                    },
                }),
            });

            if (!ollamaRes.ok) {
                const errorText = await ollamaRes.text();
                return NextResponse.json(
                    { error: `Ollama error: ${errorText}` },
                    { status: ollamaRes.status }
                );
            }

            if (body.stream && ollamaRes.body) {
                return new Response(ollamaRes.body, {
                    headers: {
                        'Content-Type': 'application/x-ndjson',
                        'Transfer-Encoding': 'chunked',
                    },
                });
            }

            const data = await ollamaRes.json();
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        console.error('Ollama proxy error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
