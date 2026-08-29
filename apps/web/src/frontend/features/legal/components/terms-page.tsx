import { LegalPage, LegalSection } from "@features/legal/components/legal-page";

export function TermsPage() {
  return (
    <LegalPage title="Terms" updated="August 2026">
      <p>
        This is a draft. It is not legal advice. If it conflicts with the
        product, the product wins until we replace this.
      </p>

      <LegalSection title="What you capture is yours">
        <p>
          You own what you dump in: pages, files, notes, mail. We host
          it so you can search it and so a model you already use can read it
          over MCP. We do not claim it.
        </p>
      </LegalSection>

      <LegalSection title="Use">
        <p>
          Don’t break the service, scrape other people’s saves, or use Pwor to
          store anything you’re not allowed to have. Keys (clipper, MCP) act as
          you. Keep them to yourself.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Pwor is provided as-is. Search, enrichment, and embeddings can fail
          or be wrong. Self-host if you want the bits on your own Cloudflare
          account.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms: hello@pwor.app.</p>
      </LegalSection>
    </LegalPage>
  );
}
