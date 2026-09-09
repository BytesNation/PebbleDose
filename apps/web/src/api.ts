import { QueryClient } from '@tanstack/react-query';
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-family-client': '1',
        ...(body === undefined || body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Could not reach the household server. Check the connection before trying again.',
      0,
    );
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(
      'The household server is unavailable. Please try again.',
      response.status,
    );
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.message ?? 'Request failed', response.status);
  return data as T;
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchInterval: 15000, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
});
export function refresh() {
  return queryClient.invalidateQueries();
}
