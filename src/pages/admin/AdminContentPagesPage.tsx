import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  ExternalLink,
  Eye,
  Heading2,
  Heading3,
  LifeBuoy,
  Link2,
  List,
  Loader2,
  PencilLine,
  Save,
  Scale,
} from 'lucide-react';
import { FaqAccordion } from '@/features/content/components/FaqAccordion';
import { splitFaq } from '@/features/content/faq';
import { MarkdownContent } from '@/features/content/markdown/MarkdownContent';
import { parseMarkdown } from '@/features/content/markdown/parse';
import { FAQ_SLUG } from '@/features/content/registry';
import { useToastStore } from '@/stores/toastStore';
import {
  useAdminPageDetail,
  useAdminPagesList,
  useAdminUpdatePage,
} from '@/features/admin/api/useAdminQueries';
import type {
  AdminContentPageDetail,
  AdminContentPageSummary,
} from '@/features/admin/types';

function publicUrlForPage(page: Pick<AdminContentPageSummary, 'slug' | 'kind'>): string {
  if (page.slug === FAQ_SLUG || page.kind === 'faq') {
    return '/aide#questions-frequentes';
  }
  if (page.kind === 'help') {
    return `/aide/${page.slug}`;
  }
  return `/pages/${page.slug}`;
}

function extractPlaceholdersFromBody(body: string): string[] {
  const matches = body.match(/\[À COMPLÉTER[^\]]*\]/gi);
  return matches ? [...matches] : [];
}

interface MarkdownPageEditorProps {
  pageDetail: AdminContentPageDetail;
  kind: 'legal' | 'help' | 'faq';
}

