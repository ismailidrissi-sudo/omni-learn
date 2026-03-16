import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exRes = exception.getResponse();
      if (typeof exRes === 'string') {
        message = exRes;
      } else if (typeof exRes === 'object' && exRes !== null) {
        const obj = exRes as Record<string, unknown>;
        message = (obj.message as string | string[]) ?? exception.message;
        error = (obj.error as string) ?? 'Error';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if (exception.name === 'NotFoundError' || exception.message.includes('not found')) {
        status = HttpStatus.NOT_FOUND;
        error = 'Not Found';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status} — ${JSON.stringify(message)}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
