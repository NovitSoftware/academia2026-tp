"""Contrato de integración entre la planta simulada y el sistema de cada cursante.

La planta publica por MQTT (broker `broker:1883` en la red `planta-lan`) y el sistema
del cursante responde publicando en los tópicos `sistema/...`. Todos los mensajes son JSON
y validan contra estos modelos.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

VERSION = "0.2.0"


class Topicos:
    # Planta -> sistema
    SENSORES = "planta/sensores/{tag}/{variable}"   # LecturaSensor, una por muestra
    RECORRIDAS = "planta/recorridas"                 # NotaRecorrida, cuando el operador graba una nota
    CIERRES = "planta/cierres"                       # NotaCierre, cuando un técnico cierra una orden
    ENERGIA = "planta/energia"                       # EstadoEnergia, retenido
    RESPUESTAS = "planta/respuestas"                 # RespuestaOperador, cuando el operador contesta en la tablet
    # Sistema -> planta
    EVENTOS = "sistema/eventos"                      # EventoSistema
    ORDENES = "sistema/ordenes"                      # OrdenSistema, cada cambio de estado
    ESTADO = "sistema/estado"                        # EstadoSistema, latido cada 30 s
    TABLET = "sistema/tablet"                        # MensajeTablet, lo que el sistema le muestra y le dice al operador


class _Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- planta -> sistema

class Calidad(str, Enum):
    buena = "buena"
    sin_dato = "sin_dato"      # equipo parado o instrumento fuera de servicio


class LecturaSensor(_Modelo):
    tag: str = Field(examples=["B-102"])
    variable: str = Field(examples=["presion_descarga"])
    valor: float | None
    unidad: str = Field(examples=["kg/cm2"])
    ts: datetime
    calidad: Calidad = Calidad.buena


class NotaRecorrida(_Modelo):
    id: str
    ts: datetime
    operador: str
    audio_url: str | None = Field(description="WAV 16 kHz mono servido por la planta")
    fotos: list[str] = Field(default_factory=list, description="URLs de fotos tomadas en esta nota")
    recorrida_id: str = Field(description="Una recorrida puede tener varias notas")


class NotaCierre(_Modelo):
    id: str
    ts: datetime
    orden_id: str
    tecnico: str
    empresa: str = Field(description="'propio' o el nombre de la contratista")
    audio_url: str | None
    fotos: list[str] = Field(default_factory=list)


class EstadoEnergia(_Modelo):
    ts: datetime
    hay_energia: bool


class RespuestaOperador(_Modelo):
    """Lo que el operador contesta, en voz y en texto libre, como habla en campo. No viene estructurado:
    entenderlo es parte del trabajo del sistema."""
    id: str
    ts: datetime
    mensaje_id: str = Field(description="El MensajeTablet al que contesta")
    operador: str
    texto: str
    audio_url: str | None = Field(description="WAV 16 kHz mono servido por la planta")


# --------------------------------------------------------------------------- sistema -> planta

class TipoEvento(str, Enum):
    sin_novedad = "SinNovedad"
    escalado = "Escalado"
    alerta_seguridad = "AlertaSeguridad"


class EventoSistema(_Modelo):
    id: str = Field(description="Idempotente: el mismo id publicado dos veces es el mismo evento")
    ts: datetime
    tipo: TipoEvento
    equipo: str | None = None
    origen: Literal["parte", "sensor"]
    parte_id: str | None = None
    nota_ids: list[str] = Field(default_factory=list, description="Notas de recorrida que lo originaron")
    resumen: str


class EstadoOrden(str, Enum):
    borrador = "Borrador"
    pendiente = "PendienteAprobacion"
    aprobada = "Aprobada"
    rechazada = "Rechazada"
    ejecutada = "Ejecutada"
    observada = "Observada"
    cerrada = "Cerrada"
    certificada = "Certificada"


class Repuesto(_Modelo):
    codigo: str
    cantidad: float


class OrdenSistema(_Modelo):
    id: str = Field(description="Idempotente: cada publicación es el estado actual de la orden")
    ts: datetime
    estado: EstadoOrden
    equipo: str
    evento_ids: list[str] = Field(default_factory=list)
    tareas: list[str] = Field(description="Códigos del catálogo de tareas estándar o 'NO-ESTANDAR'")
    detiene_equipo: bool
    reduce_inyeccion: bool
    ejecutor: str = Field(description="'propio' o el nombre de la contratista")
    repuestos: list[Repuesto] = Field(default_factory=list)
    motivo: str | None = Field(default=None, description="Motivo de pendiente, rechazo u observación")
    habilita: str | None = None
    monto_habilita_usd: float | None = None


class FilaParte(_Modelo):
    tag: str = Field(examples=["B-102"])
    variable: str = Field(examples=["presion_descarga_local"])
    valor: float | None = None
    unidad: str | None = Field(default=None, examples=["psi"])
    observacion: str | None = None


class Pantalla(_Modelo):
    """Lo que se ve en la tablet. El sistema decide qué mostrar; la planta solo lo dibuja."""
    titulo: str | None = None
    filas: list[FilaParte] = Field(default_factory=list, description="El parte como lo entendió el sistema")
    opciones: list[str] = Field(default_factory=list, description="Opciones que se le ofrecen al operador")


class MensajeTablet(_Modelo):
    """Lo que el sistema le dice al operador en la tablet: un borrador para confirmar, una pregunta, un aviso.
    La tablet es un terminal: muestra la pantalla y reproduce el audio que manda el sistema. Si no viene
    audio, la planta lee el texto con una voz sintética genérica."""
    id: str = Field(description="Idempotente")
    ts: datetime
    nota_ids: list[str] = Field(default_factory=list, description="Notas de recorrida a las que se refiere")
    texto: str = Field(description="Lo que el sistema le dice al operador")
    pantalla: Pantalla | None = None
    audio_url: str | None = Field(default=None, description="Audio del sistema, accesible desde planta-lan (http)")
    espera_respuesta: bool = Field(default=True, description="False para avisos que no hay que contestar")


class EstadoSistema(_Modelo):
    ts: datetime
    sistema: str = Field(description="Nombre del cursante")
    enlace_ok: bool
    pendientes_sincronizar: int
