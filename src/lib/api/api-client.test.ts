import {
  afterEach,
  beforeAll,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { ApiError, api, apiClient } from './api-client';

// The exported singleton is built with an empty baseURL, so buildUrl resolves
// endpoints against the browser origin. Bun has no `location`, so provide one.
beforeAll(() => {
  (globalThis as unknown as { location: { origin: string } }).location = {
    origin: 'http://localhost',
  };
});

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let fetchSpy: FetchSpy | undefined;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function mockFetch(
  impl: (url: string, init: RequestInit) => Promise<Response>
): FetchSpy {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    impl as unknown as typeof fetch
  );
  return fetchSpy;
}

/** The URL string passed to the most recent fetch call. */
function calledUrl(): string {
  return String((fetchSpy as FetchSpy).mock.calls[0][0]);
}

/** The RequestInit passed to the most recent fetch call. */
function calledInit(): RequestInit {
  return (fetchSpy as FetchSpy).mock.calls[0][1] as RequestInit;
}

describe('ApiError', () => {
  test('flags 401 and 403 as auth errors', () => {
    expect(new ApiError('m', 401).isAuthError).toBe(true);
    expect(new ApiError('m', 403).isAuthError).toBe(true);
    expect(new ApiError('m', 500).isAuthError).toBe(false);
  });

  test('flags 404 as not found', () => {
    expect(new ApiError('m', 404).isNotFound).toBe(true);
    expect(new ApiError('m', 400).isNotFound).toBe(false);
  });

  test('flags 5xx as server errors', () => {
    expect(new ApiError('m', 500).isServerError).toBe(true);
    expect(new ApiError('m', 503).isServerError).toBe(true);
    expect(new ApiError('m', 499).isServerError).toBe(false);
  });

  test('a plain error is not a timeout', () => {
    expect(new ApiError('m', 400).isTimeout).toBe(false);
  });

  test('retains details and field errors', () => {
    const error = new ApiError('bad', 422, 'detail', { name: ['required'] });
    expect(error.details).toBe('detail');
    expect(error.errors).toEqual({ name: ['required'] });
    expect(error.name).toBe('ApiError');
    expect(error).toBeInstanceOf(Error);
  });

  test('timeout() builds a 504 flagged as a timeout', () => {
    const error = ApiError.timeout();
    expect(error.status).toBe(504);
    expect(error.isTimeout).toBe(true);
    expect(error.message).toBe('Request timeout');
  });

  test('timeout() accepts a custom message', () => {
    expect(ApiError.timeout('slow').message).toBe('slow');
  });

  test('network() builds a status-0 error', () => {
    const error = ApiError.network();
    expect(error.status).toBe(0);
    expect(error.isServerError).toBe(false);
    expect(error.message).toBe('Network error');
  });
});

describe('api.get', () => {
  test('resolves the endpoint against the origin and sends a JSON GET', async () => {
    mockFetch(async () => jsonResponse({ ok: true }));

    const result = await api.get<{ ok: boolean }>('/leave');

    expect(result).toEqual({ ok: true });
    expect(calledUrl()).toBe('http://localhost/leave');
    const init = calledInit();
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });

  test('appends query params, coercing numbers and booleans to strings', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.get('/x', { a: 1, b: 'two', c: true });

    const url = new URL(calledUrl());
    expect(url.searchParams.get('a')).toBe('1');
    expect(url.searchParams.get('b')).toBe('two');
    expect(url.searchParams.get('c')).toBe('true');
  });

  test('omits params that are null or undefined', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.get('/x', {
      a: 1,
      skipUndef: undefined as unknown as string,
      skipNull: null as unknown as string,
    });

    const url = new URL(calledUrl());
    expect(url.searchParams.has('a')).toBe(true);
    expect(url.searchParams.has('skipUndef')).toBe(false);
    expect(url.searchParams.has('skipNull')).toBe(false);
  });

  test('merges per-request headers over the defaults', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.get('/x', undefined, { headers: { 'X-Trace': 'abc' } });

    const headers = calledInit().headers as Record<string, string>;
    expect(headers['X-Trace']).toBe('abc');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('api error shaping', () => {
  test('throws an ApiError carrying the backend message and field errors', async () => {
    mockFetch(async () =>
      jsonResponse(
        { message: 'Validation failed', errors: { email: ['invalid'] } },
        { status: 422 }
      )
    );

    const error = (await api.get('/x').catch((error_) => error_)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Validation failed');
    expect(error.status).toBe(422);
    expect(error.errors).toEqual({ email: ['invalid'] });
  });

  test('falls back to a default message for a 404 with no body message', async () => {
    mockFetch(async () => jsonResponse({}, { status: 404 }));

    const error = (await api.get('/x').catch((error_) => error_)) as ApiError;
    expect(error.status).toBe(404);
    expect(error.isNotFound).toBe(true);
    expect(error.message).toBe('The requested resource was not found.');
  });

  test('uses the status default when the error body is not valid JSON', async () => {
    mockFetch(
      async () =>
        new Response('<html>500</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        })
    );

    const error = (await api.get('/x').catch((error_) => error_)) as ApiError;
    expect(error.status).toBe(500);
    expect(error.isServerError).toBe(true);
    expect(error.message).toBe('Server error. Please try again later.');
  });

  test('uses the generic default for an unmapped status code', async () => {
    mockFetch(async () => jsonResponse({}, { status: 418 }));

    const error = (await api.get('/x').catch((error_) => error_)) as ApiError;
    expect(error.message).toBe('An error occurred (418)');
  });
});

describe('api.post / put', () => {
  test('serialises the body to JSON', async () => {
    mockFetch(async () => jsonResponse({ id: 1 }));

    await api.post('/leave', { reason: 'sick' });

    const init = calledInit();
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ reason: 'sick' }));
  });

  test('sends an undefined body when no data is given', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.post('/leave');

    expect(calledInit().body).toBeUndefined();
  });

  test('put serialises the body and uses the PUT method', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.put('/leave/1', { reason: 'holiday' });

    const init = calledInit();
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ reason: 'holiday' }));
  });
});

