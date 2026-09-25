import * as React from 'react'

import { Button, Column, Heading, Hr, Row, Section, Text } from '@react-email/components'

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
      Confirm your email.
    </Heading>
    <Text className="gg-text" style={text}>
      Thanks for signing up for {siteName}. Confirm <strong style={{ color: colors.ink }}>{recipient}</strong> to finish creating your account.
    </Text>

    <Button style={button} href={confirmationUrl}>
      Confirm my email
    </Button>

    <Fallback url={confirmationUrl} />

    <Hr style={{ borderColor: colors.border, margin: '38px 0 34px' }} />

    <Heading
      as="h3"
      className="gg-h1"
      style={{ ...h1, fontSize: '26px', margin: '36px 0 24px' }}
    >
      What happens next
    </Heading>

    {steps.map((step, i) => (
      <Section key={step.title} style={{ margin: '0 0 24px' }}>
        <Row>
          <Column style={{ width: '58px', verticalAlign: 'top' }}>
            <Text style={{ width: '42px', height: '42px', lineHeight: '42px', margin: '0', borderRadius: '999px', backgroundColor: colors.goldSoft, color: colors.goldSoftText, fontSize: '18px', fontWeight: 700 as const, textAlign: 'center' as const }}>
              {i + 1}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ margin: '0 0 4px', fontFamily: "'Arial Narrow', Impact, 'Franklin Gothic Condensed', Arial, sans-serif", fontSize: '20px', lineHeight: '1.25', fontWeight: 700 as const, color: colors.greenDark }}>
              {step.title}
            </Text>
            <Text className="gg-text" style={{ ...text, fontSize: '17px', margin: '0' }}>
              {step.body}
            </Text>
          </Column>
        </Row>
      </Section>
    ))}

    <Text className="gg-text" style={{ ...text, margin: '46px 0 18px', fontSize: '15px' }}>
      If you didn’t create an account, you can safely ignore this email.
    </Text>
  </Shell>
)

export default SignupEmail
