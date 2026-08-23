import { ArrowLeftRight, CalendarCheck, Check, MessageCircle } from 'lucide-react'

export function IntegracoesShowcase() {
  return (
    <section
      id="integracoes"
      aria-labelledby="integracoes-titulo"
      className="border-b border-[#1E2D56] bg-[#0B132B] scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">
            Integrações nativas
          </p>
          <h2
            id="integracoes-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl"
          >
            Conectado às ferramentas que você já usa
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Google Calendar */}
          <article className="rounded-2xl border border-[#1E2D56] bg-[#111D3B]/70 p-7 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#0B132B]">
                <CalendarCheck className="size-5 text-blue-400" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-slate-100">Google Calendar</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Sincronização <strong className="text-slate-100">bidirecional em tempo real</strong>:
              o que muda na clínica aparece no celular do dentista, e vice-versa.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-[#1E2D56] bg-[#0B132B]/70 p-4">
              <span className="text-sm font-semibold text-slate-200">PróClínica</span>
              <ArrowLeftRight className="size-5 text-blue-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-200">Google Agenda</span>
            </div>
            <ul className="mt-5 space-y-2">
              {['Cores espelhadas por dentista', 'Cancelou aqui, some lá', 'Sem retrabalho de digitação'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="size-4 text-emerald-400" aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </article>

          {/* WhatsApp WAHA */}
          <article className="rounded-2xl border border-[#1E2D56] bg-[#111D3B]/70 p-7 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-[#1E2D56] bg-[#0B132B]">
                <MessageCircle className="size-5 text-[#25D366]" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-slate-100">WhatsApp (WAHA)</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Mensageria com infraestrutura dedicada e{' '}
              <strong className="text-slate-100">sem taxa por disparo</strong>. Confirmações que o
              paciente realmente lê.
            </p>
            <div className="mt-5 space-y-2 rounded-xl border border-[#1E2D56] bg-[#0B132B]/70 p-4">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#25D366]/15 px-3 py-2 text-xs text-slate-200">
                Olá, Ana! Confirmando sua consulta amanhã às 09:00. Responda 1 para confirmar.
              </div>
              <div className="mr-auto max-w-[60%] rounded-2xl rounded-tl-sm bg-[#1E2D56]/60 px-3 py-2 text-xs text-slate-200">
                1 ✅
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {['Lembretes 24h e 2h antes', 'Confirmação com link seguro', 'Sem custos ocultos por mensagem'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="size-4 text-emerald-400" aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </article>
        </div>
      </div>
    </section>
  )
}
