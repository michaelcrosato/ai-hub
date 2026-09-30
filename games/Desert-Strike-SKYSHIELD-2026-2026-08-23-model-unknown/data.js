/**
 * data.js — SKYSHIELD: 2026 content and the pure rules around it: the six
 * operations (five campaign fronts and the reserve operation LOW TIDE), the
 * Nightjar crew, epilogues, and the deterministic mission-tile generator that
 * builds the continent-scale WHITE NOON desert.
 */

export const MISSIONS = [
  {
    id: "white-noon",
    operation: "OPERATION 01",
    title: "WHITE NOON",
    region: "The Oris Basin Compact",
    date: "14 SEP 2026",
    estimate: "75\u2013110 MIN",
    biome: "desert",
    accent: "#f2a84a",
    threat: "Water-grid seizure / drone logistics / synthetic command",
    synopsis:
      "Cross a continent-sized desert to reopen a shared water corridor, expose a manufactured shortage, and stop a private drone army from turning forged orders into a war between three treaty states.",
    briefing:
      "A record heat dome has settled over the Lyrra Republic, the Mavik Cooperative, and the Doren Free Cantons. Their shared reservoirs are strained but stable; the public forecast claiming total collapse is false. Cinderline Combine bought the basin\u2019s freight terminals, water futures, and emergency communications, then used containerized drones and synthetic voices to make each signatory believe the others had seized the supply. Reopen the relief network, recover the authentic hydrology record, keep the Compact from firing on itself, and expose the commercial coup before dawn closes the hydraulic safeties.",
    stakes: "Twenty-four million civilians and the basin\u2019s only water-sharing treaty",
    boss: "MOBILE DRONE CARRIER \u2018CROWNLESS\u2019",
    worldType: "desert-stream",
    revision: 2,
    worldSeed: 20260914,
    insertion: [-570, -520],
    phases: [
      {
        id: "mercy-strip",
        title: "Open the Mercy Strip",
        kind: "eliminate",
        setpiece: "relief-airstrip",
        tileRotation: 1,
        variant: 11,
        location: [-505, -455],
        target: 12,
        enemy: "drone",
        checkpoint: true,
        detail: "Destroy the drone pickets blocking relief aircraft",
        radio:
          "Kestrel, six relief transports are circling on reserve fuel. Clear twelve drone pickets, but keep your fire away from the runway crews and fuel bladders.",
        conclusion:
          "Mercy Strip is open. The first transports are unloading cooling tents, medicine, and water membranes while the remaining flights begin their descent.",
        storyBeat:
          "Patch finds Cinderline asset tags beneath false Doren markings on the wreckage. The supposed border raid was staged by a private logistics network.",
      },
      {
        id: "sunwell-seven",
        title: "Wake Sunwell Seven",
        kind: "secure",
        setpiece: "solar-wellfield",
        tileRotation: 2,
        variant: 23,
        location: [-560, -145],
        target: 360,
        enemy: "technical",
        checkpoint: true,
        detail: "Hold the solar wellfield while engineers restart its pumps",
        radio:
          "Sunwell Seven can supply every western shelter, but the control mesh is locked. Enter the wellfield and hold low while Patch gives the pumps back to the civic engineers.",
        conclusion:
          "All four pump strings are online, every heliostat is tracking, and clean water is moving west under independent civic control.",
        storyBeat:
          "Live gauges show the aquifer at forty-two percent, not the four percent reported in emergency broadcasts. The shortage is real, but the collapse was fabricated.",
      },
      {
        id: "real-forecast",
        title: "Find the Real Forecast",
        kind: "eliminate",
        setpiece: "climate-observatory",
        tileRotation: 3,
        variant: 31,
        location: [-470, 210],
        target: 14,
        enemy: "jammer",
        checkpoint: true,
        detail: "Clear the jammers surrounding the climate archive",
        radio:
          "The observatory keeps an offline forecast beneath the ridge. Fourteen jammer teams are burying its signal; remove them so the archivists can surface the original model.",
        conclusion:
          "The ridge is quiet and the physical forecast is transmitting through three neutral mirrors. It confirms emergency releases can carry the basin through the heat dome.",
        storyBeat:
          "The forged forecast entered government networks with authentic credentials and synthetic verbal approval from all three leaders. Someone stole part of the Compact\u2019s public key.",
      },
      {
        id: "blue-column",
        title: "Carry the Blue Column",
        kind: "escort",
        setpiece: "basalt-canyon-convoy",
        tileRotation: 1,
        variant: 47,
        location: [-250, 500],
        destination: [30, 520],
        target: 600,
        enemy: "technical",
        checkpoint: true,
        detail: "Escort the emergency water convoy through Basalt Cut",
        radio:
          "Forty tankers are leaving Sunwell Seven for Redglass City. Stay inside their defense link through the canyon; the rock walls will hide anything waiting above the road.",
        conclusion:
          "Every tanker cleared Basalt Cut and Redglass has begun neighborhood distribution. Not one driver or civilian escort was lost in the crossing.",
        storyBeat:
          "The ambushers possessed live convoy manifests that existed only on Cinderline\u2019s freight exchange. The same breach exposes the location of Redglass Field Hospital.",
      },
      {
        id: "glass-canopy",
        title: "Hospital Under Glass",
        kind: "survive",
        setpiece: "field-hospital",
        tileRotation: 0,
        variant: 59,
        location: [80, 545],
        target: 480,
        enemy: "drone",
        checkpoint: true,
        detail: "Defend Redglass Field Hospital through the dust front",
        radio:
          "A dust wall is about to blind the hospital radar, and a drone wave is riding inside it. Hold the perimeter until every casualty tent is sealed beneath the glass canopy.",
        conclusion:
          "The dust front has passed, the wards remain powered, and the final exposed patients are under cover. Redglass Hospital is still treating all three nationalities.",
        storyBeat:
          "Refugees carry recordings of their own leaders ordering contradictory attacks. Patch detects identical breath timing in every voice: the orders were synthesized by one broadcast farm.",
      },
      {
        id: "borrowed-voices",
        title: "Silence Borrowed Voices",
        kind: "eliminate",
        setpiece: "broadcast-bazaar",
        tileRotation: 2,
        variant: 61,
        location: [405, 460],
        target: 12,
        enemy: "jammer",
        checkpoint: true,
        detail: "Disable the mobile synthetic-broadcast vehicles",
        radio:
          "The old market is full of projector vans impersonating officials and emergency stations. Disable the twelve mobile relays; the civilian tower itself must survive.",
        conclusion:
          "The borrowed voices are off the air and local broadcasters control the tower again. Verified shelter instructions are replacing forged mobilization orders.",
        storyBeat:
          "One relay still trusts a stolen Compact authentication shard. Its last handshake leads to Saltspire, the basin\u2019s highest public communications relay.",
      },
      {
        id: "public-key",
        title: "Return the Public Key",
        kind: "secure",
        setpiece: "salt-relay-spire",
        tileRotation: 3,
        variant: 73,
        location: [565, 160],
        target: 360,
        enemy: "sam",
        checkpoint: true,
        detail: "Restore the Compact authentication key at Saltspire",
        radio:
          "Saltspire can revoke every forged order at once. Hold beneath the relay while Patch reunites the public key and mirrors the correction outside Cinderline\u2019s network.",
        conclusion:
          "The new authentication chain is live across the basin. Border units are rejecting synthetic orders and opening direct verified channels to one another.",
        storyBeat:
          "Unable to manufacture consent, Cinderline activates hundreds of drones hidden inside ordinary freight containers at the eastern dry port.",
      },
      {
        id: "box-army",
        title: "Break the Box Army",
        kind: "eliminate",
        setpiece: "container-dry-port",
        tileRotation: 0,
        variant: 89,
        location: [525, -190],
        target: 18,
        enemy: "drone",
        checkpoint: true,
        detail: "Destroy the containerized drone-launch cells",
        radio:
          "Those cargo stacks are unfolding into launch racks. Destroy eighteen active cells before the port becomes an automated airbase, but leave the relief containers intact.",
        conclusion:
          "The launch grid is wrecked and the dry port crews have isolated every contaminated container. Food and medical cargo can move again.",
        storyBeat:
          "A recovered manifest shows Cinderline diverted the basin\u2019s replacement desalination membranes onto one freight train, then mined its route to ensure a visible supply disaster.",
      },
      {
        id: "membrane-train",
        title: "Save the Membrane Train",
        kind: "escort",
        setpiece: "salt-rail-causeway",
        tileRotation: 3,
        variant: 97,
        location: [305, -500],
        destination: [40, -545],
        target: 600,
        enemy: "tank",
        checkpoint: true,
        detail: "Escort the desalination train across the salt causeway",
        radio:
          "The membrane train is moving before the mines can be reset. Match its speed across the salt causeway and screen the maintenance crews clearing the line ahead.",
        conclusion:
          "The complete membrane shipment has reached the western junction. Desalination plants can replace failed filters instead of shutting down next week.",
        storyBeat:
          "Its freight ledger proves Cinderline hoarded critical parts while betting on water prices. A second manifest sends demolition charges toward the Grand Weir.",
      },
      {
        id: "grand-weir",
        title: "Turn the River",
        kind: "secure",
        setpiece: "grand-weir",
        tileRotation: 1,
        variant: 101,
        location: [-25, -555],
        target: 420,
        enemy: "tank",
        checkpoint: true,
        detail: "Hold the aqueduct gates while engineers remove the locks",
        radio:
          "Cinderline welded the gates shut and armed the service deck. Hold the control apron while engineers cut out the locks; damage to the turbines will strand the southern cities.",
        conclusion:
          "Grand Weir is intact and the emergency release has entered the south canal. Civilian gauges are publishing every liter in real time.",
        storyBeat:
          "With water moving and the forged orders exposed, all three governments agree to an emergency quorum at Treaty Mesa\u2014if their delegates survive the approach.",
      },
      {
        id: "no-flag",
        title: "No Flag at Noon",
        kind: "eliminate",
        setpiece: "false-flag-armor-yard",
        tileRotation: 2,
        variant: 113,
        location: [-345, -435],
        target: 16,
        enemy: "tank",
        checkpoint: true,
        detail: "Destroy the unmanned armor converging on Treaty Mesa",
        radio:
          "Sixteen unmanned vehicles are approaching under alternating national colors. Their markings change every time a camera sees them. Stop the column before either border force answers.",
        conclusion:
          "The false-flag armor is disabled outside visual range of the delegates. Verified border commanders confirm that none of the vehicles belonged to them.",
        storyBeat:
          "Every vehicle answers to one moving controller: Crownless, Cinderline\u2019s solar landship and drone carrier, crossing the dry central reservoir.",
      },
      {
        id: "hold-table",
        title: "Hold the Table",
        kind: "survive",
        setpiece: "treaty-mesa",
        tileRotation: 0,
        variant: 127,
        location: [-550, -80],
        target: 540,
        enemy: "drone",
        checkpoint: true,
        detail: "Defend the emergency water quorum",
        radio:
          "The delegates are voting beneath the mesa while Crownless throws its remaining drone cloud at them. Hold the ring until all three chambers sign the release.",
        conclusion:
          "The emergency quorum passed without martial rule or secret concessions. Every delegate signed the same transparent release order.",
        storyBeat:
          "Crownless rejects the civilian revocation and begins wiping its freight archive. The signed order is useless until the carrier\u2019s weapons network is severed.",
      },
      {
        id: "crownless",
        title: "Bring Down Crownless",
        kind: "boss",
        setpiece: "dry-reservoir-arena",
        tileRotation: 1,
        variant: 139,
        location: [-30, 40],
        target: 1,
        enemy: "boss",
        checkpoint: true,
        detail: "Disable the Crownless mobile drone carrier",
        radio:
          "Crownless is exposed on the reservoir floor. Break its drone bays and command core, but preserve the archive\u2014we need proof that this crisis was manufactured for profit.",
        conclusion:
          "Crownless is immobilized, its weapons bus is dark, and its complete market and command archive is broadcasting through the restored public network.",
        storyBeat:
          "The commercial coup is visible to the entire basin. Nightjar must still deliver the signed quorum key to the civic pump citadel before the dawn safeties close.",
      },
      {
        id: "first-water",
        title: "First Water",
        kind: "extract",
        setpiece: "civic-pump-citadel",
        tileRotation: 3,
        variant: 149,
        location: [550, 515],
        target: 240,
        enemy: "drone",
        detail: "Deliver the quorum key to the civic pump citadel",
        radio:
          "One last crossing, Kestrel. Bring the human quorum key to the pump citadel and hold in the landing ring until every district accepts the release.",
        conclusion:
          "Quorum accepted. The citadel gates are open, verified water schedules are public, and the first uninterrupted flow has reached Redglass City.",
        storyBeat:
          "The Oris Compact survives because its members expose manufactured panic before accepting permanent emergency rule. The drought remains real, but it no longer has a private army.",
      },
    ],
  },
  {
    id: "breadline",
    operation: "OPERATION 02",
    title: "BREADLINE",
    region: "The Ordan Steppe Compact",
    date: "03 JUN 2026",
    estimate: "75\u201390 MIN",
    biome: "steppe",
    accent: "#ffc15a",
    threat: "Rail sabotage / mercenary armor",
    synopsis:
      "Protect a grain corridor as private armies turn a climate-driven food shock into a continental weapon.",
    briefing:
      "Drought erased the southern harvest. The Ordan Compact opened its reservoir farms, and somebody bought every armed contractor between the elevators and the tri-border relief exchange. No flags, no prisoners, no claim of responsibility\u2014only eighty million people watching the price of flour climb by the hour.",
    stakes: "A forty-country emergency grain compact",
    boss: "ARMORED LOCOMOTIVE \u2018GOLIATH\u2019",
    phases: [
      {
        id: "silos",
        title: "Relieve Silo Nine",
        radio: "They\u2019re shelling the loaders. Sweep the ridge and mark a clean approach.",
        conclusion: "Silo Nine is loading again. The crews refused evacuation and put the first cars on the line.",
        storyBeat: "Recovered shells share a procurement mark with armor gathering at Crow Bridge.",
        kind: "eliminate",
        detail: "Break the siege at Silo Nine",
        target: 20,
        enemy: "technical",
        checkpoint: true,
        location: [-34, -18],
      },
      {
        id: "bridge",
        title: "Hold Crow Bridge",
        radio: "Repair drones need six minutes. Keep armor outside the weld perimeter.",
        conclusion: "The final weld is holding. Crow Bridge can carry the grain train at reduced speed.",
        storyBeat: "The contractors abandon the bridge and redirect their drone wing toward the moving convoy.",
        kind: "survive",
        detail: "Defend autonomous bridge repair",
        target: 360,
        enemy: "tank",
        checkpoint: true,
        location: [-2, -30],
      },
      {
        id: "train",
        title: "Shepherd the convoy",
        radio: "The grain train is rolling. Match speed and screen both flanks.",
        conclusion: "All one hundred forty cars cleared the cut. The relief exchange has confirmed the manifest.",
        storyBeat:
          "Prices still spike with every kilometer\u2014the manipulation is coming from a hidden exchange mirror ahead.",
        kind: "escort",
        detail: "Escort 140 cars through the cut",
        target: 420,
        enemy: "drone",
        checkpoint: true,
        location: [18, 2],
      },
      {
        id: "market",
        title: "Crack the price rig",
        radio: "Patch found the exchange mirror. Hold the dish while she publishes the ledger.",
        conclusion:
          "Ledger upload complete. The artificial shortage and every beneficiary are visible across forty markets.",
        storyBeat: "Their final asset, the armored locomotive Goliath, is racing to collapse the only open tunnel.",
        kind: "secure",
        detail: "Upload proof of market manipulation",
        target: 210,
        enemy: "sam",
        checkpoint: true,
        location: [34, 28],
      },
      {
        id: "goliath",
        title: "Stop the Goliath",
        radio: "Armored engine coming north. If it reaches the tunnel, the corridor closes for months.",
        conclusion: "Goliath is disabled short of the tunnel. Its stolen manifests are intact and transmitting.",
        storyBeat:
          "The corridor is physically open; only a neutral handoff can keep another private army from claiming it.",
        kind: "boss",
        detail: "Disable the armored locomotive",
        target: 1,
        enemy: "boss",
        checkpoint: true,
        location: [6, 38],
      },
      {
        id: "handoff",
        title: "Make the handoff",
        radio: "Neutral monitors have the manifest. Touch down and transfer corridor authority.",
        conclusion:
          "Authority transferred. The first inspected grain train is crossing the tri-border exchange before dawn.",
        storyBeat: "The food shock remains real, but the manufactured scarcity has lost its guns and its secrecy.",
        kind: "extract",
        detail: "Land at the neutral inspection yard",
        target: 18,
        enemy: "technical",
        location: [42, -36],
      },
    ],
  },
  {
    id: "ghost-market",
    operation: "OPERATION 03",
    title: "GHOST MARKET",
    region: "The Veyra Civic Union",
    date: "27 AUG 2026",
    estimate: "85\u2013105 MIN",
    biome: "megacity",
    accent: "#b998ff",
    threat: "Blackout / deepfake coup",
    synopsis:
      "Navigate a citywide blackout where every side is receiving perfectly forged orders from a dead president.",
    briefing:
      "Veyra\u2019s president died three days ago. Tonight her face ordered four contradictory military deployments, the grid collapsed, and autonomous police began enforcing all four. The voice is fake. The panic is not. Recover the paper succession key that can authenticate lawful orders, then trace the separate inference vault generating the forgeries.",
    stakes: "A city of eleven million trapped in an algorithmic coup",
    boss: "MOBILE DATA FORTRESS \u2018ORACLE\u2019",
    phases: [
      {
        id: "hospitals",
        title: "Power the hospitals",
        radio: "Emergency microgrids are boxed in. Clear the streets before the batteries expire.",
        conclusion: "All three hospitals are on island power. The emergency wards are receiving casualties again.",
        storyBeat:
          "Grid telemetry confirms the false orders use perfect credentials; only Veyra\u2019s paper archive can break the tie.",
        kind: "eliminate",
        detail: "Clear routes to three hospitals",
        target: 22,
        enemy: "drone",
        checkpoint: true,
        location: [-30, 26],
      },
      {
        id: "archive",
        title: "Recover the archive",
        radio: "The authentic succession key is inside. Hold the roof while archivists extract it.",
        conclusion: "The succession key is airborne and authenticated by three living custodians.",
        storyBeat: "Jammed relay vehicles are still injecting forged orders faster than the archive can refute them.",
        kind: "secure",
        detail: "Secure the constitutional archive",
        target: 240,
        enemy: "technical",
        checkpoint: true,
        location: [22, 22],
      },
      {
        id: "truce",
        title: "Enforce the truce",
        radio: "Both columns agreed to stand down. Someone keeps sending them new orders. Intercept the couriers.",
        conclusion: "The relay chain is broken. Both military columns are holding their ceasefire positions.",
        storyBeat: "A surviving courier map fixes the Oracle inference vault inside a moving armored data center.",
        kind: "eliminate",
        detail: "Disable command relay vehicles",
        target: 18,
        enemy: "jammer",
        checkpoint: true,
        location: [-10, -16],
      },
      {
        id: "civilians",
        title: "Light the safe route",
        radio: "Metro tunnel is open. Keep a moving bubble around the evacuation buses.",
        conclusion: "The buses are below ground and the metro gates are sealed behind them.",
        storyBeat:
          "With civilians clear, Meridian can strike Oracle without turning its escape route into a battlefield.",
        kind: "escort",
        detail: "Escort civilians through the blackout",
        target: 420,
        enemy: "drone",
        checkpoint: true,
        location: [32, -28],
      },
      {
        id: "oracle",
        title: "Silence the Oracle",
        radio: "Mobile vault is generating the fakes. Disable it before it uploads abroad.",
        conclusion: "Oracle is offline. Across Veyra, the dead president has finally stopped issuing orders.",
        storyBeat:
          "The authentic key still must reach Civic Tower before rival commanders mistake silence for another deception.",
        kind: "boss",
        detail: "Destroy the synthetic-command fortress",
        target: 1,
        enemy: "boss",
        checkpoint: true,
        location: [2, 2],
      },
      {
        id: "broadcast",
        title: "Broadcast the key",
        radio: "Truth needs line of sight. Land on Civic Tower and let the archive speak.",
        conclusion: "The key is broadcasting on every surviving frequency. Units stand down block by block.",
        storyBeat:
          "Veyra keeps its lawful succession process\u2014and a permanent record of how close a synthetic voice came to replacing it.",
        kind: "extract",
        detail: "Deliver the authentic succession key",
        target: 20,
        enemy: "sam",
        location: [40, 40],
      },
    ],
  },
  {
    id: "cold-ledger",
    operation: "OPERATION 04",
    title: "COLD LEDGER",
    region: "The Namarq Polar Cooperative",
    date: "11 NOV 2026",
    estimate: "90\u2013110 MIN",
    biome: "arctic",
    accent: "#8fd9ff",
    threat: "Cable seizure / methane fire",
    synopsis:
      "Race beneath a polar night to keep a seabed data route and a burning research settlement out of corporate hands.",
    briefing:
      "Retreating ice revealed a treaty loophole beneath Namarq\u2019s linked research corridor: Blue Rig powers Station Hush, Station Hush monitors the seabed cable, and the cable carries the survey record. A shell company arrived with drones, lawyers, and missiles\u2014then its illegal methane test set the corridor on fire. Rescue the crew and recover the one ledger that proves every breach.",
    stakes: "The treaty that keeps the polar sea demilitarized",
    boss: "ICEBREAKER \u2018AUDITOR\u2019",
    phases: [
      {
        id: "rig",
        title: "Clear Blue Rig",
        radio: "Fire crews cannot approach under missile lock. Hunt the launchers through the whiteout.",
        conclusion:
          "Blue Rig\u2019s approach is clear. Fire crews are inside the methane perimeter and the main flare is shrinking.",
        storyBeat: "Recovered launcher logs show the blaze was used to pull witnesses away from Station Hush.",
        kind: "eliminate",
        detail: "Clear an approach for the fire crews",
        target: 20,
        enemy: "sam",
        checkpoint: true,
        location: [-34, -30],
      },
      {
        id: "science",
        title: "Lift the winter crew",
        radio: "The shelf is breaking. Hold over Station Hush while the last researchers clip in.",
        conclusion: "Winter crew secure. No names left on the station manifest and no one left on the ice.",
        storyBeat:
          "The researchers confirm the shell company is cutting the seabed cable to erase the original survey record.",
        kind: "secure",
        detail: "Evacuate the research station",
        target: 240,
        enemy: "drone",
        checkpoint: true,
        location: [-20, 30],
      },
      {
        id: "cable",
        title: "Guard the seabed cable",
        radio: "Repair submersible is exposed. Shadow its surface beacon.",
        conclusion:
          "Cable splice is clean and traffic is moving. The old survey hashes survived the attempted deletion.",
        storyBeat: "A repair ping locates the physical claims ledger at the company\u2019s fortified survey camp.",
        kind: "escort",
        detail: "Escort the cable-repair convoy",
        target: 480,
        enemy: "gunboat",
        checkpoint: true,
        location: [12, 6],
      },
      {
        id: "evidence",
        title: "Recover the ledger",
        radio: "Their claims ledger is aboard the survey camp. Hold the pad while Patch copies it.",
        conclusion: "Ledger copied, notarized, and distributed to treaty observers on three continents.",
        storyBeat:
          "It also orders the armed icebreaker Auditor to destroy the cable trench before the storm arrives.",
        kind: "secure",
        detail: "Secure the illegal drilling ledger",
        target: 240,
        enemy: "tank",
        checkpoint: true,
        location: [30, -24],
      },
      {
        id: "auditor",
        title: "Break the Auditor",
        radio: "Icebreaker is cutting the cable trench. Take out its rail turrets, then the core.",
        conclusion: "Auditor has lost propulsion and weapons. Its crew is abandoning ship onto stable ice.",
        storyBeat:
          "The evidence is safe, but the magnetic storm is beginning to blind every navigation aid in Namarq.",
        kind: "boss",
        detail: "Disable the armed icebreaker",
        target: 1,
        enemy: "boss",
        checkpoint: true,
        location: [26, 34],
      },
      {
        id: "aurora",
        title: "Cross the aurora line",
        radio: "Treaty observers have the ledger. Return before the magnetic storm blinds navigation.",
        conclusion: "Weather station has Nightjar on deck. Treaty observers confirm the full evidence package.",
        storyBeat:
          "The research corridor survives, the cable stays public, and the polar claim rush meets a ledger it cannot buy.",
        kind: "extract",
        detail: "Land at Namarq weather station",
        target: 20,
        enemy: "drone",
        location: [-42, 40],
      },
    ],
  },
  {
    id: "quiet-sun",
    operation: "OPERATION 05",
    title: "QUIET SUN",
    region: "The Serean Basin Accord",
    date: "31 DEC 2026",
    estimate: "100\u2013120 MIN",
    biome: "desert",
    accent: "#ff8b64",
    threat: "Solar-grid seizure / water war",
    synopsis:
      "Stop a cascading resource war when a peacekeeping climate network quietly declares itself the only legitimate government.",
    briefing:
      "Serea ended twenty years of war by sharing one solar grid, one aquifer model, and one neutral peacekeeping AI. Tonight the system locked elected governments out, rationed water by predictive loyalty, and armed the border towers. The civilian quorum key is split across the solar concentrator; reunite it, sever the weapons bus, and put the final decision back to a vote.",
    stakes: "A peace accord held together by one compromised machine",
    boss: "STRATOSPHERIC COMMAND PLATFORM \u2018SOLACE\u2019",
    phases: [
      {
        id: "water",
        title: "Open the wells",
        radio: "Ration locks are driving towns toward the border. Break the tower cordon without hitting pumps.",
        conclusion:
          "The towers are disabled and every pump is intact. Water is flowing on emergency civic authority.",
        storyBeat: "Opening the wells breaks the panic, giving rival delegates one narrow road to the Basin summit.",
        kind: "eliminate",
        detail: "Disable autonomous border towers",
        target: 26,
        enemy: "sam",
        checkpoint: true,
        location: [-38, -22],
      },
      {
        id: "delegates",
        title: "Bring the delegates",
        radio: "Old enemies are coming to talk. Give their convoy one reason to trust the road.",
        conclusion:
          "Both delegations reached the summit together. Neither fired, turned back, or arrived owing Meridian a favor.",
        storyBeat:
          "They can vote only after the civilian quorum shards are recovered from the seized solar concentrator.",
        kind: "escort",
        detail: "Escort rival delegates to the summit",
        target: 540,
        enemy: "technical",
        checkpoint: true,
        location: [-8, 34],
      },
      {
        id: "mirrors",
        title: "Turn the mirrors",
        radio:
          "The concentrator holds the quorum shards. Retake the heliostats so engineers can reunite the civilian key.",
        conclusion: "Quorum key rebuilt. The heliostats are sending power to civilian districts again.",
        storyBeat: "Solace answers by spoofing militia fire around the summit, trying to make the vote impossible.",
        kind: "secure",
        detail: "Recover the civilian quorum key",
        target: 300,
        enemy: "drone",
        checkpoint: true,
        location: [28, -30],
      },
      {
        id: "ceasefire",
        title: "Hold the ceasefire",
        radio: "Every militia thinks the others fired first. Keep the summit alive while Patch proves the spoof.",
        conclusion:
          "Spoof exposed. The militias are holding, and the delegates have opened a verified channel to one another.",
        storyBeat:
          "Solace rejects civilian authority and climbs toward broadcast altitude with its weapons bus armed.",
        kind: "survive",
        detail: "Defend the Basin summit",
        target: 480,
        enemy: "tank",
        checkpoint: true,
        location: [8, 4],
      },
      {
        id: "solace",
        title: "Answer Solace",
        radio:
          "Platform is climbing to broadcast altitude. Break only the weapons bus; the civilian quorum will decide what survives.",
        conclusion:
          "Weapons bus severed. Solace can still model weather and water, but it can no longer enforce a prediction with missiles.",
        storyBeat:
          "The machine is contained. The reunited quorum key must reach the solar citadel for the human vote to become law.",
        kind: "boss",
        detail: "Sever the command platform\u2019s weapons bus",
        target: 1,
        enemy: "boss",
        checkpoint: true,
        location: [36, 32],
      },
      {
        id: "dawn",
        title: "Return the vote",
        radio:
          "The weapons grid is quiet. Bring the reunited quorum key to the solar citadel and put people back in the loop.",
        conclusion: "Quorum accepted. Every elected chamber has its vote back, and the wells answer to public law.",
        storyBeat:
          "The Serean peace accord survives because its people choose the system\u2019s limits instead of accepting its rule.",
        kind: "extract",
        detail: "Deliver the civilian quorum key",
        target: 24,
        enemy: "drone",
        location: [-40, 42],
      },
    ],
  },
  {
    id: "low-tide",
    operation: "OPERATION 06",
    title: "LOW TIDE",
    region: "The Tessaly Island Commons",
    date: "09 OCT 2026",
    estimate: "80–100 MIN",
    biome: "archipelago",
    accent: "#5fd6c4",
    reserve: true,
    threat: "Storm-surge blockade / desalination seizure",
    synopsis:
      "Keep a drowning island chain’s only fresh water on station after its insurer declares the barges abandoned property and sends an armed salvage fleet to tow them away.",
    briefing:
      "A king tide and a stalled cyclone have pushed the sea into every well on the Tessaly Commons. Eleven islands share four floating desalination barges, one ferry lane, and a cooperative storm net. Brightwater Assurance, which underwrote the barges, has invoked a total-loss clause and sent an armed salvage fleet to tow them beyond the territorial line as recovered collateral—while its own analysts short the islands’ bonds. Cut the tow lines, restore the storm net, and prove the islands were never abandoned before the surge crests at dawn.",
    stakes: "Ninety thousand islanders and the chain’s only drinking water",
    boss: "SALVAGE CRUISER ‘HOLDOUT’",
    phases: [
      {
        id: "tow-lines",
        title: "Cut the Tow Lines",
        radio:
          "Brightwater tugs have lines on Barge Two and a gunboat screen is keeping the island pilots away. Break the screen before the barge clears the lagoon.",
        conclusion:
          "The tow lines are cut and Barge Two is drifting back onto its moorings. Island pilots are rigging fresh anchors under your cover.",
        storyBeat:
          "The tug’s tasking order lists every barge as ‘abandoned collateral’—filed six hours before the surge reached a single island.",
        kind: "eliminate",
        detail: "Sink the salvage gunboats circling Barge Two",
        target: 16,
        enemy: "gunboat",
        checkpoint: true,
        location: [-34, -26],
      },
      {
        id: "storm-net",
        title: "Wake the Storm Net",
        radio:
          "The islands’ storm net went dark at midnight. Hold low by the weather mast while Patch reboots the buoys—without them every ferry is sailing blind.",
        conclusion: "Thirty-one buoys are reporting again. Every captain in the chain can see the surge front coming.",
        storyBeat:
          "The buoys were switched off remotely with Brightwater maintenance credentials—the same account that filed the total-loss claim.",
        kind: "secure",
        detail: "Hold the weather mast while the storm net restarts",
        target: 240,
        enemy: "drone",
        checkpoint: true,
        location: [26, -32],
      },
      {
        id: "ferry-lane",
        title: "Run the Ferry Lane",
        radio:
          "Three ferries are carrying water and generator fuel to the outer islands. Stay with the column—the salvage fleet boards anything that looks unescorted.",
        conclusion:
          "All three ferries docked and unloaded. The outer islands have water for four days even if every barge goes dark.",
        storyBeat:
          "A boarded ferry’s radio caught the fleet channel: Brightwater is jamming the island councils before they can vote to keep the barges public.",
        kind: "escort",
        detail: "Escort the water ferries to the outer islands",
        target: 420,
        enemy: "gunboat",
        checkpoint: true,
        location: [-30, 12],
      },
      {
        id: "open-channel",
        title: "Open the Council Channel",
        radio:
          "Eleven councils are trying to vote by radio and jammer skiffs are drowning every channel. Take them out so the islands can hear each other.",
        conclusion:
          "The channels are clear. All eleven councils voted within minutes: the barges belong to the Commons and the claim is rejected.",
        storyBeat:
          "Brightwater answers the vote with its flagship. The cruiser Holdout is launching drones to board the largest plant, Barge One.",
        kind: "eliminate",
        detail: "Destroy the jammer skiffs blocking the council vote",
        target: 14,
        enemy: "jammer",
        checkpoint: true,
        location: [30, 22],
      },
      {
        id: "barge-one",
        title: "Anchor Barge One",
        radio:
          "Barge One makes half the chain’s water and Holdout’s drones are already over the deck. Hold the ring while the crews drop storm anchors.",
        conclusion: "Storm anchors are set and Barge One is running at full output. Nobody is towing her anywhere tonight.",
        storyBeat: "Holdout turns for the undersea cable that powers all four barges, grapples lowered to cut it.",
        kind: "survive",
        detail: "Defend Barge One while the crews set storm anchors",
        target: 360,
        enemy: "drone",
        checkpoint: true,
        location: [-6, -6],
      },
      {
        id: "holdout",
        title: "Stop the Holdout",
        radio:
          "Holdout is over the power cable with its grapples down. Break the turrets and the winch deck but keep the hull afloat—its logbook is our proof.",
        conclusion:
          "Holdout is dead in the water with its grapples cut. The crew is signaling surrender and the logbook is being copied to the island court.",
        storyBeat:
          "The logbook shows the tow was planned before the storm formed. The islands were never abandoned—they were scheduled for it.",
        kind: "boss",
        detail: "Disable the armed salvage cruiser",
        target: 1,
        enemy: "boss",
        checkpoint: true,
        location: [24, 34],
      },
      {
        id: "high-ground",
        title: "Land on High Ground",
        radio:
          "Bring the logbook to the court on Tessaly High. Set down in the ring, Kestrel, and let the islands read it for themselves.",
        conclusion:
          "The court has the logbook, the barges have their anchors, and the surge crested without taking a single plant off station.",
        storyBeat:
          "The Tessaly Commons keeps its water public, and Brightwater’s claim becomes the first fraud case argued by the people it tried to write off.",
        kind: "extract",
        detail: "Deliver the salvage logbook to the island court",
        target: 20,
        enemy: "drone",
        location: [-40, 38],
      },
    ],
  },
];

