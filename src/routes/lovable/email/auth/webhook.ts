import * as React from 'react'
import { verifyWebhookRequest } from '@lovable.dev/webhooks-js'
import type { AuthEmailHookData, AuthEmailWebhookPayload } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'
import { sendEmail } from '@/lib/email.server'

// Configuration
const SITE_NAME = "Gridiron Gods"
const ROOT_DOMAIN = "gridirongods.app"
const SITE_URL = `https://${ROOT_DOMAIN}`

function siteActionUrl(actionUrl: string) {
  try {
    const url = new URL(actionUrl)
    url.protocol = 'https:'
    url.host = ROOT_DOMAIN
    return url.toString()
  } catch {
    return SITE_URL
  }
}

type AuthEmail = { subject: string; element: React.ReactElement }

function buildEmail(data: AuthEmailHookData): AuthEmail | null {
  const confirmationUrl = siteActionUrl(data.url)
  switch (data.action_type) {
    case 'signup':
      return {
        subject: 'Confirm your email',
        element: React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: data.email,
          confirmationUrl,
        }),
      }
    case 'invite':
      return {
        subject: "You've been invited",
        element: React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl,
        }),
      }
    case 'magiclink':
      return {
        subject: 'Your login link',
        element: React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl }),
      }
    case 'recovery':
      return {
        subject: 'Reset your password',
        element: React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl }),
      }
    case 'email_change':
      return {
        subject: 'Confirm your new email',
        element: React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl,
        }),
      }
    case 'reauthentication':
      return {
        subject: 'Your verification code',
        element: React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
      }
    default:
      return null
  }
}

// Auth emails (confirmations, magic links, password resets) are rendered here
// and delivered through Resend.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let payload: AuthEmailWebhookPayload
        try {
          const verified = await verifyWebhookRequest<AuthEmailWebhookPayload>({
            req: request,
            secret: apiKey,
            parser: (body) => JSON.parse(body) as AuthEmailWebhookPayload,
          })
          payload = verified.payload
        } catch (error) {
          console.error('Auth email webhook verification failed', error)
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const data = payload?.data
        if (!data?.email || !data?.action_type) {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const email = buildEmail(data)
        if (!email) {
          return Response.json(
            { error: `Unknown email type: ${data.action_type}` },
            { status: 400 }
          )
        }

        try {
          await sendEmail({ to: data.email, subject: email.subject, element: email.element })
        } catch (error) {
          console.error('Auth email send failed', error)
          return Response.json({ error: 'Email send failed' }, { status: 502 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
