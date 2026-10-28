import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "../../../components/ui/Button";
import PageHeader from "../../../components/ui/PageHeader";
import { paths } from "../../../app/paths";

type Props = { title?: string; backTo?: string; backLabel?: string };

export default function NotFoundPage({
  title = "Página não encontrada",
  backTo = paths.overview,
  backLabel = "Voltar ao início",
}: Props) {
  return (
    <>
      <PageHeader
        title={title}
        description="O endereço ou registro solicitado não está disponível."
      />
      <ButtonLink variant="secondary" to={backTo}>
        <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
      </ButtonLink>
    </>
  );
}
