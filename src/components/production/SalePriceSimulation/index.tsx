import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import Panel from "../../ui/Panel";
import MetricCard, { MetricGrid } from "../../ui/MetricCard";
import styles from "./styles.module.scss";
import { useId, useState } from "react";
import type { CalculatedProduction } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import { money, moneyInputValue, number } from "../../../utils/format";
import { asNumber } from "../../../utils/parsing";

export default function SalePriceSimulation({
  result,
  onPriceChange,
}: {
  result: CalculatedProduction;
  onPriceChange: (price: number | undefined) => void;
}) {
  const inputId = useId();
  const [priceDraft, setPriceDraft] = useState(() =>
    result.expectedSalePrice === undefined
      ? ""
      : String(result.expectedSalePrice).replace(".", ","),
  );
  const price = asNumber(priceDraft, NaN);
  const sellable = remainingPackages(result);
  const revenue = price * sellable;
  const validPrice =
    priceDraft.trim() !== "" &&
    Number.isFinite(price) &&
    price >= 0 &&
    Number.isFinite(revenue);
  const balance = revenue - result.cost;
  const profit =
    Math.abs(balance) <=
      Number.EPSILON * Math.max(1, Math.abs(revenue), Math.abs(result.cost))
      ? 0
      : balance;
  const hasResults = validPrice && sellable > 0;
  const invalidPrice = priceDraft.trim() !== "" && !validPrice;
  const roundUp = (value: number) =>
    Math.ceil(value - Number.EPSILON * Math.max(1, Math.abs(value)));
  const breakEvenPackages =
    result.cost === 0 ? 0 : price > 0 ? roundUp(result.cost / price) : Infinity;

  return (
    <Panel variant="inset" title="Venda esperada">
      <FormField className={styles["simulation-price-field"]} label="Preço de venda desejado / pacote" htmlFor={inputId}>
        
        <FormControl
          id={inputId}
          type="text"
          inputMode="decimal"
          placeholder={moneyInputValue(result.salePrice)}
          value={priceDraft}
          aria-invalid={invalidPrice}
          aria-describedby={invalidPrice ? `${inputId}-error` : undefined}
          onChange={(event) => {
            const draft = event.target.value;
            setPriceDraft(draft);
            if (!draft.trim()) {
              onPriceChange(undefined);
              return;
            }
            const nextPrice = asNumber(draft, NaN);
            if (
              Number.isFinite(nextPrice) &&
              nextPrice >= 0 &&
              Number.isFinite(nextPrice * result.packages)
            )
              onPriceChange(nextPrice);
          }}
          prefix="R$"
        />
      </FormField>
      {invalidPrice && (
        <p className={styles["simulation-message"] + " " + styles["text-negative"]} id={`${inputId}-error`}>
          Informe um preço válido maior ou igual a zero.
        </p>
      )}
      {validPrice && sellable === 0 && (
        <p className={styles["simulation-message"]}>
          Sem pacotes disponíveis para venda.
        </p>
      )}
      <MetricGrid variant="simulation" aria-label="Simulação de venda" aria-live="polite">
        <MetricCard variant="compact" label="Custo / pacote" value={result.packages > 0 ? money(result.costPerPackage) : "—"} />
        <MetricCard variant="compact" label="Faturamento esperado" value={hasResults ? money(revenue) : "—"} />
        <MetricCard variant="compact" label="Lucro esperado" value={hasResults ? money(profit) : "—"} negative={hasResults && profit < 0} />
        <MetricCard variant="compact" label="Lucro / pacote" value={hasResults ? money(profit / sellable) : "—"} negative={hasResults && profit < 0} />
        <MetricCard variant="compact" label="Acréscimo sobre custo"
          value={hasResults && result.cost > 0 ? `${number((profit / result.cost) * 100, 1)}%` : "—"} />
        <MetricCard variant="compact" label="Margem sobre venda"
          value={hasResults && revenue > 0 ? `${number((profit / revenue) * 100, 1)}%` : "—"} />
        <MetricCard variant="compact" label="Pacotes para cobrir o custo"
          value={hasResults ? Number.isFinite(breakEvenPackages) ? `${number(breakEvenPackages)} pacotes` : "Inviável a este preço" : "—"} />
      </MetricGrid>
      {hasResults && profit <= 0 && (
        <p
          className={[styles["simulation-message"], profit < 0 ? styles["text-negative"] : styles["text-positive"]].filter(Boolean).join(" ")}
          role="status"
        >
          {profit < 0
            ? `Mesmo vendendo todos os pacotes, faltariam ${money(-profit)} para cobrir o custo registrado.`
            : "A venda de todos os pacotes cobre exatamente o custo registrado, sem lucro."}
        </p>
      )}
    </Panel>
  );
}
