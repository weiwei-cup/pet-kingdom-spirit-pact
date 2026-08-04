import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://weiwei-cup.github.io/pet-kingdom-spirit-pact";
const title = "宠物王国：灵契｜可玩序章";
const description =
  "彩虹庆典上，所有登记过的宠物同时忘记主人。选择你的第一位伙伴，守护记忆，揭开黑衣组织留下的灵契悬案。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "宠物王国：灵契",
  openGraph: {
    description,
    title,
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "宠物王国：灵契可玩序章" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
