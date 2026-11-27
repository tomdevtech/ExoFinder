import type { Metadata } from "next";
import { LegalPage, LegalSection, OperatorAddress, OperatorContact } from "../LegalPage";
import { getOperator } from "../operator";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What this website learns about its visitors, and what it does not.",
  // The page repeats the private address of the legal notice.
  robots: { index: false },
};

/** Drops a trailing period so a name like "Example Ltd." can sit inside a sentence that ends with its own period. */
function withoutFinalPeriod(text: string): string {
  return text.replace(/\.$/, "");
}

/**
 * The privacy policy ("Datenschutzerklärung") the GDPR requires. It describes what the code in this repository
 * does, so whoever changes that, for example by adding statistics or a contact form, must update this page too.
 */
export default function PrivacyPage() {
  const { operator, missing } = getOperator();
  const { hosting, hostingContract, hostingTransfer, emailProvider, logDays } = operator;

  return (
    <LegalPage title="Privacy policy" subtitle="Datenschutzerklärung" missing={missing}>
      <LegalSection title="In short">
        <ul>
          <li>No cookies, and nothing is stored in your browser.</li>
          <li>No statistics, no tracking, no advertising.</li>
          <li>No accounts, no forms, no newsletter.</li>
          <li>Nothing is loaded from other companies: fonts, images and maps come from this server.</li>
        </ul>
        <p>
          The only personal data this website handles is what every web server needs in order to
          answer a request, above all your IP address.
        </p>
      </LegalSection>

      <LegalSection title="Who is responsible">
        <p>Responsible for the processing of data on this website (the controller under the GDPR):</p>
        <OperatorAddress operator={operator} />
        <OperatorContact operator={operator} />
      </LegalSection>

      <LegalSection title="When you open a page">
        <p>
          Your browser sends a request to the server, and the server needs your IP address to send
          the answer back. The server writes a log entry for the request with:
        </p>
        <ul>
          <li>the IP address,</li>
          <li>date and time,</li>
          <li>the address of the page or file that was asked for,</li>
          <li>the page the request came from, if your browser tells,</li>
          <li>the name and version of your browser and operating system, as your browser tells them.</li>
        </ul>
        <p>
          The log is needed to keep the website running and to notice attacks and errors. That is
          a legitimate interest, and the legal basis is Art. 6 (1) (f) GDPR. The entries are not
          combined with other data and are not used to find out who you are.{" "}
          {logDays === null
            ? "They are kept only as long as this purpose needs them and are deleted after that."
            : `They are deleted after ${logDays} ${logDays === 1 ? "day" : "days"}.`}
        </p>
        <p>The connection is encrypted (HTTPS), so nobody on the way can read what is sent.</p>
        {hosting !== null &&
          (hostingContract ? (
            <p>
              The website runs on servers of {withoutFinalPeriod(hosting)}. The company processes
              the data named above on behalf of the operator and only as instructed, under a
              contract according to Art. 28 GDPR.
            </p>
          ) : (
            <p>
              The website runs on servers of {withoutFinalPeriod(hosting)}. The company receives
              the data named above because it delivers the pages, and handles it under its own
              privacy policy. Passing the data on rests on the same legitimate interest: without a
              host, the website cannot be reached.
            </p>
          ))}
        {hosting !== null && hostingTransfer !== null && (
          <p>The data may also be processed outside the European Union. {hostingTransfer}</p>
        )}
        <p>
          You do not have to provide this data by law or by contract. Without the IP address,
          however, the server cannot send you the page.
        </p>
      </LegalSection>

      <LegalSection title="When you search">
        <p>
          What you type into a search or filter field is sent to the server, which looks it up in
          the catalogue of planets and stars. The search field does this already while you type,
          to show suggestions. The text is part of the address of the request, for example{" "}
          <span className="font-mono text-sm">/search?q=kepler</span>, so it appears in the log
          entry described above. It is not stored anywhere else and is not linked to you.
        </p>
      </LegalSection>

      <LegalSection title="The 3D models and the map">
        <p>
          The turning planets, the 3D models and the map of the Milky Way are drawn by your own
          device. For that the website asks your browser whether it can draw 3D graphics. Nothing
          about your device is sent to the server.
        </p>
      </LegalSection>

      <LegalSection title="Links to other websites">
        <p>
          This website links to other websites, for example the NASA Exoplanet Archive. Data
          reaches them only when you follow such a link. From then on their own privacy policies
          apply.
        </p>
        <p>
          The catalogue as a PDF file is such a link too: the file is kept at GitHub, so your
          browser asks GitHub for it when you download it, and GitHub learns your IP address the
          way this server does when you open a page.
        </p>
      </LegalSection>

      <LegalSection title="When you write an e-mail">
        <p>
          If you write to the address above, your e-mail address and your message are used to
          answer you, on the basis of Art. 6 (1) (f) GDPR: the legitimate interest is to answer
          what you asked. They are deleted once the matter is settled, unless the law requires them
          to be kept.
        </p>
        {emailProvider !== null && (
          <p>
            E-mails to this address are received and stored by {withoutFinalPeriod(emailProvider)}.
          </p>
        )}
      </LegalSection>

      <LegalSection title="No automated decisions">
        <p>
          This website makes no decisions about you by automated means and creates no profiles
          (Art. 22 GDPR).
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Regarding your personal data you have the right to</p>
        <ul>
          <li>learn which data is processed (Art. 15 GDPR),</li>
          <li>have wrong data corrected (Art. 16 GDPR),</li>
          <li>have data deleted (Art. 17 GDPR),</li>
          <li>have the processing restricted (Art. 18 GDPR),</li>
          <li>
            receive data that you provided in a common, machine-readable format, where the
            processing rests on consent or a contract (Art. 20 GDPR; on this website that is not
            the case),
          </li>
          <li>object to the processing, see the next section (Art. 21 GDPR),</li>
          <li>
            complain to a data protection authority, for example the one where you live (Art. 77
            GDPR).
          </li>
        </ul>
        <p>To use these rights, an e-mail to the address above is enough.</p>
      </LegalSection>

      <LegalSection title="Your right to object">
        {/* Art. 21 (4) GDPR asks for this right to be shown clearly and apart from the rest. */}
        <p className="rounded-lg border border-line px-4 py-3 font-medium">
          All processing described here rests on a legitimate interest (Art. 6 (1) (f) GDPR). You
          may object to it at any time, for reasons that arise from your particular situation (Art.
          21 (1) GDPR). The data is then no longer processed, unless there are compelling
          legitimate grounds that override your interests, rights and freedoms, or the processing
          serves to establish, exercise or defend legal claims. An e-mail to the address above is
          enough.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          This policy describes the website as it is now. When the website changes, the policy
          changes with it. Last changed in November 2026.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
