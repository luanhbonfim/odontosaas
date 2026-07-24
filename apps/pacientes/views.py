"""Views (API REST) do app pacientes."""

from rest_framework import viewsets

from .models import Guia, Paciente, PlanoOdontologico
from .serializers import GuiaSerializer, PacienteSerializer, PlanoOdontologicoSerializer


class PacienteViewSet(viewsets.ModelViewSet):
    """CRUD de pacientes (opera no schema do tenant da requisição)."""

    queryset = Paciente.objects.all()
    serializer_class = PacienteSerializer


class PlanoOdontologicoViewSet(viewsets.ModelViewSet):
    """CRUD dos planos odontológicos dos pacientes."""

    queryset = PlanoOdontologico.objects.all()
    serializer_class = PlanoOdontologicoSerializer


class GuiaViewSet(viewsets.ModelViewSet):
    """CRUD das guias de procedimento."""

    queryset = Guia.objects.all()
    serializer_class = GuiaSerializer
