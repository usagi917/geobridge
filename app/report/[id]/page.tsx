import { getReport } from "@/lib/db";
import { ReportView } from "@/components/report-view";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const report = getReport(id);

  if (!report) {
    notFound();
  }

  return <ReportView report={report} />;
}