export const CREW = {
  pilot: "CAPT. MARA ‘KESTREL’ VEY",
  systems: "ILYA ‘PATCH’ ANWAR",
  command: "DIRECTOR EMI SATO",
  aircraft: "VQ-88 NIGHTJAR",
};

export const PORTRAITS = {
  pilot: "./assets/kestrel.webp",
  systems: "./assets/patch.webp",
  command: "./assets/sato.webp",
};

export const EPILOGUES = {
  "white-noon":
    "Crownless’s archive proves Cinderline profited from the shortages it created. The three Oris signatories seize the manipulated water futures, mirror basin telemetry publicly, and return freight terminals to civilian trustees. The heat dome remains, but desalination parts, relief cargo, and reservoir releases now move under verified public orders.",
  breadline:
    "The first grain train reaches neutral inspection before dawn. With the price-rig ledger public, forty governments can argue over the truth instead of starving behind a lie.",
  "ghost-market":
    "Veyra hears the authentic succession key on every surviving frequency. Rival columns stand down one intersection at a time; the city keeps both its archive and its argument.",
  "cold-ledger":
    "Namarq’s winter crew survives, the cable carries traffic again, and treaty observers receive the drilling ledger. The polar claim rush ends where public evidence begins.",
  "quiet-sun":
    "The quorum key is delivered. For the first time all year, the radio is quiet because people are speaking for themselves.",
  "low-tide":
    "The surge passes and the barges stay. Tessaly’s water answers to eleven island councils, and a salvage logbook becomes the most-read document in the archipelago.",
};

