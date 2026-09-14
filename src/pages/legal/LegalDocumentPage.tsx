import { Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LegalDocumentId } from "@/constants/legalPaths";
import LegalDocument from "@/components/legal/LegalDocument";
import LegalPageLayout from "@/components/legal/LegalPageLayout";

type LegalDocumentPageProps = {
  documentId: LegalDocumentId;
};

const LegalDocumentPage = ({ documentId }: LegalDocumentPageProps) => {
  const { tLegalDocument } = useLanguage();
  const document = tLegalDocument(documentId);

  if (!document) {
    return <Navigate to="/" replace />;
  }

  return (
    <LegalPageLayout>
      <LegalDocument document={document} />
    </LegalPageLayout>
  );
};

export default LegalDocumentPage;
