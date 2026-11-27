import type { Metadata } from "next";
import { LegalPage, LegalSection, OperatorAddress, OperatorContact } from "@/app/legal/LegalPage";
import { getOperator } from "@/app/legal/operator";
import { getMessages } from "@/i18n/server";

const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export async function generateMetadata(): Promise<Metadata> {
  const { notice } = (await getMessages()).legal;
  return {
    title: notice.title,
    description: notice.description,
    // A private address should not appear in search results.
    robots: { index: false },
  };
}

/** The legal notice ("Impressum") that German law asks of a website: who runs it and how to reach them. */
export default async function LegalNoticePage() {
  const { notice } = (await getMessages()).legal;
  const { operator, missing } = getOperator();
  const [beforeArchive, beforeFactSheets, afterFactSheets] = notice.dataText;
  const [beforeScope, beforeBrunier, beforeHurt, beforeLicence, afterLicence] = notice.mapsText;

  return (
    <LegalPage title={notice.title} subtitle={notice.subtitle} missing={missing}>
      <LegalSection title={notice.who}>
        <p className="text-sm text-muted">{notice.basis}</p>
        <OperatorAddress operator={operator} />
      </LegalSection>

      {(operator.email !== "" || operator.phone !== null) && (
        <LegalSection title={notice.contact}>
          <OperatorContact operator={operator} />
        </LegalSection>
      )}

      <LegalSection title={notice.about}>
        <p>{notice.aboutText}</p>
      </LegalSection>

      <LegalSection title={notice.data}>
        <p>
          {beforeArchive}
          <a href="https://exoplanetarchive.ipac.caltech.edu/">NASA Exoplanet Archive</a>
          {beforeFactSheets}
          <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/">{notice.factSheets}</a>
          {afterFactSheets}
        </p>
        <p>{notice.illustrations}</p>
        <p>
          {beforeScope}
          <a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a>
          {beforeBrunier}
          <a href="https://www.eso.org/public/images/eso0932a/">ESO/S. Brunier</a>
          {beforeHurt}
          <a href="https://www.eso.org/public/images/eso1339g/">NASA/JPL-Caltech/ESO/R. Hurt</a>
          {beforeLicence}
          <a href={CC_BY}>CC BY 4.0</a>
          {afterLicence}
        </p>
      </LegalSection>

      <LegalSection title={notice.links}>
        <p>{notice.linksText}</p>
      </LegalSection>
    </LegalPage>
  );
}
