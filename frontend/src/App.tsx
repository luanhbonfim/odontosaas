import { Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'sonner'

import { CarregandoPagina } from '@/components/common/carregando-pagina'
import { EmConstrucao } from '@/components/common/em-construcao'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth, RequireModulo, SomenteVisitante } from '@/features/auth/require-auth'
import { useAuth } from '@/features/auth/use-auth'
import { ClinicaNaoEncontradaPage } from '@/features/error/clinica-nao-encontrada-page'
import { queryClient } from '@/lib/api/query-client'
import { aplicarTema, useTema } from '@/stores/tema'
import {
  AgendaPage,
  AlertasPage,
  AuditoriaPage,
  AvisosPage,
  CategoriasInsumoPage,
  CeleryMonitorPage,
  Configuracao2FAPage,
  ConfiguracaoAvisoVencimentoPage,
  ConfiguracoesLoginPage,
  ConfirmacaoPage,
  ContasPagarPage,
  ContasReceberPage,
  ConveniosPage,
  DashboardPage,
  DatabaseStudioPage,
  DentistasPage,
  FichaPage,
  FornecedoresPage,
  GuiaPage,
  InsumoDetalhePage,
  InsumosPage,
  IntegracoesPage,
  LoginPage,
  MasterAdminPage,
  MeuPlanoPage,
  MinhaContaPage,
  MovimentacoesPage,
  NaoEncontradaPage,
  NotificacoesPage,
  PacienteDetalhePage,
  PacientesPage,
  PaginaPublicaPlataforma,
  PermissoesPage,
  PlanosPage,
  ProcedimentosPage,
  TenantDetalhesPage,
  TenantsPage,
  UsuariosPage,
  VendorDashboardPage,
  VendorLoginPage,
  VendorShell,
  VisaoGeralPage,
} from '@/routes/paginas'

import { VENDOR_BASE_PATH } from '@/features/vendor-admin/constants'
import {
  VendorRequireAuth,
  VendorRequireSuperAdmin,
  VendorSomenteVisitante,
} from '@/features/vendor-admin/vendor-require-auth'

import { Navigate } from 'react-router-dom'
import { useClinicaAtual } from '@/features/auth/use-clinica-atual'

function LoginRoute() {
  const { entrar } = useAuth()
  return <LoginPage aoEntrar={entrar} />
}

function RootRouter() {
  const { data: infoClinica, isLoading, isError } = useClinicaAtual()
  if (isLoading) return null

  // Host não resolve para clínica (404): página terminal, sem redirecionar (evita loop).
  if (isError) return <ClinicaNaoEncontradaPage />

  // No host público (sem tenant), exibe a página institucional/vendas
  if (infoClinica?.is_public) {
    return <PaginaPublicaPlataforma />
  }

  // No subdomínio de uma clínica: redireciona para o dashboard da clínica
  return <Navigate to="/dashboard" replace />
}

/** Ao expirar a sessão ou suspensão de tenant, limpa o cache e redireciona para o login contextual. */
function SessaoWatcher() {
  const navegar = useNavigate()
  useEffect(() => {
    const tratarSessaoExpirada = () => {
      // Se a navegação estiver no Vendor Admin, não interfere com o operador
      if (window.location.pathname.startsWith(VENDOR_BASE_PATH)) {
        return
      }
      queryClient.clear()
      toast.error('Sessão encerrada ou acesso suspenso. Faça login novamente.')
      navegar('/login', { replace: true })
    }

    const tratarVendorSessaoExpirada = () => {
      queryClient.clear()
      toast.error('Sessão do operador expirada. Faça login novamente.')
      navegar(`${VENDOR_BASE_PATH}/login`, { replace: true })
    }

    window.addEventListener('sessao-expirada', tratarSessaoExpirada)
    window.addEventListener('vendor-sessao-expirada', tratarVendorSessaoExpirada)

    return () => {
      window.removeEventListener('sessao-expirada', tratarSessaoExpirada)
      window.removeEventListener('vendor-sessao-expirada', tratarVendorSessaoExpirada)
    }
  }, [navegar])
  return null
}

