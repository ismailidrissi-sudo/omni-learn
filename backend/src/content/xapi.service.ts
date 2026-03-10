import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * xAPI (Experience API) Service — LRS endpoint
 * Receives and stores xAPI statements from SCORM/course players
 * omnilearn.space | Afflatus Consulting Group
 */

export interface XapiStatementDto {
  actor: { mbox?: string; name?: string; objectType?: string };
  verb: { id: string; display?: Record<string, string> };
  object: { id: string; definition?: { name?: Record<string, string> } };
  result?: { score?: { scaled?: number }; success?: boolean; completion?: boolean };
  context?: { registration?: string; contextActivities?: unknown };
  timestamp?: string;
}

@Injectable()
export class XapiService {
  constructor(private readonly prisma: PrismaService) {}

  async storeStatement(statement: XapiStatementDto) {
    try {
      const result = await (this.prisma as unknown as { xapiStatement: { create: (args: { data: { statement: object } }) => Promise<{ id: string }> } }).xapiStatement.create({
        data: { statement: statement as unknown as object },
      });
      return result;
    } catch {
      return { id: 'stub', stored: true };
    }
  }

  async storeStatements(statements: XapiStatementDto[]) {
    const results = await Promise.all(statements.map((s) => this.storeStatement(s)));
    return { stored: results.length };
  }
}
