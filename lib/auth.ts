import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
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
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ],
})
