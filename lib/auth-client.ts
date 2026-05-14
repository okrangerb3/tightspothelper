import { createAuthClient } from 'better-auth/react'

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL

export const authClient = createAuthClient(baseURL ? { baseURL } : {})

export const { signIn, signUp, signOut, useSession } = authClient

// forgetPassword / resetPassword are available at runtime but not typed
// in the base createAuthClient — cast to access them
export const forgetPassword = (authClient as any).forgetPassword as (
  options: { email: string; redirectTo: string }
) => Promise<{ data: unknown; error: { message?: string } | null }>

export const resetPassword = (authClient as any).resetPassword as (
  options: { newPassword: string; token?: string }
) => Promise<{ data: unknown; error: { message?: string } | null }>
