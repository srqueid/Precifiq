/**
 * Utilitários para higienização e máscaras de CPF, CNPJ, Telefone e CEP.
 * Garante que apenas números sejam aceitos e digitados.
 */

/**
 * Remove qualquer caractere que não seja dígito (0-9).
 */
export const onlyNumbers = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.toString().replace(/\D/g, '');
};

/**
 * Máscara dinâmica para CPF (11 dígitos) ou CNPJ (14 dígitos).
 * Rejeita qualquer letra ou caractere não numérico.
 */
export const maskCnpjCpf = (value: string | null | undefined): string => {
  const digits = onlyNumbers(value).slice(0, 14);
  if (!digits) return '';

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Máscara para CNPJ estrito (14 dígitos).
 */
export const maskCnpj = (value: string | null | undefined): string => {
  const digits = onlyNumbers(value).slice(0, 14);
  if (!digits) return '';

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Máscara para Telefones fixos e celulares brasileiros (10 ou 11 dígitos).
 * Ex: (11) 99999-9999 ou (11) 3333-3333.
 * Rejeita qualquer letra ou caractere não numérico.
 */
export const maskPhone = (value: string | null | undefined): string => {
  const digits = onlyNumbers(value).slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

/**
 * Máscara para CEP (8 dígitos).
 * Ex: 00000-000.
 */
export const maskCep = (value: string | null | undefined): string => {
  const digits = onlyNumbers(value).slice(0, 8);
  if (!digits) return '';
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
};
