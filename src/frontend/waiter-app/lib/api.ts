import axios from 'axios';

// Si la página es HTTPS (ej. celular) usamos API en 5042; si no, 5041
function getApiBaseUrl(): string {
  return '';
}

const API_URL = getApiBaseUrl();

// El baseURL NO debe incluir /api porque las rutas en page.tsx ya lo incluyen
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});
