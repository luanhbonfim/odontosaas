export function PaginaPublicaPlataforma() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#070B18] px-4 text-center text-slate-400">
      <div className="max-w-lg space-y-5">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-slate-800 bg-[#0B132B] shadow-2xl p-3">
          <img src="/logo.png" alt="PróClínica" className="h-full w-auto object-contain" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
            PróClínica Cloud
          </h1>
          <p className="text-sm font-medium text-[#D4AF37]">
            SaaS de Gestão Inteligente para Clínicas e Consultórios Odontológicos
          </p>
        </div>

        <p className="text-xs leading-relaxed text-slate-400 max-w-md mx-auto">
          Plataforma de alta performance para agendamento inteligente, prontuário eletrônico, controle financeiro e sincronização em tempo real.
        </p>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-2 text-left shadow-lg">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <span className="flex size-2 rounded-full bg-[#D4AF37] animate-pulse" />
            Acesso aos Consultórios
          </div>
          <p className="text-slate-400 leading-relaxed">
            O acesso ao painel de cada clínica é realizado exclusivamente através do subdomínio próprio de cada assinante (ex: <code className="font-mono text-[#D4AF37] bg-black/40 px-1.5 py-0.5 rounded">sua-clinica.proclinica.cloud</code>).
          </p>
        </div>
      </div>
    </div>
  )
}
