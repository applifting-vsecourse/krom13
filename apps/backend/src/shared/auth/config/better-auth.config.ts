import { openAPI, username } from 'better-auth/plugins';
import { BetterAuthOptions } from 'better-auth/types';
import { validateProfileUpdate } from './profile-validation.hook';

export const betterAuthCoreConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false,
      },
      bio: { type: 'string', required: false },
      defaultMood: { type: 'string', required: false },
    },
  },
  hooks: { before: validateProfileUpdate },
  plugins: [openAPI(), username()],
};
