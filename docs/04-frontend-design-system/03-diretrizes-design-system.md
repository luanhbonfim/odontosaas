# 🎨 Diretrizes de Design System & Arquitetura Frontend (PróClínica / OdontoSaaS)

> **Objetivo:** Este documento é o padrão oficial de desenvolvimento frontend da aplicação (tanto para as clínicas/tenants quanto para o painel de governança Vendor Admin).
> **Regra de Ouro:** A **estrutura de formulários, drawers, modais, tabelas, tipografia, espaçamentos e ícones deve ser 100% IDÊNTICA** em toda a aplicação. A **única** diferença entre os módulos é o tema de cores (paleta dos tenants vs Dark Navy do Vendor).

---

## 1. 📐 Fundamentos Visuais & Temas

| Elemento | Aplicação Principal (Tenants) | Painel da Plataforma (Vendor Admin) |
| :--- | :--- | :--- |
| **Ambiente / Contexto** | Gestão da Clínica (Pacientes, Agenda, Financeiro) | Governança Global (Tenants, Planos, Studio, Celery) |
| **Tema Base** | Tema Claro / Escuro (com acentos dourados) | **Dark Navy (Azul Escuro)** (`#0B132B` / `#111D3B`) |
| **Cor Primária (Destaques)** | Dourado (`#D4AF37` / `oklch(0.74 0.13 85)`) | Dourado (`#D4AF37` / `text-[#D4AF37]`) |
| **Superfícies / Cards** | `bg-card` / `border-border` | `bg-[#111D3B]` / `border-[#1E2D56]` |
| **Tipografia** | Inter (sans-serif) | Inter (sans-serif) |
| **Biblioteca de Ícones** | `lucide-react` | `lucide-react` |
| **Título da Aba** | `[Nome da Clínica] - PróClínica` | `Admin - PróClínica` |

---

## 2. 🗂️ Estrutura Padrão de Páginas (`PageHeader`)

