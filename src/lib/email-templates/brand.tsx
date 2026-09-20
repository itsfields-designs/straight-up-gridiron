import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const colors = {
  green: '#0E3B2A',
  greenDark: '#092619',
  gold: '#D9A441',
  goldDark: '#B8862B',
  cream: '#F6F1E4',
  ink: '#1C1B18',
  muted: '#5F6B63',
  card: '#FFFFFF',
  border: '#E5DFCF',
}

export const main = {
  backgroundColor: colors.cream,
  fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  width: '100%',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 16px 40px',
}

export const card = {
  backgroundColor: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '28px 24px',
}

export const h1 = {
  fontSize: '24px',
  lineHeight: '1.25',
  fontWeight: 600 as const,
  color: colors.ink,
  margin: '0 0 14px',
}

export const text = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: colors.muted,
  margin: '0 0 18px',
}

export const button = {
  display: 'block',
  backgroundColor: colors.gold,
  color: colors.greenDark,
  fontSize: '16px',
  fontWeight: 600 as const,
  textAlign: 'center' as const,
  borderRadius: '12px',
  padding: '15px 20px',
  textDecoration: 'none',
}

export const fallbackText = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: colors.muted,
  wordBreak: 'break-all' as const,
  margin: '16px 0 0',
}

export const footerText = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: colors.muted,
  textAlign: 'center' as const,
  margin: '18px 0 0',
}

export const code = {
  display: 'inline-block',
  backgroundColor: colors.cream,
  border: `1px solid ${colors.border}`,
  borderRadius: '10px',
  padding: '12px 18px',
  fontSize: '26px',
  letterSpacing: '6px',
  fontWeight: 600 as const,
  color: colors.ink,
}

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .gg-body { background-color: #0B1A13 !important; }
    .gg-card { background-color: #12241B !important; border-color: #234033 !important; }
    .gg-h1 { color: #F6F1E4 !important; }
    .gg-text { color: #BFCCC4 !important; }
  }
`

export function Shell({
  preview,
  children,
  siteUrl,
}: {
  preview: string
  siteUrl?: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="gg-body" style={main}>
        <Container style={container}>
          <Section
            style={{
              backgroundColor: colors.green,
              borderRadius: '16px',
              padding: '22px 24px',
              marginBottom: '16px',
            }}
          >
            <Heading
              as="h2"
              style={{
                margin: '0',
                fontSize: '20px',
                letterSpacing: '2px',
                fontWeight: 600 as const,
                color: colors.gold,
                textTransform: 'uppercase' as const,
              }}
            >
              Gridiron Gods
            </Heading>
            <Text
              style={{
                margin: '6px 0 0',
                fontSize: '12px',
                letterSpacing: '2px',
                color: '#D8E5DD',
                textTransform: 'uppercase' as const,
              }}
            >
              Pick. Compete. Conquer.
            </Text>
          </Section>

          <Section className="gg-card" style={card}>
            {children}
          </Section>

          <Hr style={{ borderColor: colors.border, margin: '24px 0 0' }} />
          <Text style={footerText}>
            Gridiron Gods · NFL pick’em for your league ·{' '}
            <Link
              href={siteUrl ?? 'https://gridirongods.app'}
              style={{ color: colors.muted }}
            >
              gridirongods.app
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function Fallback({ url }: { url: string }) {
  return (
    <Text style={fallbackText}>
      If the button doesn’t work, copy and paste this link into your browser:
      <br />
      {url}
    </Text>
  )
}
