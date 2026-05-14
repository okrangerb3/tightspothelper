import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
if (!process.env.DATABASE_URL) {
  console.error('[Auth] DATABASE_URL is not set. Auth will fail. Ensure DATABASE_URL is configured in your environment.')
}

const isProd = process.env.NODE_ENV === 'production'

const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (isProd ? undefined : 'tightspothelper-local-dev-secret-change-before-prod')

const authBaseUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'

export const auth = betterAuth({
  secret: authSecret,
  baseURL: authBaseUrl,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  // Map to our custom table names to avoid conflict with app Session model
  user: {
    modelName: 'AuthUser',
    additionalFields: {
      role:            { type: 'string',  defaultValue: 'customer',  required: false, input: true },
      phone:           { type: 'string',  required: false,           input: true },
      stripeCustomerId:{ type: 'string',  required: false,           input: false },
    },
  },
  session:      { modelName: 'AuthSession' },
  account:      { modelName: 'AuthAccount' },
  verification: { modelName: 'AuthVerification' },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID ? {
      google: {
        clientId:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    } : {}),
    ...(process.env.APPLE_CLIENT_ID ? {
      apple: {
        clientId:     process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET!,
      },
    } : {}),
  },

  emailVerification: {
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com',
        to:      user.email,
        subject: 'Verify your TightSpotHelper email',
        html:    `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
      })
    },
  },

  trustedOrigins: [
    authBaseUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://tightspothelper.com',
    'https://www.tightspothelper.com',
  ],
})
