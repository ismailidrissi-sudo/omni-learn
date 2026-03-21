import { Body, Controller, HttpCode, Post, BadRequestException } from '@nestjs/common';
import { UnsubscribeBodyDto } from './dto/unsubscribe.dto';
import { UnsubscribeService } from './unsubscribe.service';

@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribe: UnsubscribeService) {}

  @Post()
  @HttpCode(200)
  async post(@Body() body: UnsubscribeBodyDto) {
    const ok = await this.unsubscribe.validateAndApply(body.uid, body.evt, body.sig, body.exp);
    if (!ok) {
      throw new BadRequestException('Invalid or expired unsubscribe link');
    }
    return { success: true };
  }
}
