import ollama from 'ollama';
export class GemmaClient {
    model;
    systemPrompt;
    constructor(model = 'gemma4', systemPrompt) {
        this.model = model;
        this.systemPrompt = systemPrompt;
    }
    getMessages(messages) {
        if (this.systemPrompt) {
            return [{ role: 'system', content: this.systemPrompt }, ...messages];
        }
        return messages;
    }
    async chat(messages) {
        try {
            const response = await ollama.chat({
                model: this.model,
                messages: this.getMessages(messages),
                stream: false,
            });
            return response.message.content;
        }
        catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Could not connect to Ollama. Is it running?');
            }
            throw error;
        }
    }
    async *streamChat(messages) {
        try {
            const response = await ollama.chat({
                model: this.model,
                messages: this.getMessages(messages),
                stream: true,
            });
            for await (const part of response) {
                yield part.message.content;
            }
        }
        catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Could not connect to Ollama. Is it running?');
            }
            if (error.message?.includes('loading model')) {
                throw new Error('Gemma is still loading into memory. Please wait 30-60 seconds and try again.');
            }
            throw error;
        }
    }
}
