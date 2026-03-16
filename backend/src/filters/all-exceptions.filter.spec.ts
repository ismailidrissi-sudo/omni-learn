import { HttpException, HttpStatus, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest.fn().mockReturnValue({ method: 'GET', url: '/test' });
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    };
  });

  it('should handle HttpException with correct status', () => {
    const exception = new BadRequestException('Invalid input');
    filter.catch(exception, mockHost as any);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/test',
      }),
    );
  });

  it('should handle UnauthorizedException', () => {
    const exception = new UnauthorizedException('Not authorized');
    filter.catch(exception, mockHost as any);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
  });

  it('should handle generic Error as 500', () => {
    const exception = new Error('Something broke');
    filter.catch(exception, mockHost as any);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Something broke',
      }),
    );
  });

  it('should handle "not found" errors as 404', () => {
    const exception = new Error('Record not found');
    filter.catch(exception, mockHost as any);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('should include timestamp and path in response', () => {
    const exception = new BadRequestException('test');
    filter.catch(exception, mockHost as any);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/test',
      }),
    );
  });
});
