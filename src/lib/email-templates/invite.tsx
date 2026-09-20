import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { Fallback, Shell, button, h1, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Shell preview={`You've been invited to join ${siteName}`} siteUrl={siteUrl}>
    <Heading className="gg-h1" style={h1}>
      You’ve been invited
    </Heading>
    <Text className="gg-text" style={text}>
      Someone invited you to play {siteName}. Accept below to create your
      account and get in the league.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept the invite
    </Button>
    <Fallback url={confirmationUrl} />
    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      If you weren’t expecting this, you can safely ignore this email.
    </Text>
  </Shell>
)

export default InviteEmail
