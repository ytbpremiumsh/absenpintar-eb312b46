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
  bg: '#EEF0FB',
  card: '#ffffff',
  primary: '#5B6CF9',
  primaryDark: '#3D4FE0',
  text: '#0B1020',
  subtext: '#334155',
  muted: '#64748B',
  softLine: '#E2E8F0',
  chipBg: '#EEF1FF',
}

const features = [
  { title: 'Absensi Digital', desc: 'QR, wajah, RFID & manual — data real-time.' },
  { title: 'Laporan Otomatis', desc: 'Rekap harian, mingguan & bulanan siap ekspor.' },
  { title: 'Notifikasi WhatsApp', desc: 'Kirim info kehadiran & tagihan ke wali murid.' },
  { title: 'Manajemen Sekolah', desc: 'Kelola siswa, guru, kelas, jadwal, hingga SPP.' },
]

export function RegisterWelcomeEmail({
  name = 'Bapak/Ibu',
  school = '-',
  email = '-',
  login_url = 'https://absenpintar.online/login',
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Akun {school} aktif — mulai kelola absensi digital sekarang</Preview>
      <Body style={{ backgroundColor: brand.bg, fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: '32px 0' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>

          {/* Hero */}
          <Section style={{
            background: 'linear-gradient(135deg, #5B6CF9 0%, #3D4FE0 100%)',
            borderRadius: '18px 18px 0 0',
            padding: '32px 32px 28px',
            textAlign: 'center' as const,
          }}>
            <div style={{
              display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff',
              padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 16,
            }}>
              ATSkolla
            </div>
            <Heading style={{ fontSize: 26, lineHeight: '1.25', margin: '0 0 8px', color: '#ffffff', fontWeight: 700 }}>
              Selamat datang, {name}!
            </Heading>
            <Text style={{ fontSize: 14, lineHeight: '1.6', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
              Akun sekolah Anda sudah aktif dan siap digunakan.
            </Text>
          </Section>

          {/* Card body */}
          <Section style={{
            backgroundColor: brand.card,
            borderRadius: '0 0 18px 18px',
            padding: '28px 32px 32px',
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
          }}>
            <Text style={{ fontSize: 14, lineHeight: '1.7', color: brand.subtext, margin: '0 0 18px' }}>
              Terima kasih telah bergabung dengan <b>ATSkolla</b> — platform absensi & manajemen sekolah modern.
              Semua fitur sudah aktif untuk sekolah Anda. Mulai jelajahi dashboard dan atur data sekolah.
            </Text>

            {/* Account box */}
            <Section style={{
              backgroundColor: brand.chipBg,
              borderRadius: 12,
              padding: '16px 18px',
              margin: '4px 0 22px',
            }}>
              <Text style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: brand.primary, margin: '0 0 8px', fontWeight: 700 }}>
                Detail Akun
              </Text>
              <table style={{ width: '100%', fontSize: 13, color: brand.text, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 0', color: brand.muted, width: 110 }}>Nama Sekolah</td>
                    <td style={{ padding: '4px 0', fontWeight: 600 }}>{school}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: brand.muted }}>Email Login</td>
                    <td style={{ padding: '4px 0', fontWeight: 600 }}>{email}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* CTA */}
            <div style={{ textAlign: 'center' as const, margin: '4px 0 8px' }}>
              <Button
                href={login_url}
                style={{
                  backgroundColor: brand.primary, color: '#ffffff', fontSize: 14, fontWeight: 700,
                  borderRadius: 12, padding: '14px 28px', textDecoration: 'none',
                  boxShadow: '0 6px 16px rgba(91,108,249,0.35)',
                }}
              >
                Masuk ke Dashboard →
              </Button>
            </div>

            <Hr style={{ borderColor: brand.softLine, margin: '28px 0 20px' }} />

            {/* Features */}
            <Text style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: brand.muted, margin: '0 0 14px', fontWeight: 700 }}>
              Yang Bisa Anda Lakukan
            </Text>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {features.map((f, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' as const, width: 26 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, backgroundColor: brand.primary,
                        color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center' as const,
                        lineHeight: '22px',
                      }}>
                        {i + 1}
                      </div>
                    </td>
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: brand.text, marginBottom: 2 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: brand.muted, lineHeight: '1.55' }}>{f.desc}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Hr style={{ borderColor: brand.softLine, margin: '24px 0 16px' }} />

            <Text style={{ fontSize: 12, color: brand.muted, margin: 0, lineHeight: '1.7' }}>
              Butuh bantuan setup? Balas email ini atau hubungi tim dukungan ATSkolla melalui
              menu <b>Bantuan</b> di dashboard. Kami siap membantu sekolah Anda memulai.
            </Text>
          </Section>

          {/* Footer */}
          <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' as const, margin: '18px 0 4px', lineHeight: '1.6' }}>
            © ATSkolla — Absensi Pintar untuk Sekolah Modern
          </Text>
          <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' as const, margin: 0 }}>
            <a href="https://absenpintar.online" style={{ color: '#94A3B8', textDecoration: 'none' }}>absenpintar.online</a>
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
