import { h, useEffect, useRef } from './react.js';
import Icon from './icons.js';
export const money = n => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export function duration(n) { return n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ' ' + n % 60 + 'm' : ''}` : `${n}m`; }
export function Portrait({ name = 'June', skin = '#d5a078', shirt = '#88b2a3', old = false, apron = false, small = false }) { return h("span", { className: 'portrait ' + (small ? 'small' : ''), style: { '--portrait-bg': apron ? '#ead9bf' : '#dae2d1' } },
    h("svg", { viewBox: "0 0 64 64", "aria-hidden": "true" },
        h("path", { d: "M6 64c1-17 13-22 26-22s25 5 26 22", fill: shirt }),
        h("rect", { x: "27", y: "38", width: "10", height: "11", rx: "4", fill: skin }),
        h("ellipse", { cx: "32", cy: "28", rx: "15", ry: "18", fill: old ? '#c8c4b6' : '#746051' }),
        h("ellipse", { cx: "32", cy: "31", rx: "13", ry: "15", fill: skin }),
        h("path", { d: "M18 26c0-14 23-20 27-2-12-1-11-9-11-9s-1 11-16 11", fill: old ? '#c8c4b6' : '#746051' }),
        h("circle", { cx: "27", cy: "30", r: "1.3", fill: "#4b5044" }),
        h("circle", { cx: "37", cy: "30", r: "1.3", fill: "#4b5044" }),
        h("path", { d: "M29 37q3 3 6 0", fill: "none", stroke: "#ae775e", strokeWidth: "1.5", strokeLinecap: "round" }),
        apron && h("path", { d: "m23 50 9 5 9-5 3 14H20Z", fill: "#f9efd6" }))); }
export function Logo() { return h("div", { className: "brand" },
    h("svg", { className: "brand-mark", viewBox: "0 0 54 56", "aria-hidden": "true" },
        h("circle", { cx: "39", cy: "12", r: "6", fill: "#e6b656" }),
        h("path", { d: "M6 28 27 10l21 18", fill: "none", stroke: "#d49370", strokeWidth: "5", strokeLinejoin: "round", strokeLinecap: "round" }),
        h("path", { d: "M12 26v24h30V26L27 15Z", fill: "#74a696" }),
        h("path", { d: "M23 50V36h9v14", fill: "#f9f0d6" }),
        h("path", { d: "M9 51h38", stroke: "#a2b485", strokeWidth: "3", strokeLinecap: "round" }),
        h("rect", { x: "16", y: "27", width: "7", height: "7", rx: "1", fill: "#f9e0a0" }),
        h("rect", { x: "32", y: "27", width: "7", height: "7", rx: "1", fill: "#f9e0a0" })),
    h("div", null,
        h("div", { className: "brand-name" },
            "Hearth ",
            h("span", null, "&"),
            " Home",
            h("span", { className: "beta" }, "BETA")),
        h("div", { className: "brand-tagline" }, "A LITTLE LIFE. A LOT OF LOVE."))); }
export function Meter({ icon, label, value, tone = 'green', subtle = false }) { const v = Math.round(value); return h("div", { className: 'meter ' + (subtle ? 'subtle' : '') },
    h("div", { className: "meter-label" },
        h("span", null,
            h(Icon, { name: icon, size: 15 }),
            label),
        h("b", { className: v < 30 ? 'warning' : '' },
            v,
            h("small", null, "%"))),
    h("div", { className: 'meter-track ' + tone, role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": v },
        h("i", { style: { width: `${v}%` } }))); }
/** Open dialogs, newest last, so the Back action (Esc / B) closes the one on top. */
const openModals = [];
export function closeTopModal() { const top = openModals[openModals.length - 1]; if (!top?.current) return false; top.current(); return true; }
export function Modal({ title, eyebrow, children, onClose, wide = false, className = '' }) {
    const ref = useRef(), closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        openModals.push(closeRef);
        const prev = document.activeElement;
        const el = ref.current;
        // Start on the dialog's first real control (not its close button), so A / Enter never dismisses by surprise.
        (el.querySelector('.modal-body button:not(:disabled),.modal-body input:not(:disabled),.modal-body [tabindex="0"]') || el.querySelector('button,input,select,[tabindex="0"]'))?.focus({ preventScroll: true });
        // Escape is the Back action (see controls.js); here only keep Tab inside the dialog.
        function key(e) {
            if (e.key !== 'Tab')
                return;
            const items = [...el.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(n => n.getClientRects().length > 0);
            if (!items.length) {
                e.preventDefault();
                return;
            }
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        el.addEventListener('keydown', key);
        return () => { const i = openModals.indexOf(closeRef); if (i >= 0) openModals.splice(i, 1); el.removeEventListener('keydown', key); if (prev?.isConnected) prev.focus?.({ preventScroll: true }); };
    }, []);
    return h("div", { className: "modal-shade", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose?.(); } },
        h("section", { ref: ref, role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title", className: `modal ${wide ? 'wide' : ''} ${className}` },
            h("header", { className: "modal-header" },
                h("div", null,
                    eyebrow && h("div", { className: "eyebrow" }, eyebrow),
                    h("h2", { id: "modal-title" }, title)),
                onClose && h("button", { className: "icon-button", "aria-label": "Close dialog", onClick: onClose },
                    h(Icon, { name: "close" }))),
            h("div", { className: "modal-body" }, children)));
}
export function Tag({ children, icon, tone = '' }) { return h("span", { className: 'tag ' + tone },
    icon && h(Icon, { name: icon, size: 13 }),
    " ",
    children); }
