/**
 * Shared error-message extraction for service-layer `catch` blocks — pulls
 * the backend's `{ error: { message } }` envelope (see `apiClient.ts`'s
 * response interceptor) out of an axios error, falling back to the error's
 * own message. Every Front Desk service file previously redefined this
 * verbatim; centralized here so there's one place to change the fallback
 * copy or add a new error shape.
 */
export function toErrorMessage(err: any): string {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong. Please try again.';
}
