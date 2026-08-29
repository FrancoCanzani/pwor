import { LegalPage, LegalSection } from "@features/legal/components/legal-page";

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="August 2026">
      <p>
        This is a draft. It is not legal advice. It describes how Pwor treats
        what you put in it.
      </p>

      <LegalSection title="What we store">
        <p>
          Account email (magic link). The items and notes you capture.
          Titles, summaries, tags, and markdown we extract so your saves are
          searchable. Embeddings of that text. Files in object storage. API
          keys for the clipper and MCP. An inbound mail address if you use
          email capture.
        </p>
      </LegalSection>

      <LegalSection title="What we don’t">
        <p>
          We don’t sell what you capture. We don’t train a public model on it. A
          key you mint can read and capture as you. Revoke it if it leaks.
        </p>
      </LegalSection>

      <LegalSection title="Where it lives">
        <p>
          Hosted Pwor runs on Cloudflare (D1, R2, Vectorize, Workers). If you
          self-host, it lives on your account instead.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Privacy questions: hello@pwor.app.</p>
      </LegalSection>
    </LegalPage>
  );
}
