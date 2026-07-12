import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { articles, getArticle, type ArticleBlock } from "@/content/articles";
import ArticleCTA from "@/components/ArticleCTA";

const BASE_URL = "https://heim-virid.vercel.app";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `${BASE_URL}/artikler/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${BASE_URL}/artikler/${article.slug}`,
      type: "article",
      publishedTime: article.date,
      images: [{ url: "/heim-512.png", width: 512, height: 512, alt: "Heim" }],
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.description,
      images: ["/heim-512.png"],
    },
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="text-[22px] font-[700] tracking-[-0.01em] mt-10 mb-3" style={{ color: "var(--foreground)" }}>{block.text}</h2>;
    case "h3":
      return <h3 className="text-[17px] font-[700] mt-6 mb-2" style={{ color: "var(--foreground)" }}>{block.text}</h3>;
    case "ul":
      return (
        <ul className="list-disc list-outside pl-5 space-y-1.5 mb-4 text-[15.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case "cta":
      return <ArticleCTA />;
    case "p":
    default:
      return <p className="text-[15.5px] leading-[1.7] mb-4" style={{ color: "var(--text-2)" }}>{block.text}</p>;
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = articles.filter((a) => a.slug !== article.slug).slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: "nb-NO",
    author: { "@type": "Organization", name: "Heim" },
    publisher: {
      "@type": "Organization",
      name: "Heim",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/heim-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/artikler/${article.slug}` },
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: "rgba(245,246,248,.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Heim" width={90} height={28} />
          </Link>
          <Link href="/login?tab=signup"
            className="text-[14px] font-[600] px-4 py-2 rounded-[10px] text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}>
            Kom i gang
          </Link>
        </div>
      </nav>

      <main className="max-w-[680px] mx-auto px-5 py-14">
        <Link href="/artikler" className="text-[13.5px] font-[550] mb-6 inline-block hover:opacity-80" style={{ color: "var(--accent)" }}>
          ← Alle artikler
        </Link>
        <p className="text-[12.5px] font-[600] uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
          {fmtDate(article.date)}
        </p>
        <h1 className="text-[30px] sm:text-[36px] font-[800] tracking-[-0.02em] leading-[1.15] mb-8">
          {article.title}
        </h1>

        <article>
          {article.body.map((block, i) => <Block key={i} block={block} />)}
        </article>

        {related.length > 0 && (
          <div className="mt-14 pt-8 border-t border-[var(--border)]">
            <p className="text-[13px] font-[600] uppercase tracking-wide mb-4" style={{ color: "var(--text-3)" }}>Les også</p>
            <div className="space-y-3">
              {related.map((a) => (
                <Link key={a.slug} href={`/artikler/${a.slug}`}
                  className="block text-[15px] font-[600] hover:opacity-80 transition-opacity"
                  style={{ color: "var(--accent)" }}>
                  {a.title} →
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-[680px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Heim" width={70} height={22} />
            <span className="text-[13px]" style={{ color: "var(--text-3)" }}>— Delt familieplanlegger</span>
          </div>
          <div className="flex items-center gap-5 text-[13px]" style={{ color: "var(--text-3)" }}>
            <Link href="/artikler" className="hover:text-[var(--foreground)] transition-colors">Alle artikler</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Personvern</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Vilkår</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
