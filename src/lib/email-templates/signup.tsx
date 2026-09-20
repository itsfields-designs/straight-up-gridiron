import * as React from 'react'

import { Button, Heading, Section, Text } from '@react-email/components'

import { Fallback, Shell, button, colors, h1, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const steps = [
  {
    title: 'Start a league or join with a code',
    body: 'Every league gets a six-character code. Share it and your friends are in.',
  },
  {
    title: 'Pick all 16 games',
    body: 'Tap a team per matchup, add your tiebreaker total, done in a minute.',
  },
  {
    title: 'Follow the standings',
    body: 'Records update for everyone as official final scores arrive.',
  },
]

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Shell preview={`Confirm your email to join ${siteName}`} siteUrl={siteUrl}>
    <Heading className="gg-h1" style={h1}>
      Confirm your email
    </Heading>
    <Text className="gg-text" style={text}>
      Thanks for signing up for {siteName}. Confirm {recipient} and your league
      is one tap away.
    </Text>

    <Button style={button} href={confirmationUrl}>
      Confirm my email
    </Button>

    <Fallback url={confirmationUrl} />

    <Heading
      as="h3"
      className="gg-h1"
      style={{ ...h1, fontSize: '17px', margin: '28px 0 12px' }}
    >
      What happens next
    </Heading>

    {steps.map((step, i) => (
      <Section key={step.title} style={{ margin: '0 0 14px' }}>
        <Text
          style={{
            margin: '0 0 4px',
            fontSize: '15px',
            fontWeight: 600 as const,
            color: colors.ink,
          }}
        >
          {i + 1}. {step.title}
        </Text>
        <Text className="gg-text" style={{ ...text, margin: '0' }}>
          {step.body}
        </Text>
      </Section>
    ))}

    <Text className="gg-text" style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
      If you didn’t create an account, you can safely ignore this email.
    </Text>
  </Shell>
)

export default SignupEmail