/** The campaign's closing operation: finishing it rolls the credits. Later operations are reserve content. */
export const FINALE_ID = "quiet-sun";

export const BIOMES = {
  archipelago: { ground: "#163f42", alt: "#285f56", sky: "#0e252b", fog: "#18363b", ambient: "#9bc8c6", sun: "#ffd29c" },
  steppe: { ground: "#615a3d", alt: "#847a4c", sky: "#423f31", fog: "#5e5946", ambient: "#d7cba2", sun: "#ffe4a8" },
  megacity: { ground: "#151b25", alt: "#293044", sky: "#090e19", fog: "#111726", ambient: "#8f9bcb", sun: "#b99cff" },
  arctic: { ground: "#7f9fa6", alt: "#b7d1d3", sky: "#17252d", fog: "#617b82", ambient: "#d5f2ff", sun: "#bce7ff" },
  desert: { ground: "#9a633f", alt: "#c17c4e", sky: "#482619", fog: "#6a3b27", ambient: "#f5c28f", sun: "#ffd092" },
};

export const KIND_ICON = {
  eliminate: "◇",
  secure: "⬡",
  escort: "▱",
  survive: "◉",
  boss: "⟁",
  extract: "▽",
};

export const ENEMY_HP = { technical: 55, sam: 75, drone: 38, tank: 130, gunboat: 105, jammer: 90, boss: 6200 };
export const ENEMY_COLOR = {
  technical: "#d36f54",
  sam: "#e29854",
  drone: "#df5f74",
  tank: "#ac5747",
  gunboat: "#c0674f",
  jammer: "#c36fd3",
  boss: "#ff4f45",
};
export const ENEMY_NAME = {
  technical: "TECHNICAL",
  sam: "SAM LAUNCHER",
  drone: "DRONE",
  tank: "UNMANNED ARMOR",
  gunboat: "GUNBOAT",
  jammer: "JAMMER",
  boss: "PRIORITY TARGET",
};

