import { notFound } from 'next/navigation';
import { readReport } from '@/src/reports/store';
import ReportClient from './ReportClient';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu diagnóstico · OKFlow', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await readReport(id);
  if (!report) notFound();
  return <ReportClient report={report} />;
}