function MarkdownPageEditor({ pageDetail, kind }: MarkdownPageEditorProps) {
  const updatePageMutation = useAdminUpdatePage();
  const notifyToast = useToastStore((s) => s.show);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [title, setTitle] = useState(pageDetail.title);
  const [body, setBody] = useState(pageDetail.body);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');

  const livePlaceholders = useMemo(
    () => extractPlaceholdersFromBody(body),
    [body],
  );

  const parsedBlocks = useMemo(() => parseMarkdown(body), [body]);
  const faqSplit = useMemo(
    () => (pageDetail.slug === FAQ_SLUG ? splitFaq(parsedBlocks) : null),
    [pageDetail.slug, parsedBlocks],
  );

  const handleInsertSnippet = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => `${prev}\n${prefix}${suffix}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || 'texte';
    const nextText = `${body.slice(0, start)}${prefix}${selected}${suffix}${body.slice(end)}`;
    setBody(nextText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  };

  const handleSelectPlaceholder = (placeholder: string) => {
    setMobileTab('write');
    const el = textareaRef.current;
    const idx = body.indexOf(placeholder);
    if (idx === -1 || !el) return;
    el.focus();
    el.setSelectionRange(idx, idx + placeholder.length);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    updatePageMutation.mutate(
      {
        slug: pageDetail.slug,
        payload: {
          title: title.trim(),
          body,
        },
      },
      {
        onSuccess: (res) => {
          notifyToast({
            message: `Page « ${res.title} » enregistrée (${res.missingPlaceholdersCount} passage(s) à compléter restant(s))`,
          });
        },
      },
    );
  };

  const publicHref = publicUrlForPage({ slug: pageDetail.slug, kind });

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-sm border border-silver/50 bg-white p-4 sm:p-5"
    >
      {/* En-tête de la page en cours d'édition */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver/30 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-charcoal">
              {pageDetail.slug}
            </span>
            {livePlaceholders.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 px-2 py-0.5 font-body text-xs font-bold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Prêt ✓
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-sm bg-warning/15 px-2 py-0.5 font-body text-xs font-bold text-ink">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                {livePlaceholders.length} passage
                {livePlaceholders.length > 1 ? 's' : ''} [À COMPLÉTER]
              </span>
            )}
          </div>
          <h2 className="mt-1 font-display text-lg font-bold uppercase text-ink">
            {title || pageDetail.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-silver/60 bg-surface px-3 py-1.5 font-body text-xs font-semibold text-ink hover:border-ink"
          >
            Voir sur le site
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          <button
            type="submit"
            disabled={updatePageMutation.isPending}
            className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-ink px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal disabled:opacity-50"
          >
            {updatePageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer la page
          </button>
        </div>
      </div>

      {/* Bandeau interactif des passages [À COMPLÉTER...] détectés */}
      {livePlaceholders.length > 0 && (
        <div className="rounded-sm border border-warning/40 bg-warning/10 p-3">
          <p className="font-body text-xs font-bold text-ink">
            Passages [À COMPLÉTER] restants dans cette page (cliquez pour
            sélectionner dans l’éditeur) :
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {livePlaceholders.map((ph, idx) => (
              <button
                key={`${ph}-${idx}`}
                type="button"
                onClick={() => handleSelectPlaceholder(ph)}
                className="max-w-full truncate rounded-sm border border-warning/50 bg-white px-2.5 py-1 font-mono text-[11px] text-ink hover:border-ink"
              >
                {ph}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Champ Titre */}
      <div>
        <label
          htmlFor="page-title-input"
          className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
        >
          Titre de la page
        </label>
        <input
          id="page-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm font-bold text-ink"
          required
        />
      </div>

      {/* Sélecteur d'onglets Mobile (Écrire / Aperçu) */}
      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('write')}
          className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-sm border font-body text-xs font-bold uppercase ${
            mobileTab === 'write'
              ? 'border-ink bg-ink text-white'
              : 'border-silver/60 bg-surface text-ink'
          }`}
        >
          <PencilLine className="h-3.5 w-3.5" />
          Écrire
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-sm border font-body text-xs font-bold uppercase ${
            mobileTab === 'preview'
              ? 'border-ink bg-ink text-white'
              : 'border-silver/60 bg-surface text-ink'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Aperçu
        </button>
      </div>

      {/* Double colonne côte à côte sur ordinateur (lg:grid-cols-2) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Colonne gauche : Éditeur Markdown */}
        <div
          className={
            mobileTab === 'preview' ? 'hidden lg:block' : 'block'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-1 rounded-t-sm border border-b-0 border-silver/60 bg-surface px-2.5 py-1.5">
            <span className="font-body text-[11px] font-bold uppercase tracking-wider text-charcoal">
              Texte Markdown
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleInsertSnippet('## ')}
                title="Titre H2"
                className="rounded-sm border border-silver/50 bg-white p-1.5 text-ink hover:border-ink"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('### ')}
                title="Titre H3"
                className="rounded-sm border border-silver/50 bg-white p-1.5 text-ink hover:border-ink"
              >
                <Heading3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('**', '**')}
                title="Gras"
                className="rounded-sm border border-silver/50 bg-white p-1.5 text-ink hover:border-ink"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('- ')}
                title="Liste"
                className="rounded-sm border border-silver/50 bg-white p-1.5 text-ink hover:border-ink"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('[', '](/aide)')}
                title="Lien"
                className="rounded-sm border border-silver/50 bg-white p-1.5 text-ink hover:border-ink"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            aria-label="Contenu Markdown de la page"
            rows={20}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-b-sm border border-silver/60 bg-white p-3 font-mono text-xs leading-relaxed text-ink focus:border-ink focus:outline-none"
          />
        </div>

        {/* Colonne droite : Aperçu fidèle (parseMarkdown / splitFaq) */}
        <div
          className={
            mobileTab === 'write' ? 'hidden lg:block' : 'block'
          }
        >
          <div className="rounded-t-sm border border-b-0 border-silver/60 bg-surface px-3 py-2">
            <span className="font-body text-[11px] font-bold uppercase tracking-wider text-charcoal">
              Aperçu client en direct
            </span>
          </div>
          <div
            data-testid="markdown-live-preview"
            className="max-h-[32rem] overflow-y-auto rounded-b-sm border border-silver/60 bg-white p-4"
          >
            <h3 className="mb-4 font-display text-xl font-bold uppercase text-ink">
              {title}
            </h3>
            {faqSplit ? (
              <div className="space-y-4">
                {faqSplit.intro.length > 0 && (
                  <MarkdownContent blocks={faqSplit.intro} />
                )}
                <FaqAccordion items={faqSplit.items} />
              </div>
            ) : (
              <MarkdownContent blocks={parsedBlocks} />
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

export default function AdminContentPagesPage() {
  const pagesListQuery = useAdminPagesList();
  const pages = useMemo(
    () => pagesListQuery.data?.pages ?? [],
    [pagesListQuery.data?.pages],
  );
  const totalMissing = pagesListQuery.data?.totalMissingPlaceholders ?? 0;

  const [selectedSlug, setSelectedSlug] = useState<string>('conditions-generales');

  const pageDetailQuery = useAdminPageDetail(selectedSlug);
  const selectedSummary = pages.find((p) => p.slug === selectedSlug);

  const helpAndFaqPages = useMemo(
    () => pages.filter((p) => p.kind === 'help' || p.kind === 'faq'),
    [pages],
  );
  const legalPages = useMemo(
    () => pages.filter((p) => p.kind === 'legal'),
    [pages],
  );

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête + compteur global [À COMPLÉTER] */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
            Pages légales, Guides d’aide & FAQ
          </h1>
          <p className="mt-0.5 font-body text-xs text-charcoal">
            Éditeur Markdown en direct pour les 9 pages d’information et de
            conformité de la boutique (SP-012, SP-013).
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-sm border border-silver/50 bg-white px-3.5 py-2">
          {totalMissing === 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-body text-xs font-bold text-success">
                Toutes les pages sont complètes ✓
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span
                data-testid="total-missing-placeholders"
                className="font-body text-xs font-bold text-ink"
              >
                {totalMissing} passage{totalMissing > 1 ? 's' : ''} [À COMPLÉTER]
                au total
              </span>
            </>
          )}
        </div>
      </div>

      {pagesListQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Liste des 9 contenus à gauche (4 colonnes sur xl) */}
          <div className="space-y-5 xl:col-span-4">
            {/* Section 1 : Pages légales */}
            <section className="rounded-sm border border-silver/50 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-silver/30 pb-2.5">
                <Scale className="h-4 w-4 text-red" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                  Pages légales ({legalPages.length})
                </h2>
              </div>
              <div className="space-y-2">
                {legalPages.map((p) => {
                  const isSelected = p.slug === selectedSlug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelectedSlug(p.slug)}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm border p-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-ink bg-ink text-white'
                          : 'border-silver/40 bg-surface text-ink hover:border-ink'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-xs font-bold">
                          {p.title}
                        </p>
                        <p
                          className={`font-mono text-[10px] ${
                            isSelected ? 'text-silver' : 'text-charcoal'
                          }`}
                        >
                          /pages/{p.slug}
                        </p>
                      </div>
                      {p.missingPlaceholdersCount > 0 ? (
                        <span
                          className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold ${
                            isSelected
                              ? 'bg-warning text-white'
                              : 'bg-warning/15 text-ink'
                          }`}
                        >
                          {p.missingPlaceholdersCount} à compléter
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 rounded-sm px-2 py-0.5 font-body text-[10px] font-bold ${
                            isSelected
                              ? 'bg-success text-white'
                              : 'bg-success/15 text-success'
                          }`}
                        >
                          Prêt ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 2 : Pages d'aide & FAQ */}
            <section className="rounded-sm border border-silver/50 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-silver/30 pb-2.5">
                <LifeBuoy className="h-4 w-4 text-red" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                  Guides d’aide & FAQ ({helpAndFaqPages.length})
                </h2>
              </div>
              <div className="space-y-2">
                {helpAndFaqPages.map((p) => {
                  const isSelected = p.slug === selectedSlug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelectedSlug(p.slug)}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm border p-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-ink bg-ink text-white'
                          : 'border-silver/40 bg-surface text-ink hover:border-ink'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-xs font-bold">
                          {p.title}
                        </p>
                        <p
                          className={`font-mono text-[10px] ${
                            isSelected ? 'text-silver' : 'text-charcoal'
                          }`}
                        >
                          {p.slug === FAQ_SLUG ? '/aide#faq' : `/aide/${p.slug}`}
                        </p>
                      </div>
                      {p.missingPlaceholdersCount > 0 ? (
                        <span
                          className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold ${
                            isSelected
                              ? 'bg-warning text-white'
                              : 'bg-warning/15 text-ink'
                          }`}
                        >
                          {p.missingPlaceholdersCount} à compléter
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 rounded-sm px-2 py-0.5 font-body text-[10px] font-bold ${
                            isSelected
                              ? 'bg-success text-white'
                              : 'bg-success/15 text-success'
                          }`}
                        >
                          Prêt ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Éditeur Markdown à droite (8 colonnes sur xl) */}
          <div className="xl:col-span-8">
            {pageDetailQuery.isLoading || !pageDetailQuery.data ? (
              <div className="flex min-h-[30vh] items-center justify-center rounded-sm border border-silver/40 bg-white">
                <Loader2 className="h-6 w-6 animate-spin text-ink" />
              </div>
            ) : (
              <MarkdownPageEditor
                key={`${pageDetailQuery.data.slug}-${pageDetailQuery.data.updatedAt}`}
                pageDetail={pageDetailQuery.data}
                kind={selectedSummary?.kind ?? 'legal'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