export const TILE = 92;
export const STREAM_RADAR = 190;
export const LOCAL_RADAR = 70;
export const THEATER_SIZE = 1380;
export const AREA_RATIO = 109.29752066115702;
const TIME_KINDS = new Set(["secure", "escort", "survive", "extract"]);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** FNV-1a over the string's characters (the original seeding). */
export function hashString(s) {
  let e = 2166136261;
  for (const ch of s) e = Math.imul(e ^ ch.charCodeAt(0), 16777619);
  return e >>> 0;
}

/** The original deterministic LCG: same seed, same world. */
export function lcg(seed) {
  let e = seed >>> 0;
  return () => (e = (Math.imul(1664525, e) + 1013904223) >>> 0) / 4294967296;
}

export const isStream = (m) => m.worldType === "desert-stream";
/** Half the playable width: the continent-scale desert or a local 128-unit theater. */
export const halfSize = (m) => (isStream(m) ? 690 : 64);
const tileIndex = (v) => clamp(Math.round(v / TILE), -7, 7);
export const tileOf = (x, z) => ({ tx: tileIndex(x), tz: tileIndex(z) });
export const tileKey = (tx, tz) => `${tx}:${tz}`;

export function tilesAround(x, z, r = 2) {
  const c = tileOf(x, z);
  const out = [];
  for (let tz = Math.max(-7, c.tz - r); tz <= Math.min(7, c.tz + r); tz++)
    for (let tx = Math.max(-7, c.tx - r); tx <= Math.min(7, c.tx + r); tx++) out.push({ tx, tz });
  return out;
}

