import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { Fallback, Shell, button, h1, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Shell preview={`Confirm your email change for ${siteName}`}>
    <Heading className="gg-h1" style={h1}>
      Confirm your email change
    </Heading>
    <Text className="gg-text" style={text}>
      You asked to change your {siteName} email from {oldEmail} to {newEmail}.
      Confirm below to finish.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm email change
    </Button>
    <Fallback url={confirmationUrl} />
    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      If you didn’t request this change, secure your account right away.
    </Text>
  </Shell>
)

export default EmailChangeEmail
