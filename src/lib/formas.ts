// Formas de recebimento usadas no Financeiro. O Pix é separado pela conta que
// recebe: Pix PJ (CNPJ da empresa) ou Pix CPF. "Pix" sozinho fica só nos
// lançamentos antigos, antes da separação.
export const FORMAS = ["Pix PJ", "Pix CPF", "Boleto", "Cartão", "Transferência"] as const;
export const FORMAS_PAINEL = ["Pix PJ", "Pix CPF", "Pix", "Boleto", "Cartão", "Transferência"] as const;
