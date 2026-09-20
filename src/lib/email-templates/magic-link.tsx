import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { Fallback, Shell, button, h1, text } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Shell preview={`Your login link for ${siteName}`}>
    <Heading className="gg-h1" style={h1}>
      Your login link
    </Heading>
    <Text className="gg-text" style={text}>
      Tap below to log in to {siteName}. This link expires shortly.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Log in
    </Button>
    <Fallback url={confirmationUrl} />
    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      If you didn’t request this link, you can safely ignore this email.
    </Text>
  </Shell>
)

export default MagicLinkEmail
