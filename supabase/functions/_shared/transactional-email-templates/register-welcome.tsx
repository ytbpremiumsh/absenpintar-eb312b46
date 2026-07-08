/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  school?: string
  email?: string
  login_url?: string
}

const brand = {
  bg: '#F4F5FB',
  card: '#ffffff',
  primary: '#5B6CF9',
  primaryDark: '#3D4FE0',
  text: '#0b1020',
  muted: '#64748b',
}

export function RegisterWelcomeEmail({
  name = 'Bapak/Ibu',
  school = '-',
  email = '-',
  login_url = 'https://absenpintar.online/login',
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Selamat datang di ATSkolla — akun {school} sudah aktif</Preview>
      <Body style={{ backgroundColor: brand.bg, fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
          <Section style={{ backgroundColor: brand.card, borderRadius: 16, padding: 28, boxShadow: '0 4px 16px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'inline-block', backgroundColor: brand.primary, color: '#fff', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
              Pendaftaran Berhasil
            </div>
            <Heading style={{ fontSize: 22, margin: '0 0 12px', color: brand.text }}>
              Selamat datang di ATSkolla, {name}!
            </Heading>
            <Text style={{ fontSize: 14, lineHeight: '1.6', color: '#334155', margin: '0 0 16px' }}>
              Akun untuk <b>{school}</b> telah aktif. Anda mendapatkan akses <b>Trial Premium</b>
              gratis selama 14 hari — silakan jelajahi semua fitur ATSkolla.
            </Text>

            <table style={{ width: '100%', fontSize: 13, color: '#334155', borderCollapse: 'collapse', margin: '8px 0 20px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: brand.muted, width: 100 }}>Sekolah</td>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{school}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: brand.muted }}>Email Login</td>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{email}</td>
                </tr>
              </tbody>
            </table>

            <Button
              href={login_url}
              style={{
                backgroundColor: brand.primary, color: '#ffffff', fontSize: 14, fontWeight: 600,
                borderRadius: 10, padding: '12px 22px', textDecoration: 'none',
              }}
            >
              Masuk ke Dashboard
            </Button>

            <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0 12px' }} />
            <Text style={{ fontSize: 12, color: brand.muted, margin: 0, lineHeight: '1.6' }}>
              Butuh bantuan? Balas email ini atau hubungi tim dukungan ATSkolla.
              Kami siap membantu Anda menyiapkan absensi digital di sekolah.
            </Text>
          </Section>
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' as const, margin: '14px 0 0' }}>
            © ATSkolla — Absensi Pintar untuk Sekolah Modern
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: RegisterWelcomeEmail,
  subject: (d: Props) => `Selamat Datang di ATSkolla — ${d?.school || 'Akun Anda'} sudah aktif`,
  displayName: 'Pendaftaran: Selamat Datang',
  previewData: {
    name: 'Budi Santoso',
    school: 'SDN 1 Jakarta',
    email: 'budi@sdn1.sch.id',
    login_url: 'https://absenpintar.online/login',
  },
}
