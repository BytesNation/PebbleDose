export class DomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireValue<T>(
  value: T | null | undefined,
  message = 'Not found',
): T {
  if (value === undefined || value === null)
    throw new DomainError(404, message);
  return value;
}
