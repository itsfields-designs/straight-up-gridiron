import * as React from 'react'

import { Heading, Text } from '@react-email/components'

import { Shell, code, h1, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Shell preview="Your verification code">
    <Heading className="gg-h1" style={h1}>
      Confirm it’s you
    </Heading>
    <Text className="gg-text" style={text}>
      Use this code to confirm your identity:
    </Text>
    <Text style={code}>{token}</Text>
    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      The code expires shortly. If you didn’t request it, ignore this email.
    </Text>
  </Shell>
)

export default ReauthenticationEmail
