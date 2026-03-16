import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  list(@CurrentUser() user: { sub: string }, @Query('limit') limit?: string) {
    return this.notifications.getForUser(user.sub, limit ? parseInt(limit, 10) : 20);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'))
  unreadCount(@CurrentUser() user: { sub: string }) {
    return this.notifications.getUnreadCount(user.sub).then((count) => ({ count }));
  }

  @Post(':id/read')
  @UseGuards(AuthGuard('jwt'))
  markRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notifications.markAsRead(id, user.sub);
  }

  @Post('read-all')
  @UseGuards(AuthGuard('jwt'))
  markAllRead(@CurrentUser() user: { sub: string }) {
    return this.notifications.markAllRead(user.sub);
  }
}
