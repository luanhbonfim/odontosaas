import { ChevronDown } from 'lucide-react'

type ItemFaq = { pergunta: string; resposta: string }

const FAQ: ItemFaq[] = [
  {
    pergunta: 'Como funciona a sincronização com o Google Calendar?',
    resposta:
      'A integração é bidirecional e em tempo real: consultas criadas ou alteradas no PróClínica aparecem na agenda do Google do dentista (e vice-versa), com cores espelhadas por profissional. Ao cancelar ou excluir uma consulta, o evento também é removido do Google.',
  },
  {
    pergunta: 'Preciso pagar taxa extra pelos envios de WhatsApp?',
    resposta:
      'Não. Os lembretes e confirmações usam infraestrutura dedicada (WAHA) já inclusa no plano. Não há cobrança por mensagem enviada, diferente dos sistemas que cobram por SMS.',
  },
  {
    pergunta: 'Como é garantida a segurança e privacidade dos prontuários (LGPD)?',
    resposta:
      'Cada clínica possui seu próprio banco de dados isolado (schema PostgreSQL dedicado), com criptografia HTTPS/TLS, trilha de auditoria e backups automáticos diários. Os dados de uma clínica nunca se misturam com os de outra.',
  },
  {
    pergunta: 'Posso migrar os dados do meu software atual?',
    resposta:
      'Sim. Nossa equipe realiza a importação assistida dos seus pacientes e histórico, sem custo adicional, para que você comece a usar em poucos minutos.',
  },
  {
    pergunta: 'Existe fidelidade ou taxa de cancelamento?',
    resposta:
      'Nos planos mensais você tem liberdade total: pode cancelar a qualquer momento, sem multas ou taxas de fidelidade. Nos planos anuais você garante o desconto ao longo do ano.',
  },
  {
    pergunta: 'Como funciona o período de teste gratuito?',
    resposta:
      'Você pode experimentar a plataforma com todos os recursos do plano escolhido durante o período de trial. Fale com um consultor pelo WhatsApp para ativar o seu acesso de teste.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-titulo" className="border-b border-[#1E2D56] bg-[#0B132B] scroll-mt-20">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37]">
            Perguntas frequentes
          </p>
          <h2
            id="faq-titulo"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl"
          >
            Ainda com dúvidas?
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.pergunta}
              className="group rounded-xl border border-[#1E2D56] bg-[#111D3B]/70 backdrop-blur-md transition-colors open:border-[#D4AF37]/40 [&_summary]:list-none"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]">
                {item.pergunta}
                <ChevronDown
                  className="size-5 shrink-0 text-[#D4AF37] transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-slate-300">{item.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
