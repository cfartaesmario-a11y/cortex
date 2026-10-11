// Iconos detallados de las apps (48×48). Trazo blanco con capas de distinta intensidad.
const S = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const dim = (b, o = 0.45) => `<g opacity="${o}">${b}</g>`;
const fill = (b, o = 1) => `<g fill="currentColor" stroke="none" opacity="${o}">${b}</g>`;

export const APP_ICONS = {
  // llave con pistas de circuito
  claves: S(`
    <circle cx="17" cy="20" r="8.5"/>
    <circle cx="17" cy="20" r="3.4"/>
    ${fill('<circle cx="17" cy="20" r="1.3"/>')}
    <path d="M23.2 25.8L36.5 39"/>
    <path d="M31.4 33.9l3.4-3.4M34.6 37.1l2.6-2.6"/>
    ${dim('<path d="M8.5 20H5M17 11.5V7M10.7 13.7L8 11M28 8h8l3 3v6M39 17h-4"/>')}
    ${fill('<circle cx="36" cy="8" r="1.2"/><circle cx="35" cy="17" r="1.2"/><circle cx="5" cy="20" r="1.1"/>', 0.55)}`),
  // dos tarjetas con chip
  tarjetas: S(`
    ${dim('<rect x="10" y="9" width="30" height="19" rx="3.2"/>', 0.4)}
    <rect x="6" y="16" width="32" height="21" rx="3.4"/>
    <rect x="10.5" y="21.5" width="7" height="5.5" rx="1.2"/>
    ${dim('<path d="M14 21.5v5.5M10.5 24.2h7"/>', 0.6)}
    <path d="M10.5 32h6M19.5 32h4"/>
    ${dim('<path d="M30 21.5c1.5 1.4 1.5 3.6 0 5M33 20c2.4 2.3 2.4 6.2 0 8.5"/>', 0.6)}`),
  // ficha con retrato y marco de escaneo
  identidad: S(`
    <rect x="7" y="11" width="34" height="26" rx="3.2"/>
    <circle cx="17.5" cy="21.5" r="3.6"/>
    <path d="M11.5 31.5c1.2-3.2 3.4-4.8 6-4.8s4.8 1.6 6 4.8"/>
    <path d="M27 19h9M27 23.5h9"/>
    ${dim('<path d="M27 28h6"/>')}
    ${dim('<path d="M3.5 8.5V5h3.5M44.5 8.5V5H41M3.5 39.5V43h3.5M44.5 39.5V43H41"/>', 0.55)}`),
  // carpetas apiladas con indicador de disco
  drive: S(`
    ${dim('<path d="M10 12.5h9l2.6 2.6H38a2.5 2.5 0 0 1 2.5 2.5"/>', 0.45)}
    <path d="M6 17.5A2.5 2.5 0 0 1 8.5 15h9.2l2.8 2.8h17A2.5 2.5 0 0 1 40 20.3V35a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 6 35z"/>
    <path d="M6 23.5h34"/>
    ${dim('<path d="M11 31h10M11 34h6"/>', 0.55)}
    ${fill('<circle cx="34.5" cy="31.5" r="1.6"/>')}
    ${dim('<circle cx="34.5" cy="31.5" r="3.4"/>', 0.4)}`),
  // escudo con código de 6 cifras y reloj
  autenticador: S(`
    <path d="M24 5l14 5v10.5c0 9.2-6 16.8-14 19.5-8-2.7-14-10.3-14-19.5V10z"/>
    ${dim('<path d="M24 9.5l10 3.6v7.6c0 6.9-4.3 12.6-10 14.8"/>', 0.35)}
    ${fill('<circle cx="17" cy="21" r="1.5"/><circle cx="21.7" cy="21" r="1.5"/><circle cx="26.3" cy="21" r="1.5"/><circle cx="31" cy="21" r="1.5"/>')}
    <path d="M17 27h14"/>
    ${dim('<circle cx="38" cy="38" r="6.2"/><path d="M38 34.8V38l2.2 1.4"/>', 0.8)}`),
  // libreta con anillas
  notas: S(`
    <rect x="11" y="8" width="26" height="33" rx="3"/>
    ${dim('<path d="M16 5v6M22 5v6M28 5v6M34 5v6"/>', 0.7)}
    <path d="M17 18h14M17 23h14M17 28h9"/>
    ${dim('<path d="M17 33h6"/>')}
    <path d="M35 36l5.5-5.5 2.5 2.5L37.5 38.5 34.5 39z"/>`),
  // dos personas
  contactos: S(`
    ${dim('<circle cx="31.5" cy="16" r="5"/><path d="M30 26.5c5.6-.6 9.5 2.4 11 7.5"/>', 0.45)}
    <circle cx="19" cy="18" r="6"/>
    <path d="M7 38c1.6-6.4 6.2-9.8 12-9.8s10.4 3.4 12 9.8"/>
    ${fill('<circle cx="40" cy="8" r="1.4"/>', 0.6)}
    ${dim('<path d="M40 8l-4 4"/>', 0.4)}`),
  // dado hexagonal con chispa
  generador: S(`
    <path d="M24 5l15.5 9v18L24 41 8.5 32V14z"/>
    ${dim('<path d="M8.5 14L24 23l15.5-9M24 23v18"/>', 0.45)}
    ${fill('<circle cx="24" cy="14" r="1.6"/><circle cx="15.5" cy="25" r="1.5"/><circle cx="17.5" cy="31.5" r="1.5"/><circle cx="31.5" cy="27.5" r="1.5"/>')}
    <path d="M41 39.5v5M38.5 42h5"/>`),
  // ventana de terminal con prompt
  terminal: S(`
    <rect x="5" y="9" width="38" height="30" rx="3.5"/>
    <path d="M5 15.5h38"/>
    ${fill('<circle cx="9.5" cy="12.3" r="1.1"/><circle cx="13.3" cy="12.3" r="1.1"/><circle cx="17.1" cy="12.3" r="1.1"/>', 0.6)}
    <path d="M11.5 22l5 4.5-5 4.5"/>
    <path d="M20 32h10"/>
    ${dim('<path d="M33 22.5h5M33 26.5h3"/>', 0.4)}`),
  // pulso dentro de un círculo
  registro: S(`
    <circle cx="24" cy="24" r="17.5"/>
    ${dim('<circle cx="24" cy="24" r="12.5"/>', 0.25)}
    <path d="M9 25h7l3-7 5 14 4-10 2.5 3H39"/>
    ${fill('<circle cx="39" cy="25" r="1.5"/>')}`),
  // papelera con flechas de restaurar
  papelera: S(`
    <path d="M9.5 13h29M19 13V9.5h10V13"/>
    <path d="M12.5 13l1.8 24.2a3 3 0 0 0 3 2.8h13.4a3 3 0 0 0 3-2.8L35.5 13"/>
    ${dim('<path d="M20 19.5v14M28 19.5v14M24 19.5v14"/>', 0.5)}`),
  // engranaje con detalle
  ajustes: S(`
    <path d="M24 6.5l3 .4.9 4.1 2.9 1.2 3.5-2.3 2.3 1.9 1.9 2.3-2.3 3.5 1.2 2.9 4.1.9.4 3-.4 3-4.1.9-1.2 2.9 2.3 3.5-1.9 2.3-2.3 1.9-3.5-2.3-2.9 1.2-.9 4.1-3 .4-3-.4-.9-4.1-2.9-1.2-3.5 2.3-2.3-1.9-1.9-2.3 2.3-3.5-1.2-2.9-4.1-.9-.4-3 .4-3 4.1-.9 1.2-2.9-2.3-3.5 1.9-2.3 2.3-1.9 3.5 2.3 2.9-1.2.9-4.1z"/>
    <circle cx="24" cy="24" r="6.5"/>
    ${dim('<circle cx="24" cy="24" r="2.5"/>', 0.6)}`),
};
export function appIcon(id) {
  const span = document.createElement("span");
  span.className = "app-ico";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = APP_ICONS[id] || "";
  return span;
}
