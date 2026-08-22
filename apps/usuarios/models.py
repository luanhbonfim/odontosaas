"""
Model de usuário (schema de cada tenant).

`Usuario` é a conta de acesso da equipe da clínica — login por e-mail e um
`papel` que define a função dentro da clínica. Como os usuários são
por-tenant, este app fica em TENANT_APPS.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    """Manager que usa o e-mail como identificador (sem username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superusuário precisa de is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superusuário precisa de is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class Usuario(AbstractUser):
    """Usuário da clínica — login por e-mail, com papel funcional."""

    class Papel(models.TextChoices):
        ADMIN = "ADMIN", "Administrador(a)"
        DENTISTA_GERENTE = "DENTISTA_GERENTE", "Dentista Gerente"
        DENTISTA = "DENTISTA", "Dentista"
        RECEPCAO = "RECEPCAO", "Recepção"

    # Removemos o username; o login é feito pelo e-mail.
    username = None
    email = models.EmailField("e-mail", unique=True)
    nome_completo = models.CharField(max_length=255, blank=True)
    papel = models.CharField(max_length=20, choices=Papel.choices, default=Papel.RECEPCAO)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # e-mail e senha já são solicitados por padrão

    objects = UsuarioManager()

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"

    def __str__(self):
        return self.nome_completo or self.email


class UsuarioMFA(models.Model):
    """
    Segredo TOTP (2FA) de um usuário da clínica (por-tenant).

    Opt-in: existe apenas para quem ativou o 2FA. Enquanto houver registro, o login
    daquele usuário passa a exigir o código de 6 dígitos. Gerenciado pela tela
    "Minha conta" (self-service).
    """

    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="mfa", verbose_name="usuário"
    )
    secret = models.CharField(max_length=64, help_text="Segredo TOTP (base32)")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "2FA de usuário"
        verbose_name_plural = "2FA de usuários"

    def __str__(self):
        return f"2FA: {self.usuario.email}"
