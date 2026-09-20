import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { Fallback, Shell, button, h1, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Shell preview={`Reset your password for ${siteName}`}>
    <Heading className="gg-h1" style={h1}>
      Reset your password
    </Heading>
    <Text className="gg-text" style={text}>
      We got a request to reset the password for your {siteName} account. Choose
      a new one below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Reset my password
    </Button>
    <Fallback url={confirmationUrl} />
    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      If you didn’t request this, ignore this email — your password stays the
      same.
    </Text>
  </Shell>
)

export default RecoveryEmail
