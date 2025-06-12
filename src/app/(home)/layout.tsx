import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('home', 'en');

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
