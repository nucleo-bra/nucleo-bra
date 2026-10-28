"use client";
// Mapa interativo (Leaflet) com bolhas por cidade, bases da BRA e raios de atuação.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Lf from "leaflet";
import { BASES, CidadeMapa, Metrica, valorMetrica } from "@/lib/mapa";

export type Estilo = "claro" | "escuro" | "satelite";
const CAMADAS: Record<Estilo, { url: string; attr: string }> = {
  claro: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap · © CARTO" },
  escuro: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "© OpenStreetMap · © CARTO" },
  satelite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Imagens © Esri" },
};
/** Cor da bolha: do ciano ao laranja BRA conforme a intensidade. */
function cor(t: number) {
  // ciano (186°) → azul (213°) → roxo → laranja BRA (28°), pelo círculo de cores (sem tons barrentos)
  const h = t < 0.5 ? 186 + (213 - 186) * t * 2 : 213 + (388 - 213) * (t - 0.5) * 2;
  const sat = 72 + t * 18, luz = 50 - t * 4;
  return `hsl(${Math.round(h % 360)} ${Math.round(sat)}% ${Math.round(luz)}%)`;
}

export function MapaLeaflet({ cidades, metrica, estilo, aneis, rotulos, selecionada, onSelecionar, formatar, reajustar = 0 }: {
  cidades: CidadeMapa[]; metrica: Metrica; estilo: Estilo; aneis: boolean; rotulos: boolean; reajustar?: number;
  selecionada: string | null; onSelecionar: (k: string | null) => void; formatar: (v: number) => string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: typeof Lf; mapa: Lf.Map; fundo?: Lf.TileLayer; bolhas: Lf.LayerGroup; bases: Lf.LayerGroup; aneis: Lf.LayerGroup; ajustado: boolean } | null>(null);
  const cb = useRef(onSelecionar); cb.current = onSelecionar;

  // cria o mapa uma vez
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof Lf }).default ?? (mod as unknown as typeof Lf);
      if (!vivo || !caixa.current || ref.current) return;
      const mapa = L.map(caixa.current, { zoomControl: false, attributionControl: true, preferCanvas: false }).setView([-22.8, -47.1], 9);
      L.control.zoom({ position: "bottomright" }).addTo(mapa);
      mapa.on("click", () => cb.current(null));
      ref.current = { L, mapa, bolhas: L.layerGroup().addTo(mapa), bases: L.layerGroup().addTo(mapa), aneis: L.layerGroup().addTo(mapa), ajustado: false };
      // bases da BRA
      for (const b of BASES) {
        const icone = L.divIcon({
          className: "", iconSize: [34, 34], iconAnchor: [17, 34],
          html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${b.tipo === "sede" ? "linear-gradient(135deg,#f5821f,#d63a2f)" : "linear-gradient(135deg,#2f6fb5,#19295a)"};box-shadow:0 6px 16px rgba(14,26,61,.45);display:grid;place-items:center;border:2px solid #fff"><span style="transform:rotate(45deg);color:#fff;font:800 11px Sora,sans-serif">${b.tipo === "sede" ? "BRA" : "K+"}</span></div>`,
        });
        L.marker([b.la, b.lo], { icon: icone, zIndexOffset: 1000 }).bindTooltip(b.nome, { direction: "top", offset: [0, -30] }).addTo(ref.current.bases);
      }
      window.setTimeout(() => mapa.invalidateSize(), 50);
      desenhar();
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // camada de fundo
  useEffect(() => {
    const r = ref.current; if (!r) return;
    r.fundo?.remove();
    const c = CAMADAS[estilo];
    r.fundo = r.L.tileLayer(c.url, { attribution: c.attr, maxZoom: 18, subdomains: "abcd" }).addTo(r.mapa);
    r.fundo.bringToBack();
  });

  function desenhar() {
    const r = ref.current; if (!r) return;
    const { L } = r;
    r.bolhas.clearLayers(); r.aneis.clearLayers();
    if (aneis) for (const km of [25, 50, 100]) {
      L.circle([BASES[0].la, BASES[0].lo], { radius: km * 1000, color: "#f5821f", weight: 1.2, dashArray: "6 6", fill: false, interactive: false }).addTo(r.aneis);
      L.marker([BASES[0].la + km / 111, BASES[0].lo], { interactive: false, icon: L.divIcon({ className: "", iconSize: [60, 16], iconAnchor: [30, 8], html: `<div style="text-align:center;font:700 11px Manrope,sans-serif;color:#dc6c0e;text-shadow:0 0 3px #fff,0 0 3px #fff">${km} km</div>` }) }).addTo(r.aneis);
    }
    const vals = cidades.map((c) => valorMetrica(c, metrica));
    const max = Math.max(...vals, 1);
    [...cidades].sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica)).forEach((c) => {
      const v = valorMetrica(c, metrica);
      if (!v && metrica !== "clientes") return;
      const t = Math.sqrt(v / max);
      const sel = selecionada === c.chave;
      const m = L.circleMarker([c.la, c.lo], {
        radius: 7 + t * 30, color: sel ? "#0e1a3d" : "#ffffff", weight: sel ? 3 : 1.5, fillColor: cor(t), fillOpacity: sel ? 0.95 : 0.78,
      });
      m.bindTooltip(`<b>${c.cidade}/${c.uf}</b><br>${formatar(v)} · ${c.clientes.length} cliente(s)<br><span style="color:#66738f">${Math.round(c.distancia)} km da sede</span>`, { direction: "top", sticky: true });
      m.on("click", (e) => { L.DomEvent.stopPropagation(e); cb.current(c.chave); });
      m.addTo(r.bolhas);
      if (rotulos && (t > 0.2 || sel)) {
        L.marker([c.la, c.lo], { interactive: false, icon: L.divIcon({ className: "", iconSize: [140, 16], iconAnchor: [70, -(9 + t * 30)],
          html: `<div style="text-align:center;font:700 11.5px Manrope,sans-serif;color:${estilo === "claro" ? "#0e1a3d" : "#fff"};text-shadow:${estilo === "claro" ? "0 0 3px #fff,0 0 3px #fff,0 0 3px #fff" : "0 0 4px #000"}">${c.cidade}</div>` }) }).addTo(r.bolhas);
      }
    });
    if (!r.ajustado && cidades.length) {
      r.ajustado = true;
      const b = L.latLngBounds(cidades.map((c) => [c.la, c.lo] as [number, number]).concat(BASES.map((x) => [x.la, x.lo] as [number, number])));
      r.mapa.fitBounds(b.pad(0.15), { maxZoom: 11 });
    }
  }
  useEffect(desenhar);

  // "ver tudo"
  useEffect(() => {
    const r = ref.current; if (!r || !reajustar) return;
    r.ajustado = false; desenhar(); r.mapa.invalidateSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reajustar]);

  // centraliza na cidade escolhida
  useEffect(() => {
    const r = ref.current; if (!r || !selecionada) return;
    const c = cidades.find((x) => x.chave === selecionada);
    if (c) r.mapa.flyTo([c.la, c.lo], Math.max(r.mapa.getZoom(), 11), { duration: 0.8 });
  }, [selecionada, cidades]);

  return <div ref={caixa} className="h-full w-full" aria-label="Mapa de atendimento" />;
}

