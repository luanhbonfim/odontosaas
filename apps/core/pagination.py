"""Paginação padrão da API.

Opt-in **por view** (não global) para não alterar as listas que hoje devolvem
array puro (Dentistas, Usuários, Especialidades). Views de listas grandes
(Pacientes, Agenda, Financeiro, Estoque) definem `pagination_class` explicitamente.
"""

from rest_framework.pagination import PageNumberPagination


class PaginacaoPadrao(PageNumberPagination):
    """Paginação por número de página.

    Query params: `?page=` e `?page_size=` (padrão 20, máximo 100).
    Resposta: `{count, next, previous, results}`.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
