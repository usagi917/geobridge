import type { Metadata } from "next";
import Link from "next/link";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TerraScore - 候補地の居住環境レポート",
  description: "JAXA衛星データと国交省行政データを統合し、候補地の住む価値をレポートします",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <header className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Link href="/" className="inline-block">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-terra-600">TerraScore</span>
                <span className="ml-2 text-sm font-normal text-slate-500">
                  居住環境レポート AI
                </span>
              </h1>
            </Link>
          </div>
        </header>
        <div className="h-0.5 bg-terra-500" />
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="border-t bg-white mt-16">
          <div className="mx-auto max-w-4xl px-4 py-4 text-xs text-gray-400">
            本レポートは参考情報です。最終判断には専門家への相談をお勧めします。
            データ出典: JAXA Earth API / 国交省不動産情報ライブラリ / 国交省データプラットフォーム
          </div>
        </footer>
      </body>
    </html>
  );
}
