/**
 * Constantes e caminhos base do painel Vendor Admin.
 * O caminho secreto pode ser customizado via variável de ambiente `VITE_VENDOR_ADMIN_SECRET_PATH`.
 */
export const VENDOR_BASE_PATH =
  (import.meta.env.VITE_VENDOR_ADMIN_SECRET_PATH as string) || '/plataforma-admin'
