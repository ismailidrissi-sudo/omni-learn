import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { XapiService, XapiStatementDto } from './xapi.service';

@Controller('xapi')
@UseGuards(AuthGuard('jwt'))
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