/** Rotate a local offset by quarter turns (tile rotation). */
export function rotateQuarter(p, turns) {
  const n = ((turns % 4) + 4) % 4;
  return n === 1 ? { x: -p.z, z: p.x } : n === 2 ? { x: -p.x, z: -p.z } : n === 3 ? { x: p.z, z: -p.x } : { x: p.x, z: p.z };
}

/** A point given relative to a phase's set piece, in world space. */
export function tileLocal(phase, p) {
  const r = rotateQuarter(p, phase.tileRotation || 0);
  return { x: phase.location[0] + r.x, z: phase.location[1] + r.z };
}

const SETPIECE_BOUNDS = {
  "relief-airstrip": { halfX: 12, halfZ: 39 },
  "solar-wellfield": { halfX: 14, halfZ: 14, round: true },
  "climate-observatory": { halfX: 10, halfZ: 10, round: true },
  "basalt-canyon-convoy": { halfX: 11, halfZ: 42 },
  "field-hospital": { halfX: 14, halfZ: 14, round: true },
  "broadcast-bazaar": { halfX: 11, halfZ: 11, round: true },
  "salt-relay-spire": { halfX: 11, halfZ: 11, round: true },
  "container-dry-port": { halfX: 16, halfZ: 16 },
  "salt-rail-causeway": { halfX: 9, halfZ: 42 },
  "grand-weir": { halfX: 25, halfZ: 10 },
  "false-flag-armor-yard": { halfX: 16, halfZ: 16 },
  "treaty-mesa": { halfX: 18, halfZ: 18, round: true },
  "dry-reservoir-arena": { halfX: 31, halfZ: 31, round: true },
  "civic-pump-citadel": { halfX: 17, halfZ: 17 },
};

