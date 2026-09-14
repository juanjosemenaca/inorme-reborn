export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocumentContent = {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
};

export type LegalTranslations = {
  notice: LegalDocumentContent;
  privacy: LegalDocumentContent;
  cookies: LegalDocumentContent;
  banner: {
    title: string;
    description: string;
    accept: string;
    reject: string;
    policyLink: string;
  };
};
