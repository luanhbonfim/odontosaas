"""
Teste de carga básico (Locust) do OdontoSaaS.

Requer o stack no ar e o pacote `locust` (já em requirements/dev.txt).

Uso interativo (abre a UI em http://localhost:8089):
    locust -f tests/load/locustfile.py --host http://demo.localhost:8000

Uso headless (100 usuários, 10/s, por 30s):
    locust -f tests/load/locustfile.py --host http://demo.localhost:8000 \
        --users 100 --spawn-rate 10 --run-time 30s --headless
"""

from locust import HttpUser, between, task


class UsuarioOdonto(HttpUser):
    """Simula um usuário exercitando endpoints leves de leitura."""

    wait_time = between(1, 3)

    @task(3)
    def health(self):
        self.client.get("/health/")

    @task(1)
    def readiness(self):
        self.client.get("/health/ready/")

    @task(2)
    def listar_insumos(self):
        self.client.get("/api/insumos/")

    @task(1)
    def schema(self):
        self.client.get("/api/schema/")