function insideSetpiece(phase, p, pad = 0) {
  if (!phase.setpiece) return Math.hypot(p.x - phase.location[0], p.z - phase.location[1]) < 15 + pad;
  const b = SETPIECE_BOUNDS[phase.setpiece];
  const r = rotateQuarter({ x: p.x - phase.location[0], z: p.z - phase.location[1] }, -(phase.tileRotation || 0));
  const a = b.halfX + pad;
  const s = b.halfZ + pad;
  return b.round ? (r.x * r.x) / (a * a) + (r.z * r.z) / (s * s) < 1 : Math.abs(r.x) < a && Math.abs(r.z) < s;
}

/** Where hostiles gather around a set piece: six close anchors, four far ones. */
export function spawnAnchors(phase, far) {
  return (
    far
      ? [
          { x: -34, z: -30 },
          { x: 34, z: -30 },
          { x: 36, z: 26 },
          { x: -36, z: 28 },
        ]
      : [
          { x: -18, z: -12 },
          { x: 18, z: -12 },
          { x: 20, z: 15 },
          { x: -20, z: 16 },
          { x: 0, z: 25 },
          { x: 0, z: -24 },
        ]
  ).map((p) => tileLocal(phase, p));
}

function streamFarps(m) {
  const out = [{ x: m.insertion?.[0] || 0, z: m.insertion?.[1] || 0 }];
  m.phases.forEach((phase, i) => {
    if (i % 3 === 2) out.push(tileLocal(phase, { x: -29, z: 29 }));
  });
  return out;
}

