import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
// Also available: import { sendEmail } from './resend-dynamic' for DB-configured sending

if (!process.env.DATABASE_URL) {
  console.error('[Auth] DATABASE_URL is not set.')
}

const isProd          = process.env.NODE_ENV === 'production'
const canonicalAppUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tightspothelper.com'
const FROM            = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'

const authBaseURL = isProd
  ? { allowedHosts: ['tightspothelper.com','www.tightspothelper.com','*.vercel.app','*.railway.app'], protocol: 'https' as const, fallback: canonicalAppUrl }
  : { allowedHosts: ['localhost:*','127.0.0.1:*'], protocol: 'http' as const, fallback: 'http://localhost:3000' }

const authSecret = process.env.BETTER_AUTH_SECRET || (isProd ? undefined : 'tightspothelper-local-dev-secret-change-before-prod')

function verificationEmailHtml(url: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
            TightSpot<span style="color:#f97c0a;">Helper</span>
          </span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:40px 32px;">
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">Verify your email</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#a1a1aa;line-height:1.6;">
            Click the button below to verify your email address and activate your TightSpotHelper account.
            This link expires in <strong style="color:#ffffff;">24 hours</strong>.
          </p>
          <a href="${url}"
            style="display:inline-block;background:#f97c0a;color:#ffffff;font-size:15px;font-weight:600;
                   text-decoration:none;padding:14px 32px;border-radius:12px;">
            Verify my email →
          </a>
          <p style="margin:28px 0 0;font-size:12px;color:#52525b;">
            Or copy and paste this link:<br>
            <a href="${url}" style="color:#f97c0a;word-break:break-all;">${url}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#3f3f46;">
            If you didn't create an account, you can safely ignore this email.<br>
            © ${new Date().getFullYear()} TightSpotHelper
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export const auth = betterAuth({
  secret:   authSecret,
  baseURL:  authBaseURL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  session: {
    modelName:  'AuthSession',
    expiresIn:  60 * 60 * 12,
    updateAge:  60 * 60,
    freshAge:   60 * 15,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  user: {
    modelName: 'AuthUser',
    additionalFields: {
      role:             { type: 'string', defaultValue: 'customer', required: false, input: true },
      phone:            { type: 'string', required: false, input: true },
      stripeCustomerId: { type: 'string', required: false, input: false },
    },
  },
  account:      { modelName: 'AuthAccount' },
  verification: { modelName: 'AuthVerification' },

  emailAndPassword: {
    enabled:                  true,
    requireEmailVerification: true,
    minPasswordLength:        8,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const result = await resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject: 'Verify your TightSpotHelper email',
        html:    verificationEmailHtml(url),
      })
      if (result.error) {
        console.error('[Auth] Failed to send verification email:', result.error)
      }
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID ? {
      google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    } : {}),
    ...(process.env.APPLE_CLIENT_ID ? {
      apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET! },
    } : {}),
  },
})
