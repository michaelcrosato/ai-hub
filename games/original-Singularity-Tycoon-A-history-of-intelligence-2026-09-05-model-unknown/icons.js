const paths = {
  lab: "M3 21h18M6 21V8l6-5 6 5v13M9 21v-6h6v6M9 10h.01M15 10h.01",
  tree: "M12 3v5M5 13V8h14v5M12 8v5M3 13h4v5H3zM10 13h4v5h-4zM17 13h4v5h-4z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  box: "m3 7 9-4 9 4-9 4-9-4M3 7v10l9 4 9-4V7M12 11v10M7 5l10 4",
  book: "M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v15",
  database: "M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3M4 6v12c0 2 3.6 3 8 3s8-1 8-3V6M4 12c0 2 3.6 3 8 3s8-1 8-3",
  chip: "M6 6h12v12H6zM9 9h6v6H9zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3",
  dollar: "M12 2v20M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6",
  coin: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v10M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4M8 12l3 3 5-6",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7l1-8",
  chart: "M3 3v18h18M7 15l4-4 4 2 5-7",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2M7 3v6h9V3M7 21v-8h10v8",
  settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2",
  arrow: "M4 12h16M14 6l6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  plus: "M12 4v16M4 12h16",
  minus: "M4 12h16",
  close: "m6 6 12 12M6 18 18 6",
  pause: "M8 5v14M16 5v14",
  play: "m8 4 12 8-12 8V4",
  check: "m5 12 4 4L19 6",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4",
  flask: "M9 3h6M10 3v7L4 20h16l-6-10V3M8 15h8",
  expand: "M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6",
  rotate: "M3 11a9 9 0 1 1 2 7M3 4v7h7",
  info: "M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  sun: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M19 5l-1 1M6 18l-1 1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  download: "M12 3v12M7 10l5 5 5-5M3 15v6h18v-6",
  upload: "M12 16V4M7 9l5-5 5 5M3 16v5h18v-5",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  snow: "M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 4 4-4M8 20l4-4 4 4",
  sound: "M4 10v4h4l5 4V6l-5 4H4M17 8a7 7 0 0 1 0 8M20 5a11 11 0 0 1 0 14",
  link: "m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M14 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  star: "m12 3 2.8 5.8L21 10l-4.5 4.4 1.1 6.3L12 17.7l-5.6 3 1.1-6.3L3 10l6.2-1.2L12 3",
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.box}"/></svg>`;
}
export function buildingIcon(type) {
  const typeMap = { vacuum: "server", mainframe: "server", micro: "server", cluster: "server", gpu: "gpu", tpu: "gpu" };
  type = typeMap[type] || type;
  let body = "";
  if (["server", "gpu"].includes(type)) {
    body =
      '<path d="M21 20 37 12 53 20 37 28Z" fill="#c5d0b8"/><path d="M21 20v32l16 9V28Z" fill="#9cad93"/><path d="M37 28v33l16-9V20Z" fill="#758b78"/><path d="m40 31 10-5v5l-10 5zm0 9 10-5v5l-10 5zm0 9 10-5v5l-10 5z" fill="' +
      (type === "gpu" ? "#a6ccd1" : "#d5dcab") +
      '"/>';
  } else if (type === "desk") {
    body =
      '<path d="m12 31 29-14 26 13-28 16z" fill="#cfb691"/><path d="m12 31 27 15v5L12 36z" fill="#a18969"/><path d="M18 37v20l4 2V39M57 37v18l4-2V35M36 47v20l4 2V47" fill="#8d9b87"/><path d="M34 15v17l15-7V8z" fill="#bcc5ab"/><path d="M37 16v11l9-4V12z" fill="#597864"/>';
  } else if (type === "power") {
    body =
      '<path d="m20 25 18-9 19 9-19 10z" fill="#d2c7a9"/><path d="M20 25v28l18 9V35z" fill="#aeae93"/><path d="M38 35v27l19-9V25z" fill="#8b967d"/><path d="m49 32-8 16 6-3-2 12 10-19-6 3z" fill="#e9c77e"/>';
  } else if (type === "cooling") {
    body =
      '<path d="m17 27 22-11 24 11-24 13z" fill="#cee0d8"/><path d="M17 27v27l22 11V40z" fill="#a1bcba"/><path d="M39 40v25l24-11V27z" fill="#769ba0"/><ellipse cx="39" cy="27" rx="13" ry="6" fill="#759ba3"/><path d="m44 44 14-7m-14 14 14-7m-14 14 14-7" stroke="#c4d9cd" stroke-width="3"/>';
  } else if (type === "network") {
    body =
      '<path d="m24 20 14-7 17 8-15 8z" fill="#d1d0b2"/><path d="M24 20v35l16 8V29z" fill="#a8b397"/><path d="M40 29v34l15-8V21z" fill="#82957a"/><path d="m43 33 9-4m-9 12 9-4m-9 12 9-4m-9 12 9-4" stroke="#dde0b3" stroke-width="3"/>';
  } else if (type === "archive") {
    body =
      '<path d="m21 24 17-8 21 10-18 9z" fill="#d3c6a9"/><path d="M21 24v32l20 10V35z" fill="#b2a083"/><path d="M41 35v31l18-9V26z" fill="#908d74"/><path d="m44 38 12-6v7l-12 6zm0 12 12-6v7l-12 6z" fill="#c5c5a3"/><path d="m24 17 17-8 14 7-17 8z" fill="#e6d8b5"/>';
  } else {
    body =
      '<path d="m15 36 25-12 23 12-25 12z" fill="#bbc8ab"/><path d="M15 36v15l23 12V48z" fill="#91a387"/><path d="M38 48v15l25-12V36z" fill="#74906f"/><path d="M15 36V24l24-12v12z" fill="#b1c1a1"/>';
  }
  return `<svg class="building-illustration" viewBox="0 0 80 76" aria-hidden="true"><ellipse cx="40" cy="64" rx="28" ry="7" fill="#69725b" opacity=".09"/>${body}</svg>`;
}
export function logo() {
  return `<svg viewBox="0 0 40 40" width="36" height="36" fill="none" aria-hidden="true"><path d="m20 3 15 9v17l-15 9L5 29V12L20 3Z" stroke="currentColor" stroke-width="1.4"/><path d="M5 12 20 21l15-9M20 21v17M12.5 7.5 27.5 16v17M27.5 7.5l-15 8.5v17" stroke="currentColor" stroke-width="1.2"/></svg>`;
}
