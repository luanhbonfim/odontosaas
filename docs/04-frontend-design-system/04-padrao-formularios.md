# 04 — Padrão de Formulários (form-kit)

> Todo formulário em drawer (Sheet) da aplicação segue este padrão, usando o kit
> compartilhado **`src/components/common/form-kit.tsx`**. Ao criar um formulário
> novo, **reutilize o kit** — não recrie labels/estilos à mão. Assim todos ficam
> visualmente consistentes e amigáveis.

## 1. O kit (`@/components/common/form-kit`)

| Peça | Uso |
|---|---|
| `CabecalhoDrawer({ icone, titulo, descricao })` | Cabeçalho do drawer: ícone (lucide) em círculo + título + descrição curta. Substitui `SheetHeader/SheetTitle/SheetDescription`. |
| `CorpoDrawer` | Corpo **rolável** do formulário (para formulários longos não estourarem a altura). Envolve os campos; já aplica `space-y-5`. |
| `SecaoForm({ titulo, icone? })` | Cabeçalho de seção (agrupa campos relacionados: "Dados", "Contato", "Acesso"…). |
| `Campo({ id, label, obrigatorio?, ajuda?, erro?, className? })` | Um campo: label (+ `*` se obrigatório) + controle (children) + **ajuda** OU **erro** embaixo. |
| `LinhaToggle({ titulo, ajuda?, ...inputProps })` | Toggle amigável (checkbox estilizado em linha com título + ajuda). Destaca quando ligado. |
| `classeCampoSelect` | Classe padrão para `<select>` nativos (mesmo visual dos inputs). |

## 2. Regras

- **Sempre** `<SheetContent className="flex flex-col">` + `CabecalhoDrawer` + `CorpoDrawer` + `SheetFooter`.
- **Rodapé** fixo (fora do `CorpoDrawer`): `Cancelar` (SheetClose, variant outline) + `Salvar` (com estado `Salvando…`).
- **Ícone**: escolha um lucide coerente com a entidade (ex.: `Stethoscope` dentista, `CreditCard` plano, `ClipboardList` procedimento, `UserRound` usuário, `BadgeCheck` convênio, `MessageSquareText` template).
- **`id` do input = `htmlFor` do `Campo`** (acessibilidade + os testes usam `getByLabelText`). Não mude o texto das labels sem checar os testes.
- **Toggles** (ativo, flags): use `LinhaToggle`. Com React Hook Form: `<LinhaToggle titulo="…" {...register('ativo')} />`. Com estado local: `checked`/`onChange`.
- **Obrigatório**: `obrigatorio` no `Campo` (mostra o `*`); a validação continua no Zod/RHF.
- **Ajuda vs erro**: `Campo` mostra `erro` se houver, senão `ajuda`. Passe `erro={errors.campo?.message}`.
- **Placeholders** úteis (ex.: `"email@exemplo.com"`, `"ex.: CRO-SP 12345"`).
- Campos lado a lado: `<div className="grid gap-4 sm:grid-cols-2">…</div>` dentro do `CorpoDrawer`.

## 3. Esqueleto (copiar e adaptar)

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { IconeDaEntidade } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CabecalhoDrawer, Campo, CorpoDrawer, LinhaToggle, SecaoForm } from '@/components/common/form-kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTrigger } from '@/components/ui/sheet'
import type { ErroApi } from '@/lib/api/client'

const schema = z.object({ nome: z.string().min(1, 'Informe o nome'), ativo: z.boolean() })
type FormValues = z.infer<typeof schema>

export function EntidadeFormDrawer({ trigger, item }) {
  const [aberto, setAberto] = useState(false)
  const edicao = Boolean(item)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nome: '', ativo: true } })
  useEffect(() => { if (aberto) reset(/* valoresIniciais(item) */) }, [aberto, item, reset])

  async function onSubmit(v: FormValues) {
    try {
      /* criar/atualizar */
      toast.success(edicao ? 'Atualizado.' : 'Criado.')
      setAberto(false)
    } catch (e) { toast.error((e as ErroApi).mensagem ?? 'Não foi possível salvar.') }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <CabecalhoDrawer
          icone={IconeDaEntidade}
          titulo={edicao ? 'Editar entidade' : 'Nova entidade'}
          descricao="Descrição curta do que é este cadastro."
        />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4">
          <CorpoDrawer>
            <SecaoForm titulo="Dados">
              <Campo id="nome" label="Nome" obrigatorio erro={errors.nome?.message}>
                <Input id="nome" placeholder="ex.: …" aria-required="true" {...register('nome')} />
              </Campo>
            </SecaoForm>
            <LinhaToggle titulo="Ativo" ajuda="Explique o efeito de desligar." {...register('ativo')} />
          </CorpoDrawer>
          <SheetFooter>
            <SheetClose asChild><Button type="button" variant="outline">Cancelar</Button></SheetClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

## 3.1. Ações de linha/card (ordem e ícones — padrão da Equipe)

Toda lista/card com ações por item segue **a mesma ordem e ícones da Equipe**
(`features/usuarios/acoes-usuario.tsx`):

1. **Editar** — ícone `Pencil` (lápis), `Button variant="ghost" size="icon"`
   (nunca o texto "Editar"). `title`/`aria-label` = "Editar …".
2. **Ativar/Desativar** — `CircleCheck` (verde, `text-success`) quando inativo →
   ativa; `Ban` (vermelho, `text-destructive`) quando ativo → inativa. Ação
   destrutiva/sensível pode usar `ConfirmDialog`.
3. **Excluir** — ícone `Trash2` (`text-destructive`), por último. Só quando o
   item é removível (ex.: os templates fixos não têm excluir).

**Item inativo = aparência de desativado:** o card/linha ganha visual apagado —
`border-dashed bg-muted/30` no container + `opacity-50` no conteúdo (ícone,
título, corpo). As **ações continuam em opacidade normal** (para reativar sem
esforço).

Referência: `features/notificacoes/notificacoes-page.tsx` (cards de template) e
`features/usuarios/acoes-usuario.tsx`.

## 4. Onde já é usado (referência viva)

`convenios/convenios-page.tsx`, `procedimentos/procedimentos-page.tsx`,
`pacientes/aba-planos.tsx`, `dentistas/dentista-form-drawer.tsx`,
`usuarios/usuario-form-drawer.tsx`, `notificacoes/notificacoes-page.tsx` (TemplateDrawer).
Copie de um deles quando for criar um novo.
