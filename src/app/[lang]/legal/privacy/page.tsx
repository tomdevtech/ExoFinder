import type { Metadata } from "next";
import { LegalPage, LegalSection, OperatorAddress, OperatorContact } from "@/app/legal/LegalPage";
import { getOperator } from "@/app/legal/operator";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { privacy } = (await getMessages()).legal;
  return {
    title: privacy.title,
    description: privacy.description,
    // The page repeats the private address of the legal notice.
    robots: { index: false },
  };
}

/** Drops a trailing period so a name like "Example Ltd." can sit inside a sentence that ends with its own period. */
function withoutFinalPeriod(text: string): string {
  return text.replace(/\.$/, "");
}

/**
 * The privacy policy ("Datenschutzerklärung") the GDPR requires. It describes what the code in this repository
 * does, so whoever changes that, for example by adding statistics or a contact form, must update this page too.
 */
export default async function PrivacyPage() {
  const m = await getMessages();
  const text = m.legal.privacy;
  const { operator, missing } = getOperator();
  const { hosting, hostingContract, hostingTransfer, emailProvider, logDays } = operator;
  const [beforeExample, afterExample] = text.searchText;

  return (
    <LegalPage title={text.title} subtitle={text.subtitle} missing={missing}>
      <LegalSection title={text.short}>
        <ul>
          {text.shortList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{text.shortText}</p>
      </LegalSection>

      <LegalSection title={text.responsible}>
        <p>{text.responsibleText}</p>
        <OperatorAddress operator={operator} />
        <OperatorContact operator={operator} />
      </LegalSection>

      <LegalSection title={text.open}>
        <p>{text.openText}</p>
        <ul>
          {text.logList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          {text.logPurpose}
          {logDays === null ? text.logKept : text.logDeleted(logDays)}
        </p>
        <p>{text.encrypted}</p>
        {hosting !== null && (
          <p>{hostingContract ? text.hostContract(withoutFinalPeriod(hosting)) : text.hostOwn(withoutFinalPeriod(hosting))}</p>
        )}
        {hosting !== null && hostingTransfer !== null && <p>{text.hostTransfer(hostingTransfer)}</p>}
        <p>{text.notRequired}</p>
      </LegalSection>

      <LegalSection title={text.search}>
        <p>
          {beforeExample}
          <span className="font-mono text-sm">/{m.locale}/search?q=kepler</span>
          {afterExample}
        </p>
      </LegalSection>

      <LegalSection title={text.language}>
        <p>{text.languageText}</p>
      </LegalSection>

      <LegalSection title={text.models}>
        <p>{text.modelsText}</p>
      </LegalSection>

      <LegalSection title={text.links}>
        <p>{text.linksText}</p>
        <p>{text.catalogueText}</p>
      </LegalSection>

      <LegalSection title={text.mail}>
        <p>{text.mailText}</p>
        {emailProvider !== null && <p>{text.mailProvider(withoutFinalPeriod(emailProvider))}</p>}
      </LegalSection>

      <LegalSection title={text.automated}>
        <p>{text.automatedText}</p>
      </LegalSection>

      <LegalSection title={text.rights}>
        <p>{text.rightsIntro}</p>
        <ul>
          {text.rightsList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{text.rightsHow}</p>
      </LegalSection>

      <LegalSection title={text.object}>
        {/* Art. 21 (4) GDPR asks for this right to be shown clearly and apart from the rest. */}
        <p className="rounded-lg border border-line px-4 py-3 font-medium">{text.objectText}</p>
      </LegalSection>

      <LegalSection title={text.changes}>
        <p>{text.changesText}</p>
      </LegalSection>
    </LegalPage>
  );
}