Toda página de listagem ou dashboard deve iniciar com o componente padronizado [`PageHeader`](file:///c:/Users/Administrador/Downloads/ODONTO/frontend/src/components/layout/page-header.tsx):

```tsx
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function MinhaPagina() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Planos de Assinatura"
        descricao="Gerenciamento dos planos comerciais disponíveis para as clínicas."
        acoes={
          <Button className="font-semibold bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950">
            <Plus className="size-4 mr-2" />
            Novo Plano
          </Button>
        }
      />
      {/* Conteúdo da página */}
    </div>
  )
}
```

---

## 3. 📝 Padrão Oficial de Formulários & Drawers (`FormKit`)

Todos os formulários de criação e edição usam o **`Sheet` lateral (Drawer)** com o [`FormKit`](file:///c:/Users/Administrador/Downloads/ODONTO/frontend/src/components/common/form-kit.tsx) compartilhado:

### Componentes Obrigatórios do Formulário:
1. **`CabecalhoDrawer`**: Ícone em caixa arredondada (`bg-primary/10 text-primary`) + Título + Descrição.
2. **`CorpoDrawer`**: Contêiner com scroll vertical suave (`overflow-y-auto`).
3. **`SecaoForm`**: Agrupador semântico de campos com título em maiúsculas (`text-xs font-semibold text-muted-foreground uppercase`).
4. **`Campo`**: Envolve `Label`, indicador de obrigatório `*`, o componente de entrada (`Input`, `Select`, `Textarea`), mensagens de ajuda e erros de validação Zod.
5. **`LinhaToggle`**: Checkbox estilizado tipo card com título e descrição auxiliar.
6. **`SheetFooter`**: Botão de Cancelar (`variant="outline"`) e Botão de Salvar com estado `isSubmitting` / `disabled`.

### Exemplo Completo de Formulário Padrão:

```tsx
import { useState, useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CabecalhoDrawer,
  CorpoDrawer,
  SecaoForm,
  Campo,
  LinhaToggle,
} from '@/components/common/form-kit'

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome do plano'),
  preco_mensal: z.number().min(0, 'Preço inválido'),
  ativo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function PlanoFormDrawer({ trigger, plano }: { trigger: ReactNode; plano?: any }) {
  const [aberto, setAberto] = useState(false)
  const edicao = Boolean(plano)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: plano?.nome ?? '',
      preco_mensal: plano?.preco_mensal ?? 0,
      ativo: plano?.ativo ?? true,
    },
  })

  useEffect(() => {
    if (aberto) reset(plano ?? { nome: '', preco_mensal: 0, ativo: true })
  }, [aberto, plano, reset])

  async function onSubmit(valores: FormValues) {
    try {
      // Chamada à API
      toast.success(edicao ? 'Plano atualizado com sucesso.' : 'Plano criado com sucesso.')
      setAberto(false)
    } catch (erro: any) {
      toast.error(erro.mensagem || 'Falha ao salvar dados.')
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col sm:max-w-md bg-[#111D3B] border-[#1E2D56] text-slate-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <CabecalhoDrawer
            icone={Package}
            titulo={edicao ? 'Editar Plano' : 'Novo Plano de Assinatura'}
            descricao="Defina as características e limites operacionais do plano."
          />

          <CorpoDrawer className="mt-6">
            <SecaoForm titulo="Dados do Plano">
              <Campo id="nome" label="Nome do Plano" obrigatorio erro={errors.nome?.message}>
                <Input
                  id="nome"
                  {...register('nome')}
                  placeholder="Ex: Plano Ouro"
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                />
              </Campo>

              <Campo id="preco" label="Preço Mensal (R$)" obrigatorio erro={errors.preco_mensal?.message}>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  {...register('preco_mensal', { valueAsNumber: true })}
                  className="bg-[#0B132B]/80 border-[#1E2D56] text-white"
                />
              </Campo>
            </SecaoForm>

            <SecaoForm titulo="Status & Disponibilidade">
              <LinhaToggle
                titulo="Plano Ativo"
                ajuda="Permite que novas clínicas selecionem este plano durante o cadastro."
                {...register('ativo')}
                className="bg-[#0B132B]/60 border-[#1E2D56]"
              />
            </SecaoForm>
          </CorpoDrawer>

          <SheetFooter className="mt-auto border-t border-[#1E2D56] pt-4">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="border-[#1E2D56] text-slate-300 hover:bg-[#1A2A4E]">
                Cancelar
              </Button>
            </SheetClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#D4AF37] hover:bg-[#c49f2e] text-slate-950 font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Plano'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

---

## 4. 📊 Padrão de Tabelas (`DataTable`) e Badges de Status

- Usar **`@tanstack/react-table`** ou tabelas nativas estilizadas.
- Badges de status usam [`StatusBadge`](file:///c:/Users/Administrador/Downloads/ODONTO/frontend/src/components/common/status-badge.tsx) com ponto colorido acessível:
  - `variante="sucesso"`: Ativo / Pago / Concluído (Verde).
  - `variante="pendente"`: Trial / Pendente / Em Aberto (Amarelo/Âmbar).
  - `variante="erro"`: Inadimplente / Cancelado / Erro (Vermelho).
  - `variante="info"`: Informativo / Processando (Dourado/Azul).

---

## 5. 🎛️ Barra de Navegação & Menu Hambúrguer

1. **Sidebar Responsiva com GPU Acceleration:**
   - Classes: `transition-transform duration-300 ease-in-out will-change-transform`.
   - Desktop: Desliza junto com a margem do conteúdo (`transition-[margin-left] duration-300 ease-in-out`).
   - Mobile: Drawer sobreposto com backdrop suave (`transition-opacity duration-300`).
2. **Regra do Botão Hambúrguer:**
   - **Sidebar Aberta:** O botão hambúrguer é exibido **apenas no topo da sidebar** (para fechá-la).
   - **Sidebar Fechada:** O botão hambúrguer é exibido **apenas na topbar** (`{!sidebarAberta && <Button>...}` para reabri-la).
   - Nunca renderizar dois botões hambúrguer simultaneamente na mesma visualização.
3. **Menu do Usuário (Topbar Direita):**
   - Avatar com ícone `<User className="size-3.5" />` dentro de badge circular.
   - Dropdown com dados do usuário/operador, papel, alternador de tema e botão **Sair** (`variant="destructive"`).

---

## 6. 🚨 Checklist de Qualidade Obrigatório para Novas Telas

Antes de concluir qualquer tela nova:
* [ ] Utiliza `PageHeader` padronizado com título e descrição.
* [ ] Formulários usam `CabecalhoDrawer`, `CorpoDrawer`, `SecaoForm`, `Campo` e `LinhaToggle`.
* [ ] Feedback de ações com `toast.success` e `toast.error` da biblioteca `sonner`.
* [ ] Validação client-side com schemas `zod` e `@hookform/resolvers/zod`.
* [ ] Botões com estados de loading claros (`<Loader2 className="size-4 animate-spin mr-2" />`).
* [ ] Acessibilidade: labels associados a IDs, contrastes de cor testados e sem warnings de linter.
* [ ] `npm run typecheck` (tsc -b) e `npm test` 100% verdes.
