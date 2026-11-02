"""La telemetría se valida sin interferir con los eventos y no se vuelve a sumar al reconectar."""
from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from planta_sim.metricas import ConsumoTokens
from planta_sim.escenarios import Escenario
from planta_sim.simulador import Simulador


def consumo():
    return {
        "ts": datetime.now(timezone.utc).isoformat(), "sistema": "prueba",
        "tokens_entrada": 100, "tokens_salida": 20, "tokens_total": 120, "tokens_por_segundo": 10,
        "modelos": [{"modelo": "modelo-a", "tokens_entrada": 100, "tokens_salida": 20,
                     "tokens_total": 120, "tokens_por_segundo": 10}],
    }


def test_rechaza_desglose_inconsistente():
    datos = consumo()
    datos["tokens_total"] = 121
    with pytest.raises(ValidationError):
        ConsumoTokens.model_validate(datos)
    datos = consumo()
    datos["modelos"][0]["tokens_entrada"] = -1
    with pytest.raises(ValidationError):
        ConsumoTokens.model_validate(datos)


def test_reconexion_no_duplica_ni_altera_el_reloj():
    datos = consumo()
    ConsumoTokens.model_validate(datos)
    sim = Simulador.__new__(Simulador)
    sim._ultimo_mensaje = 123.0
    sim.registro_sistema = []
    sim.recibir_metricas(datos)
    sim.recibir_metricas(datos)
    assert sim.consumo_tokens["tokens_total"] == 120
    assert sim._ultimo_mensaje == 123.0
    assert not sim.registro_sistema


def test_instantanea_conserva_consumo_al_cambiar_escenario(tmp_path):
    datos = Path(__file__).resolve().parents[1] / "datos"
    sim = Simulador(yaml.safe_load((datos / "planta.yaml").read_text()),
                    yaml.safe_load((datos / "materiales.yaml").read_text()), tmp_path,
                    publicar=lambda *args: None, enlace=lambda *args: None)
    sim.iniciar(Escenario(nombre="primero", precalentamiento_dias=0))
    sim.recibir_metricas(consumo())
    assert sim.instantanea()["sistema"]["consumo_tokens"]["tokens_total"] == 120
    sim.iniciar(Escenario(nombre="segundo", precalentamiento_dias=0))
    assert sim.instantanea()["sistema"]["consumo_tokens"]["tokens_total"] == 120
