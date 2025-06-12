import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('auctions', 'en');

export default function AuctionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
