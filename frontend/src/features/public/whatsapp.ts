// Utilitário de geração de links para o WhatsApp comercial da plataforma.
//
// TODO(usuario): trocar o número abaixo pelo WhatsApp comercial real (formato
// internacional, apenas dígitos: DDI + DDD + número). Ex.: 5518999999999.
export const NUMERO_COMERCIAL = '5518996902466'

export type Periodicidade = 'MENSAL' | 'ANUAL' | 'PERMANENTE'

function periodicidadeLabel(periodicidade: Periodicidade): string {
  if (periodicidade === 'ANUAL') return 'Anual'
  if (periodicidade === 'PERMANENTE') return 'Vitalício'
  return 'Mensal'
}

/** Monta a URL do WhatsApp (wa.me) com uma mensagem já codificada. */
export function linkWhatsApp(mensagem: string): string {
  return `https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent(mensagem)}`
}

/** Link de contratação de um plano específico, com periodicidade no texto. */
export function gerarLinkWhatsApp(planoNome: string, periodicidade: Periodicidade): string {
  const mensagem = `Olá! Tenho interesse no Plano ${planoNome} (${periodicidadeLabel(
    periodicidade,
  )}) do PróClínica.`
  return linkWhatsApp(mensagem)
}

// Mensagens pré-formatadas dos CTAs institucionais (header/hero/floating).
export const MSG_CONSULTOR =
  'Olá! Estou no site do PróClínica e gostaria de falar com um consultor sobre o sistema para minha clínica.'
export const MSG_DEMONSTRACAO =
  'Olá! Gostaria de agendar uma demonstração gratuita do PróClínica para conhecer os recursos na prática.'
