import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('profile', 'en');

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
