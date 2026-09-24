import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';

export function repositoryError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        'RESOURCE_ALREADY_EXISTS',
        409,
        'The resource already exists.',
      );
    }
    if (error.code === 'P2025') {
      throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource not found.');
    }
    if (error.code === 'P2034') {
      throw new AppError(
        'CONCURRENT_MODIFICATION',
        409,
        'The resource changed. Retry the request.',
      );
    }
  }
  throw error;
}
