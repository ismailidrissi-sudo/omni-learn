import { Controller, Post, Body } from '@nestjs/common';
import { XapiService, XapiStatementDto } from './xapi.service';

/**
 * xAPI LRS endpoint — POST /xapi/statements
 * Accepts single statement or array (batch)
 */
@Controller('xapi')
export class XapiController {
  constructor(private readonly xapiService: XapiService) {}

  @Post('statements')
  async postStatement(@Body() body: XapiStatementDto | XapiStatementDto[]) {
    if (Array.isArray(body)) {
      return this.xapiService.storeStatements(body);
    }
    return this.xapiService.storeStatement(body);
  }
}
