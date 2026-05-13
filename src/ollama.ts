import ollama from 'ollama';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class GemmaClient {
  private model: string;
  private systemPrompt?: string;

  constructor(model: string = 'gemma4', systemPrompt?: string) {
    this.model = model;
    this.systemPrompt = systemPrompt;
  }

  private getMessages(messages: Message[]): Message[] {
    if (this.systemPrompt) {
      return [{ role: 'system', content: this.systemPrompt }, ...messages];
    }
    return messages;
  }

  async chat(messages: Message[]): Promise<string> {
    try {
      const response = await ollama.chat({
        model: this.model,
        messages: this.getMessages(messages),
        stream: false,
      });
      return response.message.content;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Could not connect to Ollama. Is it running?');
      }
      throw error;
    }
  }

  async *streamChat(messages: Message[]) {
    try {
      const response = await ollama.chat({
        model: this.model,
        messages: this.getMessages(messages),
        stream: true,
      });
      for await (const part of response) {
        yield part.message.content;
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Could not connect to Ollama. Is it running?');
      }
      throw error;
    }
  }
}
