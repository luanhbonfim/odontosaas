import { type ComponentType, lazy } from 'react'

/** Carrega uma página sob demanda (code-splitting por rota). Cada página vira um chunk
 * próprio — o pacote inicial fica só com o roteador, os shells e as guardas de acesso.
 * Os componentes são exports nomeados, daí o `{ default: ... }`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sobDemanda<M extends Record<string, ComponentType<any>>, K extends keyof M>(
  importar: () => Promise<M>,
  nome: K,
) {
  return lazy(() => importar().then((modulo) => ({ default: modulo[nome] })))
}

// --- Públicas / autenticação ---
export const LoginPage = sobDemanda(() => import('@/features/auth/login-page'), 'LoginPage')
export const ConfirmacaoPage = sobDemanda(
  () => import('@/features/confirmacao/confirmacao-page'),
  'ConfirmacaoPage',
)
export const PaginaPublicaPlataforma = sobDemanda(
  () => import('@/features/public/pagina-publica-plataforma'),
  'PaginaPublicaPlataforma',
)
export const NaoEncontradaPage = sobDemanda(
  () => import('@/features/error/nao-encontrada-page'),
  'NaoEncontradaPage',
)

// --- Clínica (tenant) ---
export const DashboardPage = sobDemanda(
  () => import('@/features/dashboard/dashboard-page'),
  'DashboardPage',
)
export const AgendaPage = sobDemanda(() => import('@/features/agenda/agenda-page'), 'AgendaPage')
export const PacientesPage = sobDemanda(
  () => import('@/features/pacientes/pacientes-page'),
  'PacientesPage',
)
export const PacienteDetalhePage = sobDemanda(
  () => import('@/features/pacientes/paciente-detalhe-page'),
  'PacienteDetalhePage',
)
export const GuiaPage = sobDemanda(() => import('@/features/pacientes/guia-page'), 'GuiaPage')
export const FichaPage = sobDemanda(() => import('@/features/pacientes/ficha-page'), 'FichaPage')
export const DentistasPage = sobDemanda(
  () => import('@/features/dentistas/dentistas-page'),
  'DentistasPage',
)
export const ConveniosPage = sobDemanda(
  () => import('@/features/convenios/convenios-page'),
  'ConveniosPage',
)
export const ProcedimentosPage = sobDemanda(
  () => import('@/features/procedimentos/procedimentos-page'),
  'ProcedimentosPage',
)
export const InsumosPage = sobDemanda(() => import('@/features/estoque/insumos-page'), 'InsumosPage')
export const CategoriasInsumoPage = sobDemanda(
  () => import('@/features/estoque/categorias-insumo-page'),
  'CategoriasInsumoPage',
)
export const MovimentacoesPage = sobDemanda(
  () => import('@/features/estoque/movimentacoes-page'),
  'MovimentacoesPage',
)
export const FornecedoresPage = sobDemanda(
  () => import('@/features/estoque/fornecedores-page'),
  'FornecedoresPage',
)
export const AlertasPage = sobDemanda(() => import('@/features/estoque/alertas-page'), 'AlertasPage')
export const InsumoDetalhePage = sobDemanda(
  () => import('@/features/estoque/insumo-detalhe-page'),
  'InsumoDetalhePage',
)
export const VisaoGeralPage = sobDemanda(
  () => import('@/features/financeiro/visao-geral-page'),
  'VisaoGeralPage',
)
export const ContasReceberPage = sobDemanda(
  () => import('@/features/financeiro/contas-receber-page'),
  'ContasReceberPage',
)
export const ContasPagarPage = sobDemanda(
  () => import('@/features/financeiro/contas-pagar-page'),
  'ContasPagarPage',
)
export const NotificacoesPage = sobDemanda(
  () => import('@/features/notificacoes/notificacoes-page'),
  'NotificacoesPage',
)
export const IntegracoesPage = sobDemanda(
  () => import('@/features/integracoes/integracoes-page'),
  'IntegracoesPage',
)
export const UsuariosPage = sobDemanda(
  () => import('@/features/usuarios/usuarios-page'),
  'UsuariosPage',
)
export const PermissoesPage = sobDemanda(
  () => import('@/features/usuarios/permissoes-page'),
  'PermissoesPage',
)
export const AuditoriaPage = sobDemanda(
  () => import('@/features/auditoria/auditoria-page'),
  'AuditoriaPage',
)
export const MeuPlanoPage = sobDemanda(() => import('@/features/plano/meu-plano-page'), 'MeuPlanoPage')
export const MinhaContaPage = sobDemanda(
  () => import('@/features/conta/minha-conta-page'),
  'MinhaContaPage',
)

// --- Vendor Admin (plataforma) ---
export const VendorLoginPage = sobDemanda(
  () => import('@/features/vendor-admin/vendor-login-page'),
  'VendorLoginPage',
)
export const VendorShell = sobDemanda(
  () => import('@/features/vendor-admin/vendor-shell'),
  'VendorShell',
)
export const VendorDashboardPage = sobDemanda(
  () => import('@/features/vendor-admin/vendor-dashboard-page'),
  'VendorDashboardPage',
)
export const TenantsPage = sobDemanda(
  () => import('@/features/vendor-admin/tenants/tenants-page'),
  'TenantsPage',
)
export const TenantDetalhesPage = sobDemanda(
  () => import('@/features/vendor-admin/tenants/tenant-detalhes-page'),
  'TenantDetalhesPage',
)
export const PlanosPage = sobDemanda(
  () => import('@/features/vendor-admin/planos/planos-page'),
  'PlanosPage',
)
export const AvisosPage = sobDemanda(
  () => import('@/features/vendor-admin/avisos/avisos-page'),
  'AvisosPage',
)
export const DatabaseStudioPage = sobDemanda(
  () => import('@/features/vendor-admin/studio/database-studio-page'),
  'DatabaseStudioPage',
)
export const CeleryMonitorPage = sobDemanda(
  () => import('@/features/vendor-admin/celery/celery-monitor-page'),
  'CeleryMonitorPage',
)
export const MasterAdminPage = sobDemanda(
  () => import('@/features/vendor-admin/master-admin/master-admin-page'),
  'MasterAdminPage',
)
export const ConfiguracoesLoginPage = sobDemanda(
  () => import('@/features/vendor-admin/config-login/configuracoes-login-page'),
  'ConfiguracoesLoginPage',
)
export const ConfiguracaoAvisoVencimentoPage = sobDemanda(
  () =>
    import('@/features/vendor-admin/aviso-vencimento/configuracao-aviso-vencimento-page'),
  'ConfiguracaoAvisoVencimentoPage',
)
export const Configuracao2FAPage = sobDemanda(
  () => import('@/features/vendor-admin/seguranca/configuracao-2fa-page'),
  'Configuracao2FAPage',
)
