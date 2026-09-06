import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

export type PapelCustomizavel = 'RECEPCAO' | 'DENTISTA'

export type CelulaPermissao = {
  papel: PapelCustomizavel
  modulo: string
  ver: boolean
  criar: boolean
  editar: boolean
  excluir: boolean
}

const CHAVE = ['permissoes-modulo']

/** Grade papel×módulo (Recepção/Dentista) — Gerente/Admin. */
export function usePermissoesModulo() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<CelulaPermissao[]>('/permissoes-modulo/')).data,
  })
}

/** Salva a grade inteira — aplica na hora (backend resincroniza os grupos) e
 * também invalida a sessão, pra quem estiver testando via impersonate ver o
 * menu atualizar sem precisar relogar. */
export function useSalvarPermissoesModulo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (grade: CelulaPermissao[]) =>
      (await api.put<CelulaPermissao[]>('/permissoes-modulo/', grade)).data,
    onSuccess: (data) => {
      qc.setQueryData(CHAVE, data)
      qc.invalidateQueries({ queryKey: ['sessao'] })
    },
  })
}
