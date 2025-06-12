import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('lots', 'en');

export default function LotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
