import { Bell, Gift, Info, Megaphone, PartyPopper, Rocket, Sparkles, Wrench, type LucideIcon } from 'lucide-react'

/** Ícones selecionáveis pro Vendor exibir no lugar da imagem quando o aviso
 * não tiver `imagem_url`. Chaves espelham `Aviso.Icone` no backend. */
export const ICONES_AVISO: Record<string, { rotulo: string; Icon: LucideIcon }> = {
  megafone: { rotulo: 'Megafone', Icon: Megaphone },
  sparkles: { rotulo: 'Novidade (estrelas)', Icon: Sparkles },
  presente: { rotulo: 'Presente', Icon: Gift },
  sino: { rotulo: 'Sino', Icon: Bell },
  foguete: { rotulo: 'Foguete', Icon: Rocket },
  festa: { rotulo: 'Comemoração', Icon: PartyPopper },
  ferramenta: { rotulo: 'Manutenção', Icon: Wrench },
  info: { rotulo: 'Informação', Icon: Info },
}

/** Ícone do aviso (fallback Megafone se a chave vier vazia/desconhecida). */
export function iconeAviso(chave: string | undefined): LucideIcon {
  return ICONES_AVISO[chave ?? '']?.Icon ?? Megaphone
}
