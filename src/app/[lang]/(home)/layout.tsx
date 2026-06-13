import { type ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { Metadata } from "next";
import { i18n } from "@/lib/i18n";
import { llmAlternateTypes } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  // The home page exists for every configured locale, so advertise all of
  // them. canonical is self-referencing per locale.
  const languages: Record<string, string> = Object.fromEntries(
    i18n.languages.map((locale) => [locale, `/${locale}`]),
  );
  languages["x-default"] = `/${i18n.defaultLanguage}`;

  return {
    title: "Divine Skins Wiki",
    description:
      "Community-written guides for creating custom skins for League of Legends: modeling, VFX, animations, and tools used by the Divine Skins creator community.",
    alternates: {
      canonical: `/${lang}`,
      languages,
      types: llmAlternateTypes,
    },
  };
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  return (
    <HomeLayout {...baseOptions(lang)} className="flex min-h-screen flex-col">
      {children}
    </HomeLayout>
  );
}
