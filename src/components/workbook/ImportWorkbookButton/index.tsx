import Button from "../../ui/Button";
import { useRef, type ChangeEvent } from "react";
import Icon from "../../ui/Icon";

type Props = { onImport: (file: File) => Promise<void> };

export default function ImportWorkbookButton({ onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onImport(file);
    } finally {
      input.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleChange}
        hidden
      />
      <Button
        variant="secondary"
        onClick={() => fileInput.current?.click()}
      >
        <Icon name="upload" size={17} /> Importar planilha
      </Button>
    </>
  );
}
