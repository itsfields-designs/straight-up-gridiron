import * as React from 'react'

import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

import logoAsset from '@/assets/gridiron-gods-logo.png.asset.json'

export const colors = {
  // Stadium black header / primary surface (matches --primary on the site).
  green: '#141413',
  greenDark: '#161715',
  // Trophy gold accent (matches --accent).
  gold: '#E5A93B',
  goldDark: '#D9A441',
  goldSoft: '#FBF2DC',
  goldSoftText: '#94681A',
  // Warm playbook cream background (matches --background).
  cream: '#F4EFE6',
  ink: '#1C1B18',
  muted: '#555E57',
  card: '#FFFFFF',
  border: '#DDD7C8',
}

export const main = {
  backgroundColor: colors.card,
  fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  padding: '28px 16px 44px',
}

export const card = {
  backgroundColor: colors.card,
  padding: '52px 40px 36px',
}

export const h1 = {
  fontFamily: "'Arial Narrow', Impact, 'Franklin Gothic Condensed', Arial, sans-serif",
  fontSize: '42px',
  lineHeight: '1.08',
  fontWeight: 800 as const,
  color: colors.greenDark,
  margin: '0 0 22px',
}

export const text = {
  fontSize: '19px',
  lineHeight: '1.55',
  color: colors.muted,
  margin: '0 0 28px',
}

export const button = {
  display: 'block',
  backgroundColor: colors.gold,
  color: '#151513',
  fontFamily: "'Arial Narrow', Impact, 'Franklin Gothic Condensed', Arial, sans-serif",
  fontSize: '20px',
  fontWeight: 700 as const,
  textAlign: 'center' as const,
  borderRadius: '14px',
  padding: '18px 20px',
  textDecoration: 'none',
}

export const fallbackText = {
  fontSize: '16px',
  lineHeight: '1.5',
  color: colors.muted,
  wordBreak: 'break-all' as const,
  margin: '28px 0 0',
}

export const footerText = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: colors.muted,
  textAlign: 'left' as const,
  margin: '12px 0 0',
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

const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .gg-frame { border-color: #3A352B !important; }
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
  const rootUrl = siteUrl ?? 'https://gridirongods.app'
  const logoUrl = new URL(logoAsset.url, rootUrl).toString()

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section className="gg-frame" style={{ border: `1px solid ${colors.border}`, borderRadius: '24px', overflow: 'hidden', backgroundColor: colors.cream }}>
          <Section style={{ backgroundColor: colors.green, borderBottom: `3px solid ${colors.gold}`, padding: '28px 40px' }}>
            <Row>
              <Column style={{ width: '72px', verticalAlign: 'middle' }}>
                <Img src={logoUrl} width="64" height="64" alt="Gridiron Gods" style={{ display: 'block', borderRadius: '14px' }} />
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Heading as="h2" style={{ margin: '0', fontFamily: "'Arial Narrow', Impact, 'Franklin Gothic Condensed', Arial, sans-serif", fontSize: '26px', lineHeight: '1', fontWeight: 700 as const, letterSpacing: '2px', color: colors.card, textTransform: 'uppercase' as const }}>
                  Gridiron Gods
                </Heading>
              </Column>
            </Row>
          </Section>

          <Section className="gg-card" style={card}>
            {children}
            <Text style={footerText}>
              Gridiron Gods · NFL pick’em for your league ·{' '}
              <Link href={rootUrl} style={{ color: colors.muted, textDecoration: 'none' }}>
                gridirongods.app
              </Link>
            </Text>
          </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function Fallback({ url }: { url: string }) {
  return (
    <Text style={fallbackText}>
      Button not working? Copy and paste this link into your browser:
      <br />
      <Link href={url} style={{ color: colors.goldSoftText, textDecoration: 'underline' }}>{url}</Link>
    </Text>
  )
}
