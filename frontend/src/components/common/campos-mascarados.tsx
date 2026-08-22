/* eslint-disable react-refresh/only-export-components -- kit de inputs criados por fábrica */
/**
 * Inputs com máscara de digitação, prontos para o form-kit / react-hook-form.
 *
 * São controlados: recebem `value` e emitem via `onChange` SEMPRE os dígitos crus
 * (sem máscara), enquanto exibem o texto formatado. Assim o formulário guarda um
 * valor limpo para a API e o usuário vê a máscara. Todos limitam a quantidade de
 * dígitos ao padrão do documento — não deixam digitar além.
 *
 * Uso com react-hook-form:
 *   <Controller name="cpf" control={control}
 *     render={({ field }) => <InputCpf value={field.value} onChange={field.onChange} />} />
 */
import { forwardRef } from 'react'

import { Input } from '@/components/ui/input'
import {
  mascararCep,
  mascararCnpj,
  mascararCpf,
  mascararInteiro,
  mascararTelefone,
  soDigitos,
} from '@/lib/utils/mascaras'

type BaseProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value?: string
  onChange?: (digitos: string) => void
}

function criarInputMascarado(
  mascarar: (v: string) => string,
  maxDigitos: number,
  inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'],
) {
  return forwardRef<HTMLInputElement, BaseProps>(function InputMascarado(
    { value, onChange, ...rest },
    ref,
  ) {
    return (
      <Input
        ref={ref}
        inputMode={inputMode}
        autoComplete="off"
        value={mascarar(value ?? '')}
        onChange={(e) => onChange?.(soDigitos(e.target.value).slice(0, maxDigitos))}
        {...rest}
      />
    )
  })
}

export const InputCpf = criarInputMascarado(mascararCpf, 11, 'numeric')
export const InputCnpj = criarInputMascarado(mascararCnpj, 14, 'numeric')
export const InputTelefone = criarInputMascarado(mascararTelefone, 11, 'tel')
export const InputCep = criarInputMascarado(mascararCep, 8, 'numeric')

/** Inteiro (só dígitos) com limite configurável de casas. */
export const InputInteiro = forwardRef<HTMLInputElement, BaseProps & { maxDigitos?: number }>(
  function InputInteiro({ value, onChange, maxDigitos, ...rest }, ref) {
    return (
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        value={mascararInteiro(value ?? '', maxDigitos)}
        onChange={(e) => onChange?.(mascararInteiro(e.target.value, maxDigitos))}
        {...rest}
      />
    )
  },
)