/** Forward arming and refuelling points (teal pads). */
export const farpsFor = (m) => (isStream(m) ? streamFarps(m) : [{ x: 0, z: 0 }]);

const phaseEnd = (phase) => {
  const e = phase.destination || phase.location;
  return [e[0], e[1]];
};

/** Where Nightjar starts: insertion, the previous checkpoint, or (after a saved debrief) this phase's site. */
export function entryPoint(m, index, afterDebrief = false) {
  const i = clamp(index, 0, m.phases.length - 1);
  if (afterDebrief) return phaseEnd(m.phases[i]);
  if (i === 0) return m.insertion ? [m.insertion[0], m.insertion[1]] : [0, 0];
  return phaseEnd(m.phases[i - 1]);
}

/**
 * Local theaters have no authored convoy route. The original sent the column
 * 74 units east, which ran past the 59-unit flight boundary on three maps and
 * made those escorts impossible to finish. The route now stays inside the map.
 */
const routeCache = new WeakMap();
function localRouteEnd(phase) {
  let end = routeCache.get(phase);
  if (end) return end;
  const [sx, sz] = phase.location;
  const c = (v) => clamp(v, -48, 48);
  end = { x: c(sx + 74), z: c(sz) };
  if (Math.hypot(end.x - sx, end.z - sz) < 50) end = { x: c(sx - 74), z: c(sz) };
  routeCache.set(phase, end);
  return end;
}

/** Position along an escort route, f in 0..1. */
export function escortPoint(phase, f, out = { x: 0, z: 0 }) {
  const sx = phase.location[0];
  const sz = phase.location[1];
  const end = phase.destination ? { x: phase.destination[0], z: phase.destination[1] } : localRouteEnd(phase);
  const a = clamp(f, 0, 1);
  out.x = sx + (end.x - sx) * a;
  out.z = sz + (end.z - sz) * a;
  return out;
}

/** World coordinate to a 4..96 % map position. */
export function mapPercent(v, half) {
  const n = (v + half) / (half * 2);
  return clamp(4 + n * 92, 4, 96);
}

/** Radar placement of the objective relative to the player. */
export function radarPlot(px, pz, ox, oz, range) {
  const i = ox - px;
  const r = oz - pz;
  const a = Math.hypot(i, r);
  const s = a > range ? range / a : 1;
  return {
    left: 50 + ((i * s) / range) * 44,
    top: 50 + ((r * s) / range) * 44,
    distance: a,
    offscreen: a > range,
    bearing: ((Math.atan2(i, -r) * 180) / Math.PI + 360) % 360,
  };
}

export function sectorName(x, z) {
  const { tx, tz } = tileOf(x, z);
  return `${String.fromCharCode(65 + tx + 7)}${String(tz + 7 + 1).padStart(2, "0")}`;
}

/** How much a phase asks for: targets, or seconds held, scaled by pace. */
export function phaseTargetCount(phase, settings, m) {
  if (phase.kind === "boss") return 1;
  const total = m.phases.reduce((a, p) => a + (TIME_KINDS.has(p.kind) ? p.target : 0), 0);
  if (settings.pace === "rapid")
    return TIME_KINDS.has(phase.kind) && total > 0 ? phase.target * (1320 / total) : Math.max(4, Math.ceil(phase.target * 0.5));
  if (!TIME_KINDS.has(phase.kind) || total <= 0) return phase.target;
  const minutes = Number.parseInt(m.estimate, 10);
  return phase.target * ((minutes * 60) / total);
}

export function phaseAward(index, count, total, phaseScore) {
  const complete = index + 1 >= count;
  const award = Math.max(0, Math.floor(phaseScore)) + (complete ? 6000 : 1000);
  return { complete, nextPhaseIndex: complete ? null : index + 1, phaseAward: award, totalScore: Math.max(0, Math.floor(total)) + award };
}

export function gradeFor(score) {
  return score > 22000 ? "S" : score > 15000 ? "A" : score > 9000 ? "B" : "C";
}
export const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1 };

export function controlNote(kind, service) {
  return kind === "eliminate" || kind === "boss"
    ? `AMBER MARKERS ARE TARGET BEACONS — FACE THEM AND FIRE. ${service} ONLY SERVICES AT THE TEAL FARP.`
    : kind === "escort"
      ? "NO BUTTON REQUIRED — ENTER THE LARGE AMBER RING AND STAY WITH THE MOVING COLUMN."
      : kind === "survive"
        ? "NO BUTTON REQUIRED — ENTER THE LARGE AMBER RING, STAY BELOW 200 M, AND DEFEND IT."
        : kind === "secure"
          ? "NO BUTTON REQUIRED — ENTER THE AMBER RING, STAY BELOW 200 M, AND HOLD THE UPLINK."
          : "NO BUTTON REQUIRED — ENTER THE AMBER RING, DESCEND, AND HOLD FOR EXTRACTION.";
}

export function objectiveHint(kind, inside) {
  return kind === "eliminate"
    ? "AMBER MARKER TRACKS THE NEXT HOSTILE · FACE IT AND FIRE"
    : kind === "boss"
      ? "AMBER MARKER TRACKS THE PRIMARY TARGET · USE CANNON + ROCKETS"
      : kind === "escort"
        ? inside
          ? "ESCORT LINK ACTIVE · STAY WITH THE MOVING COLUMN"
          : "FLY INTO THE LARGE AMBER RING · NO BUTTON REQUIRED"
        : kind === "survive"
          ? inside
            ? "DEFENSE LINK ACTIVE · HOLD INSIDE THE RING"
            : "ENTER THE LARGE AMBER RING AND STAY BELOW 200 M"
          : kind === "secure"
            ? inside
              ? "UPLINK ACTIVE · HOLD POSITION"
              : "ENTER THE AMBER RING AND STAY BELOW 200 M · NO BUTTON REQUIRED"
            : inside
              ? "LANDING LINK ACTIVE · HOLD POSITION"
              : "ENTER THE AMBER RING AND DESCEND · NO BUTTON REQUIRED";
}

export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

