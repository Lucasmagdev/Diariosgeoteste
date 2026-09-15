const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrencyBRL(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return BRL_FORMATTER.format(value);
}


