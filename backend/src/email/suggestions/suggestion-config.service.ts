import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface SuggestionConfig {
  triggers: {
    postSignupDay1: { enabled: boolean; cooldownHours: number };
    postSignupDay3: { enabled: boolean; cooldownHours: number };
    postSignupDay7: { enabled: boolean; cooldownHours: number };
    inactivity: { enabled: boolean; cooldownDays: number; inactiveDays: number };
    weeklyDigest: { enabled: boolean };
  };
  curatedContentIds: string[];
}

const DEFAULT_CONFIG: SuggestionConfig = {
  triggers: {
    postSignupDay1: { enabled: true, cooldownHours: 48 },
    postSignupDay3: { enabled: true, cooldownHours: 48 },
    postSignupDay7: { enabled: true, cooldownHours: 72 },
    inactivity: { enabled: true, cooldownDays: 14, inactiveDays: 14 },
    weeklyDigest: { enabled: true },
  },
  curatedContentIds: [],
};

function deepMergeConfig(over: Partial<SuggestionConfig> | null | undefined): SuggestionConfig {
  if (!over || typeof over !== 'object') return structuredClone(DEFAULT_CONFIG);
  const base = structuredClone(DEFAULT_CONFIG);
  const t = over.triggers;
  if (t && typeof t === 'object') {
    if (t.postSignupDay1 && typeof t.postSignupDay1 === 'object') {
      base.triggers.postSignupDay1 = { ...base.triggers.postSignupDay1, ...t.postSignupDay1 };
    }
    if (t.postSignupDay3 && typeof t.postSignupDay3 === 'object') {
      base.triggers.postSignupDay3 = { ...base.triggers.postSignupDay3, ...t.postSignupDay3 };
    }
    if (t.postSignupDay7 && typeof t.postSignupDay7 === 'object') {
      base.triggers.postSignupDay7 = { ...base.triggers.postSignupDay7, ...t.postSignupDay7 };
    }
    if (t.inactivity && typeof t.inactivity === 'object') {
      base.triggers.inactivity = { ...base.triggers.inactivity, ...t.inactivity };
    }
    if (t.weeklyDigest && typeof t.weeklyDigest === 'object') {
      base.triggers.weeklyDigest = { ...base.triggers.weeklyDigest, ...t.weeklyDigest };
    }
  }
  if (Array.isArray(over.curatedContentIds)) {
    base.curatedContentIds = over.curatedContentIds.filter((id) => typeof id === 'string');
  }
  return base;
}

@Injectable()
export class SuggestionConfigService {
  private readonly filePath = join(process.cwd(), 'data', 'suggestion-config.json');

  getDefaults(): SuggestionConfig {
    return structuredClone(DEFAULT_CONFIG);
  }

  async getConfig(): Promise<SuggestionConfig> {
    if (!existsSync(this.filePath)) {
      return this.getDefaults();
    }
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SuggestionConfig>;
      return deepMergeConfig(parsed);
    } catch {
      return this.getDefaults();
    }
  }

  async saveConfig(body: unknown): Promise<SuggestionConfig> {
    const merged = deepMergeConfig(body as Partial<SuggestionConfig>);
    const dir = join(process.cwd(), 'data');
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }
}