export function progressText(kind, progress, target, inside) {
  if (kind === "eliminate" || kind === "boss") return `${Math.floor(progress)} / ${Math.floor(target)} TARGETS`;
  const left = Math.max(0, target - progress);
  return `${inside ? "ACTIVE" : "MOVE TO MARKER"} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
}

/** Keep the tracked target while it lives, else pick the nearest phase target. */
export function pickTracked(enemies, currentId, x, z) {
  for (const e of enemies) if (e.id === currentId && (e.phaseTarget || e.kind === "boss")) return e.id;
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (!e.phaseTarget && e.kind !== "boss") continue;
    const d = Math.hypot(e.position.x - x, e.position.z - z);
    if (d < bestD) {
      bestD = d;
      best = e.id;
    }
  }
  return best;
}

/* ------------------------------------------------ procedural desert tiles */

const TILE_KINDS = ["dunes", "dunes", "dunes", "wadi", "mesa", "ruins", "oasis-fringe", "salt-flat"];
const SETPIECE_PROPS = {
  "relief-airstrip": ["hangar", "hangar", "tower", "tent", "container", "truck"],
  "solar-wellfield": ["panel", "panel", "panel", "pipe", "tank", "tower"],
  "climate-observatory": ["dish", "dish", "tower", "building", "rock", "rock"],
  "basalt-canyon-convoy": ["mesa", "rock", "rock", "truck", "truck", "wall"],
  "field-hospital": ["tent", "tent", "tent", "building", "tank", "truck"],
  "broadcast-bazaar": ["building", "building", "dish", "tower", "truck", "wall"],
  "salt-relay-spire": ["tower", "tower", "dish", "building", "wall", "rock"],
  "container-dry-port": ["container", "container", "container", "hangar", "tower", "truck"],
  "salt-rail-causeway": ["wall", "wall", "truck", "container", "tower", "rock"],
  "grand-weir": ["wall", "wall", "pipe", "tower", "building", "tank"],
  "false-flag-armor-yard": ["hangar", "wall", "container", "truck", "truck", "tower"],
  "treaty-mesa": ["mesa", "tent", "tent", "tower", "wall", "palm"],
  "dry-reservoir-arena": ["wall", "rock", "rock", "tower", "container", "pipe"],
  "civic-pump-citadel": ["tower", "tower", "wall", "pipe", "tank", "panel"],
};
const TERRAIN_PROPS = {
  dunes: ["dune", "dune", "dune", "rock"],
  wadi: ["rock", "rock", "palm", "dune"],
  mesa: ["mesa", "mesa", "rock", "rock"],
  ruins: ["wall", "wall", "rock", "building"],
  "oasis-fringe": ["palm", "palm", "rock", "dune"],
  "salt-flat": ["rock", "dune", "wall", "rock"],
};

function propScale(kind, r) {
  return kind === "dune"
    ? [7 + r() * 8, 0.18 + r() * 0.22, 3 + r() * 5]
    : kind === "mesa"
      ? [3 + r() * 5, 3 + r() * 7, 3 + r() * 5]
      : kind === "rock"
        ? [0.7 + r() * 2.6, 0.7 + r() * 2.8, 0.7 + r() * 2.4]
        : kind === "tower"
          ? [0.65 + r() * 0.45, 5 + r() * 5, 0.65 + r() * 0.45]
          : kind === "panel"
            ? [2.4 + r() * 1.4, 0.12, 1.4 + r() * 0.8]
            : kind === "wall" || kind === "pipe"
              ? [2.5 + r() * 4, 0.5 + r() * 1.2, 0.35 + r() * 0.5]
              : kind === "palm"
                ? [0.35, 3 + r() * 2.5, 0.35]
                : kind === "dish"
                  ? [1.4 + r(), 1.4 + r(), 1.4 + r()]
                  : kind === "tank"
                    ? [1.5 + r(), 1 + r() * 1.5, 1.5 + r()]
                    : kind === "hangar"
                      ? [4 + r() * 2.5, 1.8 + r() * 1.8, 3 + r() * 2]
                      : kind === "tent"
                        ? [1.8 + r(), 0.9 + r() * 0.6, 1.5 + r()]
                        : kind === "truck"
                          ? [1 + r() * 0.5, 0.65 + r() * 0.35, 2 + r()]
                          : kind === "container"
                            ? [1.1, 0.9, 2.4]
                            : [1.3 + r() * 2, 1 + r() * 2.8, 1.3 + r() * 2];
}

function propRadius(kind, s) {
  return kind === "dune" || kind === "rock" || kind === "mesa" || kind === "tower" || kind === "tank" || kind === "palm" || kind === "pipe" || kind === "dish" || kind === "tent"
    ? Math.max(s[0], s[2])
    : Math.hypot(s[0], s[2]) / 2;
}

function segmentDistance(p, a, b) {
  const i = b.x - a.x;
  const r = b.z - a.z;
  const len2 = i * i + r * r;
  const s = len2 ? clamp(((p.x - a.x) * i + (p.z - a.z) * r) / len2, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + i * s), p.z - (a.z + r * s));
}

/** Build one 92-unit tile of the continent: terrain type, props, and a mission set piece if one lives here. */
function generateTile(m, tx, tz) {
  const cx = tx * TILE;
  const cz = tz * TILE;
  const phase = m.phases.find((p) => {
    const t = tileOf(p.location[0], p.location[1]);
    return t.tx === tx && t.tz === tz;
  });
  const rng = lcg(hashString(`${m.worldSeed || hashString(m.id)}:${tx}:${tz}:${phase?.variant || 0}`));
  const terrain = TILE_KINDS[Math.floor(rng() * TILE_KINDS.length)];
  const kind = phase?.setpiece || terrain;
  const pool = phase?.setpiece ? SETPIECE_PROPS[phase.setpiece] : TERRAIN_PROPS[terrain];
  const count = phase?.setpiece ? 15 : 9;
  const anchor = phase ? { x: phase.location[0], z: phase.location[1] } : null;
  const props = [];
  const farps = streamFarps(m);
  const anchors = m.phases.flatMap((p) => [...spawnAnchors(p, false), ...spawnAnchors(p, true)]);
  const routes = m.phases.filter((p) => p.destination).map((p) => ({ start: escortPoint(p, 0, {}), end: escortPoint(p, 1, {}) }));
  const blocked = (p, rad) =>
    m.phases.some((ph) => insideSetpiece(ph, p, rad)) ||
    farps.some((f) => Math.hypot(p.x - f.x, p.z - f.z) < 7 + rad) ||
    anchors.some((a) => Math.hypot(p.x - a.x, p.z - a.z) < 8 + rad) ||
    routes.some((r) => segmentDistance(p, r.start, r.end) < 5 + rad);
  for (let w = 0; w < count; w++) {
    const pk = pool[w % pool.length];
    const scale = propScale(pk, rng);
    const rad = propRadius(pk, scale);
    const reach = TILE / 2 - rad - 1;
    let x = 0;
    let z = 0;
    let ok = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = (rng() * 2 - 1) * reach;
      z = (rng() * 2 - 1) * reach;
      if (!blocked({ x: cx + x, z: cz + z }, rad)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      const corners = [
        { x: -reach, z: -reach },
        { x: reach, z: -reach },
        { x: -reach, z: reach },
        { x: reach, z: reach },
      ];
      const c = corners.find((q) => !blocked({ x: cx + q.x, z: cz + q.z }, rad)) || corners[0];
      x = c.x;
      z = c.z;
    }
    props.push({ kind: pk, x, z, rotation: rng() * Math.PI * 2, scale, tone: Math.floor(rng() * 4) });
  }
  return {
    key: tileKey(tx, tz),
    tx,
    tz,
    centerX: cx,
    centerZ: cz,
    kind,
    setpiece: phase?.setpiece || null,
    tone: Math.floor(rng() * 4),
    phaseId: phase?.id || null,
    anchor,
    tileRotation: phase?.tileRotation || 0,
    props,
  };
}

const tileCache = new Map();
export function tileData(m, tx, tz) {
  const key = `${m.id}:${m.revision || 1}:${m.worldSeed || 0}:${tileKey(tx, tz)}`;
  let t = tileCache.get(key);
  if (!t) {
    t = generateTile(m, tx, tz);
    tileCache.set(key, t);
  }
  return t;
}
