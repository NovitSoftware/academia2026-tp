import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// En desarrollo, la API de la planta pasa por el mismo origen, como en el nginx del contenedor.
const SIM = process.env.VITE_SIM ?? 'http://localhost:8100';

export default defineConfig({
  server: {
    port: 5173,
    // En Docker sobre Windows los eventos de archivos no llegan: hace falta sondear.
    watch: process.env.VITE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '^/(api|media|grabaciones)/': SIM,
      '/ws': { target: SIM, ws: true },
      '/agente': { target: process.env.VITE_AGENTE ?? 'http://localhost:8200', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { visor: resolve(__dirname, 'index.html'), operador: resolve(__dirname, 'operador.html'), plano: resolve(__dirname, 'plano.html') },
    },
  },
});
