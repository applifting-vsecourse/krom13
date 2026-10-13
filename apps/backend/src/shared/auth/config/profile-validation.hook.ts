import { APIError, createAuthMiddleware } from 'better-auth/api';

export const MAX_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 160;
export const MOODS = ['happy', 'sad', 'angry', 'silly'];

/**
 * Server-side rules for the profile fields on `POST /api/auth/update-user`.
 * The username rules (3–30, letters/numbers/dots/underscores, uniqueness) are
 * enforced by the username plugin; these cover everything else on the
 * Settings page. Rejects with 400 so the client can't bypass its own form.
 */
export const validateProfileUpdate = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/update-user') return;
  const body = (ctx.body ?? {}) as Record<string, unknown>;

  if ('name' in body) {
    const name = body.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new APIError('BAD_REQUEST', {
        message: 'Display name is required',
      });
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new APIError('BAD_REQUEST', {
        message: `Display name must be at most ${MAX_NAME_LENGTH} characters`,
      });
    }
  }

  if ('bio' in body && body.bio !== null) {
    if (typeof body.bio !== 'string' || body.bio.length > MAX_BIO_LENGTH) {
      throw new APIError('BAD_REQUEST', {
        message: `Bio must be at most ${MAX_BIO_LENGTH} characters`,
      });
    }
  }

  if ('defaultMood' in body && body.defaultMood !== null) {
    if (
      typeof body.defaultMood !== 'string' ||
      !MOODS.includes(body.defaultMood)
    ) {
      throw new APIError('BAD_REQUEST', { message: 'Unknown mood' });
    }
  }
});