describe('api.patch', () => {
  test('rewrites integer salary values as floats for the Java backend', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.patch('/employees/1', { salary: 45_000, name: 'A' });

    expect(calledInit().body).toBe('{"salary":45000.0,"name":"A"}');
  });

  test('leaves an already-decimal salary untouched', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.patch('/employees/1', { salary: 45_000.5 });

    expect(calledInit().body).toBe('{"salary":45000.5}');
  });

  test('handles a salary at the end of the JSON object', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.patch('/employees/1', { name: 'A', salary: 100 });

    expect(calledInit().body).toBe('{"name":"A","salary":100.0}');
  });
});

describe('api.delete', () => {
  test('issues a DELETE with query params', async () => {
    mockFetch(async () => jsonResponse({}));

    await api.delete('/leave/deactivate', { policyId: 7 });

    expect(calledInit().method).toBe('DELETE');
    expect(new URL(calledUrl()).searchParams.get('policyId')).toBe('7');
  });
});

describe('network failures', () => {
  test('wraps a non-retryable network error as an ApiError with status 0', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = (await api
      .get('/x', undefined, { retries: 0 })
      .catch((error_) => error_)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });

  test('converts an aborted request into a timeout error and does not retry', async () => {
    let attempts = 0;
    mockFetch(async () => {
      attempts++;
      const aborted = new Error('aborted');
      aborted.name = 'AbortError';
      throw aborted;
    });

    const error = (await api
      .get('/x', undefined, { retries: 2 })
      .catch((error_) => error_)) as ApiError;
    expect(error.isTimeout).toBe(true);
    expect(error.status).toBe(504);
    expect(attempts).toBe(1);
  });

  test('retries a transient network error and then succeeds', async () => {
    let attempts = 0;
    mockFetch(async () => {
      attempts++;
      if (attempts === 1) throw new TypeError('network down');
      return jsonResponse({ recovered: true });
    });

    const result = await api.get<{ recovered: boolean }>('/x', undefined, {
      retries: 1,
    });
    expect(result).toEqual({ recovered: true });
    expect(attempts).toBe(2);
  });
});

describe('api.postMultipart', () => {
  test('wraps the entity in a data field and appends files without a JSON content type', async () => {
    mockFetch(async () => jsonResponse({ uploaded: true }));

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const result = await api.postMultipart<{ uploaded: boolean }>(
      '/issues/1/attachments',
      { title: 'Crack' },
      { attachments: [file] }
    );

    expect(result).toEqual({ uploaded: true });
    const init = calledInit();
    expect(init.method).toBe('POST');
    expect(init.headers).toBeUndefined();
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('data')).toBe(JSON.stringify({ title: 'Crack' }));
    expect(body.getAll('attachments')).toHaveLength(1);
  });
});

describe('api.postFormData', () => {
  test('sends the provided FormData verbatim', async () => {
    mockFetch(async () => jsonResponse({}));

    const form = new FormData();
    form.append('file', new File(['x'], 'a.txt'));
    await api.postFormData('/upload', form);

    const init = calledInit();
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });
});

describe('apiClient.setDefaultHeader', () => {
  test('adds a persistent header to subsequent requests', async () => {
    apiClient.setDefaultHeader('X-Organization-Id', '42');
    mockFetch(async () => jsonResponse({}));

    await api.get('/x');

    const headers = calledInit().headers as Record<string, string>;
    expect(headers['X-Organization-Id']).toBe('42');
  });
});
