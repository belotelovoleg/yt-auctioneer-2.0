import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('login', 'en');

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
