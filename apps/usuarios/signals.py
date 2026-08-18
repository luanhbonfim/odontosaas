"""Sinais do app usuarios: mapeia o `papel` do usuário para o `Group` correspondente."""

from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.usuarios.models import Usuario


@receiver(post_save, sender=Usuario)
def mapear_papel_para_grupo(sender, instance, **kwargs):
    """Ao salvar o usuário, vincula-o ao grupo do seu papel (se já semeado)."""
    grupo = Group.objects.filter(name=instance.papel).first()
    if grupo is not None:
        instance.groups.set([grupo])
