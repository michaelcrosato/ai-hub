import { TYPES } from './catalog.js';
/** Original UI silhouettes; no sprites or textures from the source game. */
export function icon(type) {
  const d=TYPES[type]||{};let shape='';
  if(['rifle','rocket','engineer','medic','grenadier','commando'].includes(type)){
    shape='<path d="M28 43v-9m11 9v-9"/><path d="M25 24h17l3 13H23z" fill="currentColor"/><path d="M28 22v-8h11v8z" fill="#d7ddbd"/><path d="M26 15v-5h15v5" fill="currentColor"/><path d="m26 27-9 9m24-9 10 7"/>';
    if(type==='rocket')shape+='<path d="m35 21 19-11 3 5-19 11z" fill="#839d76"/>';
    else if(type==='engineer')shape+='<rect x="44" y="31" width="13" height="10" fill="#b9ce8f"/><path d="M48 31v-4h5v4"/>';
    else if(type==='medic')shape+='<path d="M33 26v8m-4-4h8" stroke="#efdfb0" stroke-width="3"/>';
    else if(type==='commando')shape+='<path d="M24 12h19l-2-5H27z" fill="#3d583d"/><path d="m41 29 17-9" stroke-width="4"/><path d="M52 18v6"/>';
    else shape+='<path d="m41 29 15-8" stroke-width="4"/>';
  } else if(d.domain==='air')shape='<path d="m19 24 23-5 12 9-5 10H23l-7-7-9-1v-9l12 3z" fill="currentColor"/><path d="M37 21V12M11 12h51M24 40h27m-24-4v4m19-4v4"/><path d="m42 22 9 6-11 1z" fill="#4e7565"/>';
  else if(d.domain==='naval')shape=type==='submarine'?'<path d="M10 31q24-17 52 0l-9 8H18z" fill="currentColor"/><path d="M33 24v-9h10v12m-6-12v-5h5"/>':'<path d="m9 28 18 12h26l11-12z" fill="currentColor"/><path d="M28 29V19h21v10M35 19v-8m-5 2h12M46 25l14-8M22 27l-10-6"/><path d="M12 44h48" stroke="#6c9277"/>';
  else if(d.kind==='unit'){
    shape='<rect x="11" y="32" width="49" height="11" rx="4" fill="#779172"/><path d="m15 29 9-10h26l9 10v7H15z" fill="currentColor"/><path d="M20 38h4m6 0h4m6 0h4m6 0h4" stroke="#334d37"/>';
    if(type==='mcv')shape+='<path d="M25 20V8h20v12m-16-7h12"/><path d="M40 8h15v7" stroke="#d8c58c"/>';
    else if(type==='harvester')shape+='<path d="M21 21h30v-8H27z" fill="#caba79"/><path d="M28 13V8m9 5V8m9 5V8"/>';
    else if(type==='teslaTank')shape+='<path d="M28 22v-5h16v5z" fill="#d5dfb7"/><path d="M36 17V5m-6 3h12m-10 4h8"/><path d="m44 4 5 5-6 3 6 5" stroke="#c9e7b4"/>';
    else shape+='<path d="M28 22v-7h16v7z" fill="#d5dfb7"/><path d="m42 16 19-7" stroke-width="4"/>';
  } else if(['power','advancedPower'].includes(type))shape='<path d="M13 42V23h47v19z" fill="currentColor"/><path d="M18 23V10h11v13m16 0V5h10v18" fill="#a5b794"/><path d="m34 26-5 8h8l-5 7" stroke="#efe0a5"/>';
  else if(['radar','relay'].includes(type))shape='<path d="M18 42V30h39v12z" fill="currentColor"/><path d="M37 32V19M29 24l17-17q14 16-2 22z" fill="#cad8b2"/><path d="m39 17-8-8m-6-1 5 1-1 5"/>';
  else if(type==='tesla')shape='<path d="M18 42h38V33H18z" fill="currentColor"/><path d="M32 33V12h12v21M26 14h24m-21 7h19m-17 7h15"/><path d="m49 5 5 7-8 4 8 6" stroke="#c9e7b4"/>';
  else if(type==='silo')shape='<path d="M13 42V31h47v11z" fill="currentColor"/><path d="m28 31 2-19 7-8 7 8 3 19z" fill="#dce1bf"/><path d="M31 17h13m-15 9-6 6m23-6 6 6"/>';
  else if(type==='tower')shape='<path d="M20 42h33v-6H20z" fill="currentColor"/><path d="m27 36 7-30h5l7 30M29 27h15M31 18h11M33 11h7"/><circle cx="36.5" cy="5" r="3" fill="#e8bd61"/><path d="M45 9q5 3 0 8M49 6q8 6 0 14" stroke="#c9e7b4"/>';
  else if(type==='oil')shape='<path d="m22 41 9-32h13l9 32M26 32h23M29 22h17M20 41h35M24 9h28"/><path d="m32 12 13 10-16 10 23 8" stroke="#bfcc9f"/>';
  else if(type==='shipyard')shape='<path d="M11 42h51V31H11z" fill="currentColor"/><path d="M20 31V7h37v4H25v20m25-19v10h-5"/><path d="M18 45h42" stroke="#729980"/>';
  else if(['armor','weapons','logistics'].includes(type))shape=type==='armor'?'<path d="m36 8 18 6v15L36 44 18 29V14z" fill="currentColor"/><path d="m26 26 7 7 15-16" stroke="#3d583d"/>':type==='weapons'?'<circle cx="36" cy="26" r="14"/><path d="M36 6v11m0 18v11M16 26H7m48 0H44"/><circle cx="36" cy="26" r="3" fill="currentColor"/>':'<path d="M13 19h43v23H13z" fill="currentColor"/><path d="M26 19V9h17v10m-24 8h10m10 0h10"/>';
  else {shape='<path d="M12 42V23l22-11 26 11v19z" fill="currentColor"/><path d="M12 23h48M30 42V29h15v13" stroke="#496441"/>';
    if(type==='conyard')shape+='<path d="M17 25V5h40v5H22v15m28-15v7" stroke="#c8b579"/>';
    if(type==='refinery')shape+='<path d="M47 40V16q7-8 13 0v24" fill="#b7c09a"/>';
    if(type==='barracks')shape+='<path d="M35 14V3l16 5-16 5" stroke="#dcebb1"/>';
    if(type==='helipad')shape+='<path d="M25 31h24m-24-5v12m24-12v12" stroke="#e5dfba"/>';
    if(type==='sam'||type==='pillbox')shape+='<path d="M34 15 53 4m-11 12L61 5" stroke-width="4"/>';
  }
  return `<svg viewBox="0 0 72 50" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${shape}</svg>`;
}
