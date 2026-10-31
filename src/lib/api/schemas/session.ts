import { z } from 'zod';
import { isoDate } from './common';

/** Session : `User`, `AuthSession` et `RefreshTokenResponse` (src/types). */

/** `GET /me` : profil du client connecté. */
export const userSchema = z.looseObject({
  id: z.string(),
  phone: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  city: z.string().optional(),
  createdAt: isoDate.optional(),
});

/** `POST /auth/otp/verify` : jeton d'accès et profil. */
export const authSessionSchema = z.looseObject({
  accessToken: z.string().min(1),
  user: userSchema,
  isNewUser: z.boolean().optional(),
});

/** `POST /auth/refresh` : nouveau jeton, profil facultatif. */
export const refreshSessionSchema = z.looseObject({
  accessToken: z.string().min(1),
  user: userSchema.optional(),
});
