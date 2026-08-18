import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'sonner'

import { EmConstrucao } from '@/components/common/em-construcao'
import { AppShell } from '@/components/layout/app-shell'
import { AgendaPage } from '@/features/agenda/agenda-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth, SomenteVisitante } from '@/features/auth/require-auth'
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

function LoginRoute() {
  const { entrar } = useAuth()
  return <LoginPage aoEntrar={entrar} />
}

/** Ao expirar a sessão (falha no refresh), limpa o cache e vai para o login. */
function SessaoWatcher() {
  const navegar = useNavigate()
  useEffect(() => {
    function aoExpirar() {
      queryClient.clear()
      toast.error('Sua sessão expirou. Faça login novamente.')
      navegar('/login', { replace: true })
    }
    window.addEventListener('sessao-expirada', aoExpirar)
    return () => window.removeEventListener('sessao-expirada', aoExpirar)
  }, [navegar])
  return null
}

function App() {
  const tema = useTema((s) => s.tema)

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  return (
    <BrowserRouter>
      <SessaoWatcher />
      <Routes>
        {/* Pública (paciente): confirmação de consulta por link do WhatsApp */}
        <Route path="/c/:token" element={<ConfirmacaoPage />} />
        {/* Pública, só para quem não está logado */}
        <Route element={<SomenteVisitante />}>
          <Route path="/login" element={<LoginRoute />} />
        </Route>
        {/* Protegidas: exigem sessão válida (guarda em cada navegação) */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
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
            <Route path="estoque" element={<EmConstrucao titulo="Estoque" />} />
            <Route path="financeiro" element={<EmConstrucao titulo="Financeiro" />} />
            <Route path="notificacoes" element={<NotificacoesPage />} />
            <Route path="integracoes" element={<IntegracoesPage />} />
            <Route path="equipe" element={<UsuariosPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors closeButton theme={tema === 'escuro' ? 'dark' : 'light'} />
    </BrowserRouter>
  )
}

export default App