export function App() {
  const tema = useTema((estado) => estado.tema)

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  return (
    <BrowserRouter>
      <SessaoWatcher />
      <Suspense fallback={<CarregandoPagina />}>
        <Routes>
          {/* Rota Raiz */}
          <Route path="/" element={<RootRouter />} />

          {/* Pública (paciente): confirmação de consulta por link do WhatsApp */}
          <Route path="/c/:token" element={<ConfirmacaoPage />} />

          {/* Pública, só para quem não está logado no subdomínio do Tenant */}
          <Route element={<SomenteVisitante />}>
            <Route path="/login" element={<LoginRoute />} />
          </Route>

          {/* Rotas do Vendor Admin (Plataforma Global) */}
          <Route element={<VendorSomenteVisitante />}>
            <Route path={`${VENDOR_BASE_PATH}/login`} element={<VendorLoginPage />} />
          </Route>

          <Route element={<VendorRequireAuth />}>
            <Route path={VENDOR_BASE_PATH} element={<VendorShell />}>
              <Route index element={<VendorDashboardPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:id" element={<TenantDetalhesPage />} />
              <Route path="planos" element={<PlanosPage />} />
              <Route path="avisos" element={<AvisosPage />} />
              <Route path="studio" element={<DatabaseStudioPage />} />
              <Route path="celery" element={<CeleryMonitorPage />} />
              <Route
                path="auditoria"
                element={<EmConstrucao titulo="Trilha de Auditoria do Vendor" />}
              />
              {/* 100% superadmin-only no backend (sem nenhuma ação staff) — guarda de rota aqui também. */}
              <Route element={<VendorRequireSuperAdmin />}>
                <Route path="admin-master" element={<MasterAdminPage />} />
                <Route path="configuracoes" element={<ConfiguracoesLoginPage />} />
                <Route path="aviso-vencimento" element={<ConfiguracaoAvisoVencimentoPage />} />
                <Route path="seguranca-2fa" element={<Configuracao2FAPage />} />
              </Route>
            </Route>
          </Route>

          {/* Protegidas do Tenant da Clínica: exigem sessão válida (guarda em cada navegação) */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="pacientes" element={<PacientesPage />} />
              <Route path="pacientes/novo" element={<PacienteDetalhePage />} />
              <Route path="pacientes/:pacienteId/guias/nova" element={<GuiaPage />} />
              <Route path="pacientes/:pacienteId/guias/:guiaId" element={<GuiaPage />} />
              <Route path="pacientes/:pacienteId/fichas/nova" element={<FichaPage />} />
              <Route path="pacientes/:pacienteId/fichas/:fichaId" element={<FichaPage />} />
              <Route path="pacientes/:id" element={<PacienteDetalhePage />} />
              <Route path="dentistas" element={<DentistasPage />} />
              <Route path="convenios" element={<ConveniosPage />} />
              <Route path="procedimentos" element={<ProcedimentosPage />} />
              {/* Módulos contratáveis/opcionais via plano */}
              <Route element={<RequireModulo modulo="estoque" />}>
                <Route path="estoque" element={<InsumosPage />} />
                <Route path="estoque/categorias" element={<CategoriasInsumoPage />} />
                <Route path="estoque/movimentacoes" element={<MovimentacoesPage />} />
                <Route path="estoque/fornecedores" element={<FornecedoresPage />} />
                <Route path="estoque/alertas" element={<AlertasPage />} />
                <Route path="estoque/:insumoId" element={<InsumoDetalhePage />} />
              </Route>

              <Route element={<RequireModulo modulo="financeiro" />}>
                <Route path="financeiro" element={<VisaoGeralPage />} />
                <Route path="financeiro/receber" element={<ContasReceberPage />} />
                <Route path="financeiro/pagar" element={<ContasPagarPage />} />
              </Route>

              <Route element={<RequireModulo modulo="whatsapp" />}>
                <Route path="notificacoes" element={<NotificacoesPage />} />
              </Route>

              <Route element={<RequireModulo modulo="google_calendar" />}>
                <Route path="integracoes" element={<IntegracoesPage />} />
              </Route>

              <Route path="equipe" element={<UsuariosPage />} />
              <Route path="permissoes" element={<PermissoesPage />} />
              <Route path="auditoria" element={<AuditoriaPage />} />
              <Route path="meu-plano" element={<MeuPlanoPage />} />
              <Route path="minha-conta" element={<MinhaContaPage />} />
            </Route>
          </Route>

          {/* 404 / Página não encontrada para qualquer rota inexistente */}
          <Route path="*" element={<NaoEncontradaPage />} />
        </Routes>
      </Suspense>
      <Toaster richColors closeButton theme={tema === 'escuro' ? 'dark' : 'light'} />
    </BrowserRouter>
  )
}

export default App
