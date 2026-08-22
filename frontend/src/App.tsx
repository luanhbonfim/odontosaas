import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'sonner'

import { EmConstrucao } from '@/components/common/em-construcao'
import { AppShell } from '@/components/layout/app-shell'
import { AgendaPage } from '@/features/agenda/agenda-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth, RequireModulo, SomenteVisitante } from '@/features/auth/require-auth'
import { ConfirmacaoPage } from '@/features/confirmacao/confirmacao-page'
import { useAuth } from '@/features/auth/use-auth'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ConveniosPage } from '@/features/convenios/convenios-page'
import { ProcedimentosPage } from '@/features/procedimentos/procedimentos-page'
import { DentistasPage } from '@/features/dentistas/dentistas-page'
import { IntegracoesPage } from '@/features/integracoes/integracoes-page'
import { NotificacoesPage } from '@/features/notificacoes/notificacoes-page'
import { ConsultaPage } from '@/features/pacientes/consulta-page'
import { GuiaPage } from '@/features/pacientes/guia-page'
import { PacienteDetalhePage } from '@/features/pacientes/paciente-detalhe-page'
import { PacientesPage } from '@/features/pacientes/pacientes-page'
import { UsuariosPage } from '@/features/usuarios/usuarios-page'
import { queryClient } from '@/lib/api/query-client'
import { aplicarTema, useTema } from '@/stores/tema'

import { MeuPlanoPage } from '@/features/plano/meu-plano-page'
import { MinhaContaPage } from '@/features/conta/minha-conta-page'
import { VENDOR_BASE_PATH } from '@/features/vendor-admin/constants'
import { VendorDashboardPage } from '@/features/vendor-admin/vendor-dashboard-page'
import { VendorLoginPage } from '@/features/vendor-admin/vendor-login-page'
import { VendorRequireAuth, VendorSomenteVisitante } from '@/features/vendor-admin/vendor-require-auth'
import { VendorShell } from '@/features/vendor-admin/vendor-shell'
import { PlanosPage } from '@/features/vendor-admin/planos/planos-page'
import { TenantsPage } from '@/features/vendor-admin/tenants/tenants-page'
import { TenantDetalhesPage } from '@/features/vendor-admin/tenants/tenant-detalhes-page'
import { MasterAdminPage } from '@/features/vendor-admin/master-admin/master-admin-page'
import { ConfiguracoesLoginPage } from '@/features/vendor-admin/config-login/configuracoes-login-page'
import { Configuracao2FAPage } from '@/features/vendor-admin/seguranca/configuracao-2fa-page'
import { DatabaseStudioPage } from '@/features/vendor-admin/studio/database-studio-page'
import { CeleryMonitorPage } from '@/features/vendor-admin/celery/celery-monitor-page'

import { Navigate } from 'react-router-dom'
import { PaginaPublicaPlataforma } from '@/features/public/pagina-publica-plataforma'
import { ClinicaNaoEncontradaPage } from '@/features/error/clinica-nao-encontrada-page'
import { useClinicaAtual } from '@/features/auth/use-clinica-atual'
import { NaoEncontradaPage } from '@/features/error/nao-encontrada-page'

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
            <Route path="admin-master" element={<MasterAdminPage />} />
            <Route path="studio" element={<DatabaseStudioPage />} />
            <Route path="celery" element={<CeleryMonitorPage />} />
            <Route path="auditoria" element={<EmConstrucao titulo="Trilha de Auditoria do Vendor" />} />
            <Route path="configuracoes" element={<ConfiguracoesLoginPage />} />
            <Route path="seguranca-2fa" element={<Configuracao2FAPage />} />
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
            <Route path="pacientes/:pacienteId/consultas/:consultaId" element={<ConsultaPage />} />
            <Route path="pacientes/:id" element={<PacienteDetalhePage />} />
            <Route path="dentistas" element={<DentistasPage />} />
            <Route path="convenios" element={<ConveniosPage />} />
            <Route path="procedimentos" element={<ProcedimentosPage />} />
            {/* Módulos contratáveis/opcionais via plano */}
            <Route element={<RequireModulo modulo="estoque" />}>
              <Route path="estoque" element={<EmConstrucao titulo="Estoque" />} />
            </Route>

            <Route element={<RequireModulo modulo="financeiro" />}>
              <Route path="financeiro" element={<EmConstrucao titulo="Financeiro — Visão Geral" />} />
              <Route path="financeiro/receber" element={<EmConstrucao titulo="Contas a Receber" />} />
              <Route path="financeiro/pagar" element={<EmConstrucao titulo="Contas a Pagar" />} />
            </Route>

            <Route element={<RequireModulo modulo="whatsapp" />}>
              <Route path="notificacoes" element={<NotificacoesPage />} />
            </Route>

            <Route element={<RequireModulo modulo="google_calendar" />}>
              <Route path="integracoes" element={<IntegracoesPage />} />
            </Route>

            <Route path="equipe" element={<UsuariosPage />} />
            <Route path="meu-plano" element={<MeuPlanoPage />} />
            <Route path="minha-conta" element={<MinhaContaPage />} />
          </Route>
        </Route>

        {/* 404 / Página não encontrada para qualquer rota inexistente */}
        <Route path="*" element={<NaoEncontradaPage />} />
      </Routes>
      <Toaster richColors closeButton theme={tema === 'escuro' ? 'dark' : 'light'} />
    </BrowserRouter>
  )
}

export default App
