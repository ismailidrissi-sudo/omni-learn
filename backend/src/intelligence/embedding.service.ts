import { Injectable } from '@nestjs/common';

/**
 * Embedding Service — Text to vector (1536 dims for OpenAI compatibility)
 * Uses mock embeddings when OPENAI_API_KEY not set; OpenAI when set.
 * omnilearn.space | Afflatus Consulting Group
 */

const DIM = 1536;

/** Simple deterministic pseudo-embedding from text (for dev without API) */
function mockEmbed(text: string): number[] {
  const arr: number[] = [];
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < DIM; i++) {
    arr.push(rng(h + i * 1000) * 2 - 1);
  }
  const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0)) || 1;
  return arr.map((x) => x / norm);
}

@Injectable()
export class EmbeddingService {
  private useOpenAI = false;

  constructor() {
    this.useOpenAI = !!process.env.OPENAI_API_KEY;
  }

  async embed(text: string): Promise<number[]> {
    if (this.useOpenAI) {
      try {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
        });
        const json = await res.json();
        return json.data?.[0]?.embedding ?? mockEmbed(text);
      } catch {
        return mockEmbed(text);
      }
    }
    return mockEmbed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
