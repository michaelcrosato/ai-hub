import{J as e,N as t,at as n,ct as r,g as i,lt as a,s as o,y as s}from"./index-DFPbBliE.js";var c=[`squire`,`chemist`,`knight`,`archer`,`monk`,`priest`,`wizard`,`timeMage`,`summoner`,`thief`,`mystic`,`orator`,`geomancer`,`lancer`,`samurai`,`ninja`,`arithmancer`,`bard`,`dancer`,`mime`];function l(){return a().sort((e,t)=>c.indexOf(e.id)-c.indexOf(t.id)).map(e=>{let t=(e.requires??[]).map(e=>`${n.get(e.job)?.name??e.job} Lv${e.level}`).join(` + `)||`Available from the start`;return`${e.name}${e.gender?` (${e.gender===`m`?`men`:`women`})`:``}: ${t}`}).join(`

`)}function u(e){let n=new Set([`ko`,`charging`,`performing`,`jumping`,`defending`]);return Object.values(t).filter(t=>t.bad===e&&!t.hidden&&!n.has(t.id)).map(e=>{let r=e.ticks?`${e.ticks} clockticks`:`No timed expiry`,i=(e.cancels??[]).filter(e=>!n.has(e));return`${e.name} — ${e.desc} ${r}.${i.length?` Replaces ${i.map(e=>t[e].name).join(`, `)}.`:``}`}).join(`

`)}function d(){return[`useAntidote`,`useEyeDrop`,`useEchoHerb`,`useMaidensKiss`,`useSoftener`,`useHolyWater`,`useRemedy`,`stigmata`,`esuna`,`dispelMagic`].map(e=>{let n=r(e),i=(n.effects??[]).flatMap(e=>e.type===`status`?e.remove??[]:[]);return`${n.name}: ${i.map(e=>t[e].name).join(`, `)}.`}).join(`

`)}function f(){return[{id:`first-battle`,title:`Before the Battle`,text:`Read the victory condition before deploying. Some battles require a particular foe defeated, a position reached, or an ally protected. A protected ally falling or turning to Stone can end that battle immediately.

In Formation, choose jobs, learn abilities, set your secondary skillset and passive abilities, then check equipment. Bring a way to restore HP, a way to revive fallen allies, and supplies for your Items commands. A learned command does not provide its consumable.

Check the target preview and Turn Order before committing. Keep a healer within reach of the front line, spread out against area attacks, and find a safe approach to archers and casters on high ground. Guests fight for your side under their own orders.`},{id:`controls`,title:`Controls`,text:`Keyboard: arrows/WASD move the cursor, Enter/Space confirm, Esc/Backspace go back. Camera: Q/E rotate, R toggles a high angle, +/- zoom, F recenters. When no menu is open in battle (for example during an enemy turn) the arrows pan the camera. Tab shows the turn order; hold Shift to fast-forward animations and text.

Mouse: hover a tile to inspect it, click to confirm, right-click to go back. Drag to orbit the camera (it settles on the nearest corner), right-drag or Shift+drag to pan, wheel or trackpad pinch to zoom.

Touch: tap a tile to select it and tap again to confirm. Drag with one finger to orbit; pinch to zoom and drag two fingers to pan. The round buttons at the bottom of the battlefield rotate, zoom (hold), tilt and recenter the camera.

Gamepad (Xbox layout; on PlayStation A=✕ B=○ X=□ Y=△): D-pad or left stick move, A confirm, B back, Start/Y menu, View turn order. Camera: right stick orbits and tilts, LT/RT zoom, LB/RB rotate 90°, L3 high angle, R3 recenter. Hold X to fast-forward.

In this manual, ↑/↓ chooses a topic. ←/→ or Page Up/Page Down scrolls its text; mouse wheel and touch scrolling work too.`},{id:`turns`,title:`Turns & CT`,text:`Every unit has a Charge Time (CT) gauge. Each clocktick it fills by the unit's effective Speed; at 100 or more the unit is ready to act. Haste accelerates that gain, Slow reduces it, and Stop freezes it. Faster soldiers may act several times before a slower one.

On a turn you may Move and Act once each, in either order, then choose a facing. Moving and acting spends 100 CT; doing only one spends 80; simply Waiting spends 60. Any overflow can carry forward, up to 60 CT after the turn. Waiting can therefore bring the next turn sooner.

Charging or taking a Jump pauses normal CT gain until the action resolves. Songs and dances repeat while the performer continues to receive turns. The Turn Order list (Tab) includes charged actions; judge a cast by where it appears among enemy turns.`},{id:`targeting`,title:`Targeting & Charge`,text:`An ability has a targeting range and may cover an area around its centre. Height tolerance can exclude a nearby tile. Read the preview for everyone caught in the effect: many spells can hurt comrades, while some arts exclude one side entirely.

Charged, single-target actions follow the selected unit unless they are projectiles. Area actions stay centred on the chosen tile. An enemy may leave that area, or a friend may enter it, before the effect arrives. Jump also attacks its chosen tile when the Lancer lands.

MP is paid when casting starts. A charge interrupted by KO or a disabling status is lost. Charging and Performing suppress evasion; physical attacks against a charging unit are also stronger. Guard a caster until the spell lands.

Reflect can return eligible magic to its living caster, including a helpful spell cast on someone else. If that caster also has Reflect, the bounced spell has no target. Check the descriptions of summons and other arts that bypass Reflect.`},{id:`terrain`,title:`Terrain & Facing`,text:`Move controls travel distance; Jump controls changes in elevation and small gaps. Allies can be passed through, but you cannot finish on an occupied tile. Enemies block ordinary paths. Movement abilities can change those rules.

High ground extends a bow's reach, but bows cannot shoot a target too close. Guns and crossbows need a clear shot; spears reach along a straight line. Check the highlighted target tiles instead of judging distance alone.

Front attacks face job evasion, shields and accessories; side attacks bypass job evasion; rear attacks bypass shields too. Weapon Guard adds a weapon's evasion from the front. End your turn facing the main threat.

Deep water limits most actions without suitable movement abilities or Float. Poisonous ground can inflict Poison at turn end; lava can burn an unprotected unit. Float also blocks earth damage. Teleport ignores paths and height, but each tile beyond normal Move reduces success by 25%, up to three extra tiles. A failed attempt still spends your Move.`},{id:`brave-faith`,title:`Brave & Faith`,text:`Brave is the percentage chance used by many reactions. It also contributes to barehanded and knight's-sword damage. Below 10 Brave, a unit becomes a Chicken and flees instead of obeying normal orders.

Faith scales many spells through both caster and target. High Faith improves casting and incoming magical healing, but also makes hostile magic more dangerous. Low Faith can weaken a healer's attempt to restore or revive you. Items and many martial techniques use other rules.

Speechcraft can change these values in battle. Afterward, one quarter of the net battle change persists, rounded toward zero; permanent values stay between 1 and 97. Four points gained therefore leave one point behind. Temporary Faith and Doubt statuses substitute 100 or 0 for spell calculations without changing the underlying statistic.`},{id:`zodiac`,title:`Zodiac Compatibility`,text:`Compatibility modifies many damage, healing and success calculations. The target card shows the relationship; check it when a spell or attack seems unexpectedly weak.

Signs four places apart around the zodiac have Good compatibility (×1.25). Signs three apart have Bad compatibility (×0.75). Opposite signs are Best (×1.5) for a man and woman, Worst (×0.5) for two of the same sex, and Bad when either unit is a monster. Other pairings are neutral, including Serpentarius.

Better compatibility helps healing as well as harm. A healer and their usual front-line partner can benefit from a favourable pairing. Compatibility does not override a target's status immunity or elemental absorption.`},{id:`jp`,title:`Learning & Job Points`,text:`Actions earn EXP and Job Points in the acting unit's current job. A secondary skillset still trains the current job. Ordinary movement, Waiting and Defend do not award action JP; specific movement abilities can award their own gains.

One quarter of action JP, rounded down, is shared with other human allies on the field who have not left it. The shared JP belongs to the acting unit's job even when those allies are using different jobs. JP Boost increases the user's gain and the amount available to share.

Formation → Learn Abilities spends the JP stored in a chosen job. Spending never lowers job level: levels use lifetime JP earned, while purchases use the remaining balance. Buying a reaction, support or movement ability does not equip it; use Set Abilities afterward.

Job levels by total JP:\n${e.map((e,t)=>`Lv${t+1}: ${e.toLocaleString()} JP`).join(` · `)}

Unit level is separate. Every 100 EXP raises it, up to 99, with growth based on the current job.`},{id:`job-tree`,title:`Job Unlocks`,text:`Every prerequisite below is a job level. A plus sign means all listed requirements must be met. Change Job shows your own progress and why a job is locked.

${l()}

Named allies retain their unique calling and can train in generic jobs. Rhen's personal Squire progress counts toward Squire prerequisites. Monsters keep their own species.`},{id:`loadout`,title:`Abilities & Equipment`,text:`A human unit has its job's main skillset plus one secondary skillset. Only learned commands are available, apart from free commands granted by the job. A Cleric with Items still needs to learn Potion or Phoenix Down and carry the supplies.

Set one Reaction, one Support and one Movement ability. Learned passives can serve another job; innate abilities belong to the current job. Check these slots when changing roles. An equipment-granting support occupies the same slot that could hold JP Boost or another support.

Job and support rules determine which gear fits. Changing jobs or removing an equipment support returns incompatible gear to inventory. Two-handed weapons leave no room for a shield. Dual Wield permits a second one-handed weapon; Optimize Gear does not choose it for you.

Outfitter details list elemental protection, status immunities and starting or constant effects. An accessory can solve a dangerous encounter even without impressive stat bonuses. Safeguard protects equipment from theft and breakage.`},{id:`healing`,title:`Healing & Supplies`,text:`Items commands use shared party stock. Chemists can throw consumables four tiles; other jobs use them at short range unless Throw Items is equipped. Guests carry their own limited supplies.

Potions restore HP and ethers restore MP without charging. White Magic offers stronger and wider healing, but needs MP, time and suitable Faith. Chakra restores HP and MP without consumables; surrounding targets must stand at the same height.

Phoenix Down, Raise and the Monk's Revive return a KO'd ally before their countdown expires. Ordinary healing does not revive them. Reraise revives its bearer at the next KO countdown step with a little HP.

Undead reverse ordinary HP healing and resist normal revival while fallen. Revival effects instead fell a living undead foe, with reduced effect on bosses. Inspect a creature before selecting a cure.`},{id:`cures`,title:`Cures & Dispel`,text:`Different remedies remove different conditions. This list follows the commands available in this game. Learned item commands still consume the named supplies.

${d()}

Haste and Slow replace one another; Regen and Poison do the same. Physical damage can break Confuse and Charm, while damaging attacks wake Sleep. Reapplying the Toad spell to a toad lifts that curse. Constant effects supplied by a job or equipment cannot be removed with an ordinary cure.`},{id:`ailments`,title:`Ailment Reference`,text:`Durations count shared clockticks. No timed expiry means you need a cure or the condition's own removal rule. Doom uses the unit's turn countdown instead. Gear and some enemies can grant immunity.

${u(!0)}

Stone counts as out of the fight even though the unit is alive. Losing every active ally can end the battle before you get another chance to cure them.`},{id:`boons`,title:`Boon Reference`,text:`These are statuses, separate from learned support abilities. Timed effects wear off as the shared clock advances; constant effects from equipment or a job remain.

${u(!1)}

The White Magic spell called Wall grants Protect and Shell. The separate Wall status listed here is a stronger effect used by other arts; names alone do not guarantee identical protection.`},{id:`reactions`,title:`Reactions & Counters`,text:`A reaction needs its particular trigger as well as an eligible unit. Most rolls use Brave as a percentage. Counter needs a damaging physical hit and a living attacker within weapon reach.

Sleep, Stop, Stone, Confuse, Charm, Berserk, Toad, Chicken and Disabled prevent normal reactions. Airborne and KO'd units cannot react. Some defensive reactions intervene before a hit; others need damage or Critical HP (one fifth of maximum HP or less).

Auto-Potion spends the best potion in party stock: X-Potion, then Hi-Potion, then Potion. It needs damage, survival, supplies and a successful Brave roll. Counter Magic needs enough MP to answer the spell. Mana Shield needs enough MP to pay the whole incoming hit.

Defend is an action granted by the Defend support. Its stance doubles evasion until the next turn. Charging and Performing suppress evasion even when equipment would normally offer protection.`},{id:`special-arts`,title:`Specialised Commands`,text:`Leap: learned Horizontal and Vertical Jump abilities expand reach; only the greatest value on each axis matters. The Lancer leaves the field, then strikes the chosen tile after a delay based on Speed. Spears strengthen the blow. A moving target can escape.

Geomancy: this game's terrain-specific arts require a matching target tile. Check each art's highlighted tiles. This differs from guides that choose an art from the caster's footing.

Iaido: keep the named katana in inventory to release its spirit. The equipped blade is not a substitute for that spare. There is a 12% chance of consuming it after use. Throw always consumes the selected throwable or weapon.

Bardsong and Dance repeat while the performer waits. Moving or acting ends the performance. Mimics echo eligible allied actions relative to their own position, so the same offset can strike a different group. Mimics have no native weapon or armour proficiencies and no abilities to buy.`},{id:`arithmeticks`,title:`Arithmeticks`,text:`Learn an attribute and a divisor, then a spell permitted by the Arithmeticks menu. Choose CT, Level, EXP or Height and a multiple of 3, 4 or 5, or a prime number. Only learned terms are offered.

The spell resolves immediately without MP on every eligible unit matching the formula, except units currently jumping or absent from the field. Revival spells target fallen units and living undead; other spells target living units. Allies, enemies and the caster can all be included. Review every highlighted target.

Height uses the tile's height, adding its water depth when a Floating unit rides above it. It does not use Jump. CT and EXP change during play. A multiple test includes zero; the prime test excludes zero and one.

You can begin with one attribute, one divisor and a suitable spell. More terms give you more ways to select the right group.`},{id:`fallen`,title:`Falling & Crystals`,text:`At 0 HP a unit is KO'd. Its counter decreases on three scheduled KO turns at a fixed cadence. Revive it before the last count. The hero's expired countdown causes defeat; a protected ally may cause defeat immediately on falling.

Ordinary recruits and monsters can become a crystal or chest and be permanently lost. Named allies and guests normally withdraw instead. Gentle mode lets ordinary allies withdraw too, but the hero and mission-protection conditions still matter.

End movement on a crystal to collect it. Humans inherit eligible abilities they do not yet know. A crystal from a unit in a unique job does not pass on its action abilities; monsters' crystals teach no abilities. If nothing can be learned, it restores HP and MP instead. Collecting a chest grants its item.

The battle ends when its objective is met. Collect a distant chest before the last enemy falls. An ally still KO'd when you win is not the same as an ally whose countdown has expired.`},{id:`travel`,title:`Towns & Travel`,text:`Travel follows known roads. Each stop advances one day, including stops along a longer route. The current objective identifies where the story continues; arriving there can begin the next event.

Open country may trigger an ambush. Towns provide an Outfitter, Soldier Office and Tavern where available; some have a Fur Shop. Outfitter stock improves as the campaign advances. Item details show which soldiers can use it.

The Soldier Office hires generic humans for gil, up to the normal company limit of 24. Formation lets you rename or dismiss ordinary recruits; dismissal returns their equipment. Named allies cannot be dismissed there.

Read Tavern rumours as events unfold. Some record a lead that opens an optional journey; others explain Ivaldis. Chronicle keeps the company's history and discoveries, and the map shows the roads currently open.`},{id:`errands`,title:`Errands & Discoveries`,text:`Tavern errands send one to three available generic humans away. Story characters and monsters cannot go. Pay the fee, choose the party, and keep enough soldiers home for your next battle. Away soldiers cannot deploy.

World-map travel advances days. Here, the party returns automatically on its due date; there is no need to revisit the posting tavern. Errands underway lists outstanding assignments.

Success depends on preferred jobs, the attribute each posting favours (Brave, Faith, level, PA, MA or Speed), and the number sent. It is not guaranteed. Successful errands grant their listed rewards, including JP in each soldier's current job; some grant an artefact, item or new destination.

On failure the fee is spent and the soldiers return empty-handed, but an eligible unfinished errand can be attempted again. An artefact is a Chronicle discovery, not necessarily usable equipment.`},{id:`monsters`,title:`Recruiting Monsters`,text:`Invite persuades eligible foes to join. Speechcraft needs Beast Speech to reach monsters; Orators have it innately, and another job must equip it. Bosses, protected figures and unrecruitable creatures refuse.

Tame can recruit a hostile monster when a damaging hit leaves it alive at Critical HP. Charm only changes sides temporarily. Keep a recruit from crystallizing before the battle ends.

Monsters cannot change jobs, buy abilities or wear equipment. They gain techniques at their species' listed levels. A secret art also needs an allied Beast Lore user within three tiles. See the Chronicle bestiary for individual arts and traits.

After victory, eligible unnamed monsters occasionally produce a youngster of their own species if the company has room. Youngsters join immediately. Named creatures and species that cannot breed produce none.`},{id:`treasure`,title:`Poaching & Treasure`,text:`Equip Poach and fell an enemy monster with a poaching reward. Its body is removed, and a common or rarer item enters Fur Shop stock after battle. Visit a Fur Shop and buy it to add it to your inventory.

Treasure Hunter finds hidden items when movement ends on their tile. Each cache can be collected once during that battle. Brave is the chance of finding its common item; lower Brave improves the rare-item chance. Weigh that against weaker reactions and becoming a Chicken below 10 Brave.

Chests left by fallen units need no Treasure Hunter. Steal takes a foe's equipment and adds it to stock; breaking equipment destroys it. Safeguard can block both attempts. An empty slot offers nothing to take.`},{id:`saves`,title:`Saves & Options`,text:`Save from the world menu into one of seven manual slots. The eighth slot is reserved for autosave. Keep a manual record before a long sequence of story battles so you can return to Formation and shops if you need a different plan.

Saves belong to this browser's local storage. Another browser or device does not automatically share them. Continue opens the newest save; Load lets you choose a slot.

Options adjusts difficulty, battle and text speed, Gentle mode and random encounters. Turning random encounters off removes wandering ambushes; story objectives remain. Gentle mode prevents ordinary allies crystallizing, while hero and protected-unit defeat conditions remain.

Reopen this manual from Options → How to Play. Its job requirements, cures and status durations reflect this game's rules.`},{id:`references`,title:`About this Manual`,text:`Final Fealty Tactics is an original adaptation with its own names, story and mechanical choices. This manual describes the game you are playing. External guides may describe different job requirements, targeting rules, durations or edition-specific features.

The supplied reference sites informed the topics covered here. StrategyWiki's Gameplay page explains the original job and command structure; the Final Fantasy Wiki's status and errand pages offer further background. The descriptions in this manual are original and follow Final Fealty's rules.`,links:[{title:`Final Fantasy Wiki — Final Fantasy Tactics`,url:`https://finalfantasy.fandom.com/wiki/Final_Fantasy_Tactics`},{title:`Independent Final Fantasy Wiki — Final Fantasy Tactics`,url:`https://finalfantasywiki.com/wiki/Final_Fantasy_Tactics`},{title:`StrategyWiki — Final Fantasy Tactics`,url:`https://strategywiki.org/wiki/Final_Fantasy_Tactics`},{title:`StrategyWiki — Gameplay`,url:`https://strategywiki.org/wiki/Final_Fantasy_Tactics/Gameplay`},{title:`Final Fantasy Wiki — Statuses`,url:`https://finalfantasy.fandom.com/wiki/Final_Fantasy_Tactics_statuses`},{title:`Final Fantasy Wiki — Errands`,url:`https://finalfantasy.fandom.com/wiki/Errands`}]}]}async function p(e){let t=o(`How to Play`,e),n=f(),r=null,a=null,c=-1,l=e=>{if(c===e)return;c=e,r?.remove();let i=n[e];a=s(`div`,{role:`region`,"aria-label":i.title,style:{lineHeight:`1.55`,marginTop:`6px`,overflowY:`auto`,minHeight:`0`}},s(`div`,{style:{whiteSpace:`pre-wrap`}},i.text),...(i.links??[]).map(e=>s(`p`,{style:{margin:`10px 0 0`}},s(`a`,{href:e.url,target:`_blank`,rel:`noopener noreferrer`,style:{color:`inherit`,textDecoration:`underline`}},e.title)))),r=s(`div.panel.detail.titled`,{style:{right:`16px`,top:`64px`,width:`min(620px, 60vw)`,maxHeight:`calc(78 * var(--vh))`,display:`flex`,flexDirection:`column`}},s(`div.title-plate`,null,i.title),s(`div.muted`,{style:{fontSize:`.82em`,flexShrink:`0`}},`Scroll text: ←/→ · Page Up/Down · wheel · swipe`),a),t.root.appendChild(r)};try{await i({items:n.map((e,t)=>({label:e.title,value:t})),x:16,y:64,title:`Topics`,parent:t.root,keepOpenOnChoose:!0,maxHeight:`calc(70 * var(--vh))`,onHover:e=>{e!==null&&l(e)},onAction:e=>e!==`left`&&e!==`right`&&e!==`prev`&&e!==`next`?!1:(a?.scrollBy({top:(e===`left`||e===`prev`?-1:1)*Math.max(80,a.clientHeight*.7)}),!0)}).promise}finally{r?.remove(),t.close()}}export{p as openHelp};