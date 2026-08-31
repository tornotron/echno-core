import { describe, expect, test } from 'bun:test';
import { ApiError } from '../api/api-client';
import { getErrorMessage, getErrorTitle } from './error-helpers';

/**
 * The bodies used here are the ones the backend actually sends. Every handled
 * failure comes back from its GlobalExceptionHandler as an RFC 7807 problem
 * carrying `title`, `detail`, and the legacy keys the client reads: `message`
 * mirrors `detail`, and `details` holds the request description rather than a
 * human explanation.
 */
function problem(
  status: number,
  title: string,
  message: string,
  uri = '/api/v1/leave-requests/9/approve'
): ApiError {
  return new ApiError(message, status, `uri=${uri}`, undefined, title);
}

describe('getErrorTitle', () => {
  test('a 401 asks the user to authenticate', () => {
    expect(getErrorTitle(new ApiError('Unauthorized', 401), 'Failed')).toBe(
      'Authentication Required'
    );
  });

  test('a 403 is not titled as an authentication problem', () => {
    const error = problem(
      403,
      'Access Denied',
      'You do not have permission for this action. Requires the organization role ORG_ADMIN.'
    );
    expect(getErrorTitle(error, 'Failed to Approve Leave')).not.toBe(
      'Authentication Required'
    );
  });

  test("a 403 uses the backend's own title", () => {
    const error = problem(
      403,
      'Access Denied',
      'You do not have permission for this action. Requires the organization role ORG_ADMIN.'
    );
    expect(getErrorTitle(error, 'Failed to Approve Leave')).toBe(
      'Access Denied'
    );
  });

  test('a 403 with no body falls back to a permission title', () => {
    expect(getErrorTitle(new ApiError('Forbidden', 403), 'Failed')).toBe(
      'Not Permitted'
    );
  });

  test('a refusal raised by a service keeps its own title', () => {
    const error = problem(
      403,
      'Access Denied',
      'Only the sender can edit this message',
      '/api/v1/chat/messages/9'
    );
    expect(getErrorTitle(error, 'Failed to Edit Message')).toBe('Access Denied');
  });

  test('a validation failure is titled by the backend', () => {
    const error = problem(
      400,
      'Validation Failed',
      'Validation Failed',
      '/api/v1/employees'
    );
    expect(getErrorTitle(error, 'Failed to Save')).toBe('Validation Failed');
  });

  test('a conflict is titled by its problem class, not by its sentence', () => {
    const error = problem(
      409,
      'Duplicate Resource',
      'Purchase Order with PO number PO-2026-000001 already exists',
      '/api/v1/purchase-orders'
    );
    expect(getErrorTitle(error, 'Failed to Save')).toBe('Duplicate Resource');
  });

  test('a client-side timeout is titled as one', () => {
    expect(getErrorTitle(ApiError.timeout(), 'Failed')).toBe('Request Timeout');
  });

  test('a network failure is titled as one', () => {
    expect(getErrorTitle(ApiError.network(), 'Failed')).toBe('Network Error');
  });

  test('a gateway error with no body is titled generically', () => {
    expect(getErrorTitle(new ApiError('Bad gateway', 502), 'Failed')).toBe(
      'Server Error'
    );
  });

  test('anything that is not an ApiError keeps the caller title', () => {
    expect(getErrorTitle(new Error('boom'), 'Failed to Approve Leave')).toBe(
      'Failed to Approve Leave'
    );
    expect(getErrorTitle('boom', 'Failed to Approve Leave')).toBe(
      'Failed to Approve Leave'
    );
  });
});

describe('getErrorMessage', () => {
  test("the backend's sentence is the message, not the request description", () => {
    const error = problem(
      403,
      'Access Denied',
      'You do not have permission for this action. Requires the organization role ORG_ADMIN.'
    );
    expect(getErrorMessage(error)).toBe(
      'You do not have permission for this action. Requires the organization role ORG_ADMIN.'
    );
  });

  test('field errors are appended to the sentence', () => {
    const error = new ApiError(
      'Validation Failed',
      400,
      'uri=/api/v1/employees',
      { email: ['must not be blank'] },
      'Validation Failed'
    );
    expect(getErrorMessage(error)).toBe(
      'Validation Failed — email: must not be blank'
    );
  });

  test('a structured details payload never reaches the message', () => {
    // The subscription endpoints answer 402 with `details` as a quota object.
    const error = new ApiError('Plan limit reached', 402);
    expect(getErrorMessage(error)).toBe('Plan limit reached');
  });

  test('a generic error yields its own message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('an unknown throwable yields the fallback', () => {
    expect(getErrorMessage('boom')).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});
