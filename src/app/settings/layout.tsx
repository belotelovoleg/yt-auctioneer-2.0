import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('settings', 'en');

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
