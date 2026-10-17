import {boot} from '../tests/harness.mjs';
const {G,app,game}=boot();G.validateContent();for(const d of Object.values(G.content.missions))G.validateMissionMap(d,app.session.maps.city);console.log(JSON.stringify({passed:true,missions:Object.keys(G.content.missions),vehicles:Object.keys(G.content.vehicles).length,weapons:Object.keys(G.content.weapons).length}));game.dispose();
