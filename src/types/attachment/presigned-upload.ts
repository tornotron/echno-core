// types/attachment/presigned-upload.ts
//
// Types for the presigned (direct-to-storage) upload flow, mirroring the
// backend contract on `POST /api/v1/attachment/web` (echno-backend PR #311):
//
//   1. presign  — declare the files, receive a short-lived PUT url per file.
//   2. PUT       — upload each file straight to object storage (not the API).
//   3. register  — confirm the uploaded keys; the server re-checks each object
//                  exists in storage before recording it.
//
// The two-step design is deliberate: the server never trusts the client's
// claim that an object exists, so a failed PUT must simply not be registered.
import { z } from 'zod';
import { nullableNumber, nullableString } from '../../lib/validation/backend-schema';

/**
 * One file the client declares to the presign endpoint.
 *
 * `contentType` is echoed back inside the signed url, so the subsequent PUT
 * must send exactly this value as its `Content-Type` header or the signature
 * check fails. `fileSize` is in bytes.
 */
export interface UploadRequest {
  filename: string;
  contentType: string;
  fileSize: number;
}

/**
 * One presigned upload slot returned by the presign endpoint.
 *
 * - `key` — the storage key; it must be passed back verbatim on register.
 * - `url` — the absolute object-storage url to `PUT` the raw bytes to. This is
 *   NOT a backend url and must be called without the api client's baseURL,
 *   auth headers, or cookies.
 * - `contentType` — the exact `Content-Type` the PUT must send (it is signed).
 * - `expiresInSeconds` — url lifetime (backend currently signs for 15 minutes).
 */
export interface PresignedUpload {
  key: string;
  url: string;
  contentType: string;
  expiresInSeconds: number;
}

/**
 * One uploaded object confirmed to the register endpoint.
 *
 * `key` must be the storage key returned by the presign step for this file.
 */
export interface RegisterUploadRequest {
  key: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

/**
 * Progress for a single direct PUT, reported by {@link putToStorage} through
 * the XHR `upload.onprogress` event.
 *
 * `percent` is 0–100, or `undefined` when the total length is not computable
 * (rare; the browser almost always knows a `File`'s size).
 */
export interface UploadProgress {
  /** Bytes transferred so far. */
  loaded: number;
  /** Total bytes to transfer (0 when not computable). */
  total: number;
  /** 0–100, or undefined when the total length is not computable. */
  percent?: number;
}

/**
 * Callback invoked with progress updates for a file's direct PUT.
 *
 * The orchestrator threads the file's index so a caller uploading several
 * files at once can attribute progress to the right row.
 */
export type UploadProgressCallback = (
  progress: UploadProgress,
  fileIndex: number
) => void;

/** The stage of the direct-upload pipeline at which a file failed. */
export type DirectUploadStage = 'presign' | 'put' | 'register';

/** A per-file failure collected by the {@link uploadDirect} orchestrator. */
export interface DirectUploadError {
  filename: string;
  stage: DirectUploadStage;
  message: string;
}

/**
 * Result of a direct upload batch. Files are independent: some may register
 * while others fail, so callers render `attachments` as successes and surface
 * `errors` per failed file rather than treating the whole batch as atomic.
 */
export interface DirectUploadResult {
  attachments: import('./attachment').Attachment[];
  errors: DirectUploadError[];
}

// The presign response may send `key`/`url`/`contentType` as null in a
// malformed payload; validate the shape first (mirrors AttachmentResponseSchema
// in attachment.ts) then fail fast in the parser rather than flowing nulls
// through as empty strings.
const PresignedUploadResponseSchema = z.object({
  key: nullableString,
  url: nullableString,
  contentType: nullableString,
  expiresInSeconds: nullableNumber,
});

/** JSON → PresignedUpload. Throws when a required field is missing/blank. */
export function parsePresignedUpload(json: unknown): PresignedUpload {
  const raw = PresignedUploadResponseSchema.parse(json);

  if (!raw.key || !raw.key.trim()) {
    throw new TypeError(
      `parsePresignedUpload.key: expected a non-empty string, got ${JSON.stringify(raw.key)}`
    );
  }
  if (!raw.url || !raw.url.trim()) {
    throw new TypeError(
      `parsePresignedUpload.url: expected a non-empty string, got ${JSON.stringify(raw.url)}`
    );
  }

  return {
    key: raw.key,
    url: raw.url,
    contentType: raw.contentType ?? '',
    expiresInSeconds: raw.expiresInSeconds ?? 0,
  };
}
