/**
 * Neon Skies — campaign content: the 36 operations (with the supplied guide's
 * field notes), 21 airframes, 14 weapons, three original side operations,
 * source-continuity notes and the complete user-supplied guide text.
 */

export const MISSIONS = [
    {
      id: 1,
      title: "Transport",
      location: "Expo City",
      difficulty: "2/10",
      recommended: "EF2000E Typhoon II",
      unlock: "MiG-33 Fulcrum SS",
      source: `- **Location:** Expo City
- **Guide code:** WK01

> **Walkthrough difficulty:** Normal (medium).

- **Difficulty:** 2/10
- **Recommended:** EF2000E Typhoon II
- **Unlock:** MiG-33 Fulcrum SS

Only the EF2000E is unlocked initially and that son of a gun's a dogfighter, which should help against the slower soon-to-be-destroyed transports flying over restricted airspace. Weapons can't be changed yet...

> **Heads-up:** To unlock the thirty-sixth mission, you (the player) must obtain A- and B-ranks in all other (35) missions! Now's a good time to start... The Mission Simulator is unlocked only by beating the game on Normal, however!

Long-time veterans should have the controls down pat, especially if they've played later PS2 installments in the series -- they're basically the same. Rookie pilots should use this chance to get familiarized, however. One thing that differs from the newer AC games is that these planes are FAST...like, 2000+ m.p.h fast. When you're coming up behind a target, be careful not too zoom past and waste missiles when the lock-on appears, as it's quite easy to do so until y'get the hang of things. Similarly, if you brake too hard the craft will stall and point nose-first at the ground, rather than a slow plummet. If you're flying too low and y'stall, there won't be time enough to recover speed and the army medics will be collecting you in tiny bite-sized bits later on.

As for the mission itself, the first is always the easiest and this one's no different. The R-501 transports are slow and lumbering, unable to fight back. Their escort fighters (R201s) can definitely fight back but usually cruise at about 1500 m.p.h. so that speed often lends itself to their missed attempts. If the first four targets are not defeated within a reasonable time (3:00), then the mission update's skipped and this run gets an automatic "D" ranking.

#### Mission update

With the transports deep-sixed, reinforcements will come from the south. One target (R-101) and a bunch of similar escorts will try to engage the player in some dogfighting as retribution for destroying their transports. There's not a lot of challenge to this part; it's more of an introduction to the many mission updates to follow. However, flying right into the sun is always gonna be annoying...

#### A-rank requirement / strategy

Unlock: MiG-33 Fulcrum SS

Defeat the first four targets in under 3:00 to get the mission update, then defeat the final target. During all of this, defeat five other non-target escorts to get "A" rank. At least five normal fighters appear in the update portion, so feel free to ignore the others in the 1st part to cut down on time. [The timer doesn't factor into the mission update part, mind you.]

Since there's no score system like in future ACs, a lot of the extra "oomph" to hit a certain rank is done on a kill-based system. For instance, killing five-plus bogies earns an "A"; killing two would earn a "C".

#### Mission roster

- **x04 R-501** \u2014 Default
- **x01 R-101** \u2014 Default
- **x05 R-201** \u2014 Default [x3 Mission Update]
- **x02 R-101** \u2014 Mission Update`,
      rankGuide: `Unlock: MiG-33 Fulcrum SS

Defeat the first four targets in under 3:00 to get the mission update, then defeat the final target. During all of this, defeat five other non-target escorts to get "A" rank. At least five normal fighters appear in the update portion, so feel free to ignore the others in the 1st part to cut down on time. [The timer doesn't factor into the mission update part, mind you.]

Since there's no score system like in future ACs, a lot of the extra "oomph" to hit a certain rank is done on a kill-based system. For instance, killing five-plus bogies earns an "A"; killing two would earn a "C".`,
      roster: [
        { count: 4, name: "R-501", note: "Default" },
        { count: 1, name: "R-101", note: "Default" },
        { count: 5, name: "R-201", note: "Default [x3 Mission Update]" },
        { count: 2, name: "R-101", note: "Mission Update" },
      ],
      narrative: `Only the EF2000E is unlocked initially and that son of a gun's a dogfighter, which should help against the slower soon-to-be-destroyed transports flying over restricted airspace. Weapons can't be changed yet...


Long-time veterans should have the controls down pat, especially if they've played later PS2 installments in the series -- they're basically the same. Rookie pilots should use this chance to get familiarized, however. One thing that differs from the newer AC games is that these planes are FAST...like, 2000+ m.p.h fast. When you're coming up behind a target, be careful not too zoom past and waste missiles when the lock-on appears, as it's quite easy to do so until y'get the hang of things. Similarly, if you brake too hard the craft will stall and point nose-first at the ground, rather than a slow plummet. If you're flying too low and y'stall, there won't be time enough to recover speed and the army medics will be collecting you in tiny bite-sized bits later on.

As for the mission itself, the first is always the easiest and this one's no different. The R-501 transports are slow and lumbering, unable to fight back. Their escort fighters (R201s) can definitely fight back but usually cruise at about 1500 m.p.h. so that speed often lends itself to their missed attempts. If the first four targets are not defeated within a reasonable time (3:00), then the mission update's skipped and this run gets an automatic "D" ranking.

#### Mission update

With the transports deep-sixed, reinforcements will come from the south. One target (R-101) and a bunch of similar escorts will try to engage the player in some dogfighting as retribution for destroying their transports. There's not a lot of challenge to this part; it's more of an introduction to the many mission updates to follow. However, flying right into the sun is always gonna be annoying...`,
      role: "TRANSPORT INTERDICTION",
      brief:
        "Unidentified R-501 transports have crossed Expo City\u2019s restricted airspace. Intercept the four transports before their escort screen can regroup.",
      objective: "First four transports in 3:00. Then intercept the reinforcement leader.",
      radio: "Expo City is asleep. Let\u2019s keep it that way.",
      environment: "city",
      aKills: 10,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 2,
      title: "Interference",
      location: "Waiapolo Mts.",
      difficulty: "3/10",
      recommended: "EF2000E Typhoon II (or MiG-33 Fulcrum SS)",
      unlock: "F/A-18U Hornet ADV",
      source: `- **Location:** Waiapolo Mts.
- **Guide code:** WK02

- **Difficulty:** 3/10
- **Recommended:** EF2000E Typhoon II (or MiG-33 Fulcrum SS)
- **Unlock:** F/A-18U Hornet ADV

Once again, the Typhoon's the only plane up for this job...unless you gained the Fulcrum SS doing the previous mission!

The mission goal is to destroy all the radar sites plaguing General Defense's surveillance, and the mountainous region ain't making it any easier. As far as air support goes, there's a pair of R-101s and R-201s flying around, but that's pretty lightweight. If you check the pre-mission map, you'll see that there is a 4:00 time limit -- this applies to the first eight targets. Should the player not destroy them in within 3:59, then the mission update is skipped and an inferior rank attributed. Naturally, to squeeze inside this time limit, one should ignore the aircraft and concentrate solely on ground targets. [It only takes one missile to destroy the targets, for reference.]

A good tip is to start from the north and work south, taking it slow to the plane doesn't overshoot the target and waste time. Radarsites themselves have no offensive capabilities, which is even more reason to not worry about

#### Mission update

Should the first eight (8) be defeated in an expedient fashion, then the go-ahead to attack the northern base is given and the time limit is factored out. The new set of victims includes a bridge and four base buildings. Two of the buildings are set in dormant volcano cones, and the rims of them will definitely trash missile lock-ons if the player fails to correct trajectories, either by going slow and aiming down just over the rim or flying high and doing a dive maneuver. Mission ends when all five structures are rubble.

#### A-rank requirement / strategy

One must destroy at least 23 out of the 24 total enemies, which equates to ten normal enemies (13 are targets). All normal defenses and aircraft appear at once; no new ones are added in the update. However, the update is required to break the quota since 5 targets are added at that time.

#### Mission roster

- **x02 R-201** \u2014 Default
- **x02 R-101** \u2014 Default
- **x08 Radarsite** \u2014 Default
- **x05 AA Gun** \u2014 Default
- **x02 MSSL** \u2014 Default
- **x04 Base** \u2014 Mission Update
- **x01 Bridge** \u2014 Mission Update`,
      rankGuide:
        "One must destroy at least 23 out of the 24 total enemies, which equates to ten normal enemies (13 are targets). All normal defenses and aircraft appear at once; no new ones are added in the update. However, the update is required to break the quota since 5 targets are added at that time.",
      roster: [
        { count: 2, name: "R-201", note: "Default" },
        { count: 2, name: "R-101", note: "Default" },
        { count: 8, name: "Radarsite", note: "Default" },
        { count: 5, name: "AA Gun", note: "Default" },
        { count: 2, name: "MSSL", note: "Default" },
        { count: 4, name: "Base", note: "Mission Update" },
        { count: 1, name: "Bridge", note: "Mission Update" },
      ],
      narrative: `Once again, the Typhoon's the only plane up for this job...unless you gained the Fulcrum SS doing the previous mission!

The mission goal is to destroy all the radar sites plaguing General Defense's surveillance, and the mountainous region ain't making it any easier. As far as air support goes, there's a pair of R-101s and R-201s flying around, but that's pretty lightweight. If you check the pre-mission map, you'll see that there is a 4:00 time limit -- this applies to the first eight targets. Should the player not destroy them in within 3:59, then the mission update is skipped and an inferior rank attributed. Naturally, to squeeze inside this time limit, one should ignore the aircraft and concentrate solely on ground targets. [It only takes one missile to destroy the targets, for reference.]

A good tip is to start from the north and work south, taking it slow to the plane doesn't overshoot the target and waste time. Radarsites themselves have no offensive capabilities, which is even more reason to not worry about

#### Mission update

Should the first eight (8) be defeated in an expedient fashion, then the go-ahead to attack the northern base is given and the time limit is factored out. The new set of victims includes a bridge and four base buildings. Two of the buildings are set in dormant volcano cones, and the rims of them will definitely trash missile lock-ons if the player fails to correct trajectories, either by going slow and aiming down just over the rim or flying high and doing a dive maneuver. Mission ends when all five structures are rubble.`,
      role: "RADAR SUPPRESSION",
      brief:
        "Neuwork radar sites are blinding General Defense\u2019s surveillance over the Waiapolo mountains. Clear the eight sites, then strike the northern base.",
      objective: "Clear eight radars in 4:00 to unlock the base strike.",
      radio: "Mountains don\u2019t move. Your flight path should.",
      environment: "mountain",
      aKills: 23,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 3,
      title: "Joint Maneuvers",
      location: "Chopinburg",
      difficulty: "3.5/10",
      recommended: "MiG-33 Fulcrum SS -or- F/A-18U",
      unlock: "none",
      source: `- **Location:** Chopinburg
- **Guide code:** WK03

- **Difficulty:** 3.5/10
- **Recommended:** MiG-33 Fulcrum SS -or- F/A-18U
- **Unlock:** none

Based on the success in "Interference," the military has agreed to do joint training exercises. Having a plane with good mobility is key here, so if you have it, the F/A-18U is the clear winner. However, make that it isn't using its ground (cruise) missiles because you'll want a good air-to-air missile for this one. [The F/A's heavy guns have shorter range as well, so sticking with the Vulcan may not be a bad idea either.]

The mission itself first requires the player to trail a friendly (Eagle+) at no more than a 1000-foot radius. If it gets too far away, it's game over, so be sure to keep "Pursue!" on the screen because that's a notification that things are going well. [And no, you can't shoot this guy down.] He'll pull a few basic and crazy diving/ascending maneuvers, but as long as he's within a decent range, this part shouldn't that hard. Just be careful not to overshoot when following him because slowing down means he may get a bigger lead -- be sure to check your speed at all times and adjust accordingly. [By the way, yawing is incredible for keeping a visual on this guy so employ that tactic.] The point total for the pursuing part will be the lion's share of the ranking for this mission -- score 3200 for an assured "A".

After a few loop-de-loops, some training decoys will be released. They'll be missile-unfriendly and require one's guns, so a pilot has to stick to his guns, literally. Obviously it helps to go rather slow since they have no way of fighting back. When they're destroyed, three towers appear as missile practice. Take 'em down to end the mission with a bang.

#### Mission update

...or at least that's how it would go on a normal day. Incidentally, there's a freight plane violating Neuwork airspace and dropping some cargo, which is guarded by a few fighters. The parachuting containers are the real targets but y'may have to wait for 'em to drop below 12,000ft or the plane'll stall due to the thinness of the air (or something).

#### A-rank requirement / strategy

Score 5000 points. The decoys and towers make up 1800 points, so the player has to score 3200 during the follow-the-leader portion. Points accumulate only when there's less than 1000 feet distance between the two crafts; it'll stop when there's more. [No points are accumulated during the non-exercise airspace violation portion.] It make take a few times to do get the right score, so pay attention to the F-15S/MT's flightpath. Y'probably don't have to be reminded how easily it is for the leader to make a 1500-2000ft gap if y'lose sight of him.

#### Mission roster

- **x03 Decoy** \u2014 First half of mission
- **x03 Tower** \u2014 First half of mission
- **x05 Container** \u2014 Second half of mission
- **x01 R-501** \u2014 Second half of mission
- **x04 R-201** \u2014 Second half of mission`,
      rankGuide:
        "Score 5000 points. The decoys and towers make up 1800 points, so the player has to score 3200 during the follow-the-leader portion. Points accumulate only when there's less than 1000 feet distance between the two crafts; it'll stop when there's more. [No points are accumulated during the non-exercise airspace violation portion.] It make take a few times to do get the right score, so pay attention to the F-15S/MT's flightpath. Y'probably don't have to be reminded how easily it is for the leader to make a 1500-2000ft gap if y'lose sight of him.",
      roster: [
        { count: 3, name: "Decoy", note: "First half of mission" },
        { count: 3, name: "Tower", note: "First half of mission" },
        { count: 5, name: "Container", note: "Second half of mission" },
        { count: 1, name: "R-501", note: "Second half of mission" },
        { count: 4, name: "R-201", note: "Second half of mission" },
      ],
      narrative: `Based on the success in "Interference," the military has agreed to do joint training exercises. Having a plane with good mobility is key here, so if you have it, the F/A-18U is the clear winner. However, make that it isn't using its ground (cruise) missiles because you'll want a good air-to-air missile for this one. [The F/A's heavy guns have shorter range as well, so sticking with the Vulcan may not be a bad idea either.]

The mission itself first requires the player to trail a friendly (Eagle+) at no more than a 1000-foot radius. If it gets too far away, it's game over, so be sure to keep "Pursue!" on the screen because that's a notification that things are going well. [And no, you can't shoot this guy down.] He'll pull a few basic and crazy diving/ascending maneuvers, but as long as he's within a decent range, this part shouldn't that hard. Just be careful not to overshoot when following him because slowing down means he may get a bigger lead -- be sure to check your speed at all times and adjust accordingly. [By the way, yawing is incredible for keeping a visual on this guy so employ that tactic.] The point total for the pursuing part will be the lion's share of the ranking for this mission -- score 3200 for an assured "A".

After a few loop-de-loops, some training decoys will be released. They'll be missile-unfriendly and require one's guns, so a pilot has to stick to his guns, literally. Obviously it helps to go rather slow since they have no way of fighting back. When they're destroyed, three towers appear as missile practice. Take 'em down to end the mission with a bang.

#### Mission update

...or at least that's how it would go on a normal day. Incidentally, there's a freight plane violating Neuwork airspace and dropping some cargo, which is guarded by a few fighters. The parachuting containers are the real targets but y'may have to wait for 'em to drop below 12,000ft or the plane'll stall due to the thinness of the air (or something).`,
      role: "FORMATION / LIVE DIVERSION",
      brief:
        "Joint training with the military begins over Chopinburg. Follow the Eagle+, pass gun and missile practice, then respond to an unexpected airspace violation.",
      objective: "Hold formation, gun down decoys, destroy towers, intercept five cargo containers.",
      radio: "Today was supposed to be a quiet training day.",
      environment: "forest",
      aKills: 0,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 4,
      title: "Megafloat",
      location: "Rocky Is.",
      difficulty: "3/10",
      recommended: "MiG-33 Fulcrum SS -or- F/A-18U",
      unlock: "F-16XFU Gyrfalcon",
      source: `- **Location:** Rocky Is.
- **Guide code:** WK04

- **Difficulty:** 3/10
- **Recommended:** MiG-33 Fulcrum SS -or- F/A-18U
- **Unlock:** F-16XFU Gyrfalcon

Neuwork's sending warships to reinforce the militarization of Megafloat, a floating city -- and it's your mission to stop 'em dead in their tracks. The best plane available will be the F/A-18U. Even though most of the targets are ships, y'might as well stick to normal short-range missiles and whatever type of machine-gun's available.

The first half of this mission, destroying the listed targets north and south of Rocky Island, is on a timer (3:00) which will, of course, affect possible updates. A good tip about defeating warships is that, when the main target's destroyed, all auxiliary defenses are as well, so concentrate on those to cut down on flyby time.

#### Mission update

When the inbound carriers are defeated within 3:00, four southeast-bound fighters will appear as reinforcements. Although their target is the city itself, which has neutral targets aplenty (you're not killing them are you?) the foes will simply circle like vultures, so don't confuse this for a protection mission. If y'plan on flying over the city, taking out the coastal defenses isn't such a bad idea though -- there's three guns and SAMs there.

Afterwards you can land on the carrier, but I suggest having autopilot do all the work.

#### A-rank requirement / strategy

Defeat 23+ targets in the mission. Thirteen are mandatory (3 warships, 6 auxiliary warship targets, 4 planes) so this requires defeating ten others. Non-targets are exempt from the tally, of course. The easiest way to do this is destroy Megafloat's 8 coastal defenses and two generic planes, but there's no reason y'can't mix-and-match as required.

#### Mission roster

- **x01 Carrier** \u2014 Default
- **x01 Convoy** \u2014 Default
- **x04 Facilities** \u2014 Default [Island - Non-TGT]
- **x09 Gun** \u2014 Default [x4 Island]
- **x05 MSSL** \u2014 Default [x4 Island]
- **x02 Transport** \u2014 Default [Island - Non-TGT]
- **x04 R-201** \u2014 Default [x2 Mission Update]
- **x05 R-101** \u2014 Default [x2 Mission Update]
- **x01 Warship** \u2014 Default`,
      rankGuide:
        "Defeat 23+ targets in the mission. Thirteen are mandatory (3 warships, 6 auxiliary warship targets, 4 planes) so this requires defeating ten others. Non-targets are exempt from the tally, of course. The easiest way to do this is destroy Megafloat's 8 coastal defenses and two generic planes, but there's no reason y'can't mix-and-match as required.",
      roster: [
        { count: 1, name: "Carrier", note: "Default" },
        { count: 1, name: "Convoy", note: "Default" },
        { count: 4, name: "Facilities", note: "Default [Island - Non-TGT]" },
        { count: 9, name: "Gun", note: "Default [x4 Island]" },
        { count: 5, name: "MSSL", note: "Default [x4 Island]" },
        { count: 2, name: "Transport", note: "Default [Island - Non-TGT]" },
        { count: 4, name: "R-201", note: "Default [x2 Mission Update]" },
        { count: 5, name: "R-101", note: "Default [x2 Mission Update]" },
        { count: 1, name: "Warship", note: "Default" },
      ],
      narrative: `Neuwork's sending warships to reinforce the militarization of Megafloat, a floating city -- and it's your mission to stop 'em dead in their tracks. The best plane available will be the F/A-18U. Even though most of the targets are ships, y'might as well stick to normal short-range missiles and whatever type of machine-gun's available.

The first half of this mission, destroying the listed targets north and south of Rocky Island, is on a timer (3:00) which will, of course, affect possible updates. A good tip about defeating warships is that, when the main target's destroyed, all auxiliary defenses are as well, so concentrate on those to cut down on flyby time.

#### Mission update

When the inbound carriers are defeated within 3:00, four southeast-bound fighters will appear as reinforcements. Although their target is the city itself, which has neutral targets aplenty (you're not killing them are you?) the foes will simply circle like vultures, so don't confuse this for a protection mission. If y'plan on flying over the city, taking out the coastal defenses isn't such a bad idea though -- there's three guns and SAMs there.

Afterwards you can land on the carrier, but I suggest having autopilot do all the work.`,
      role: "MARITIME INTERDICTION",
      brief:
        "Neuwork warships are reinforcing the floating city of Megafloat. Sink the inbound fleet near Rocky Island without harming civilian facilities.",
      objective: "Sink the three warships in 3:00, then stop the reinforcements.",
      radio: "That city floats. The warships don\u2019t have to.",
      environment: "ocean",
      aKills: 23,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 5,
      title: "Scramble",
      location: "Wiapolo Mts.",
      difficulty: "5.5/10",
      recommended: "F/A-18 Hornet ADV -or- F-16XFU Gyrfalcon",
      unlock: "R-101 Delphinus #1",
      source: `- **Location:** Wiapolo Mts.
- **Guide code:** WK05

- **Difficulty:** 5.5/10
- **Recommended:** F/A-18 Hornet ADV -or- F-16XFU Gyrfalcon
- **Unlock:** R-101 Delphinus #1

Although plenty were killed so far, apparently the military thinks eight R-201s is a huge threat, and have dispatched the player to neutralized 'em before they can wreak havoc. Either of the two latest planes will suffice, perhaps the Gyrfalcon more since its missiles are standard instead of short- -range types.

Like usual, there's a time limit (3:00) for the first half of the mission. It's one's job to fly southeast to the runway and trash the R-201s, which is easiest accomplished by -- you guessed it -- ignoring all the other threats along the way. The runway itself is protected by a few AA guns and SAMs, but the R-201s are in their hangars. If y'take too long to kill 'em, they'll get airborne and the chance of doing everything expediently nosedives.

Since the planes are in two lines (two pairs of four), it's best to just fly in a circle(ish) motion and try to take out an extra one with the guns, too.

#### Mission update

The mission ends if one takes out the planes within 3:00; the update only occurs if y'don't. So, in this case, it's a dishonorable addition to the mission. Basically, all the R-201s not destroyed will now be airborne and the mission is to destroy them, plus select base facilities (the Tower). Obtaining this update ends the excursion in a "D".

#### A-rank requirement / strategy

Destroy 15+ targets (8 mandatory). Basically, in addition to the 8 planes one must destroy, take out 7 normal ones. This'll mean the easy five targets at the airport and two other planes, at least. To do this expediently, one would have to take out two planes EN ROUTE -- and that is ridiculously hard with the current planes, mostly because even if both missiles are fired, only one typically hits.

This is the first mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles which all but ensures a plane coming head-on is goin' down. [This mission can be finished in under 2:30 for reference.]

#### Mission roster

- **x04 Gun** \u2014 Default
- **x01 MSSL** \u2014 Default
- **x02 R-102** \u2014 Default
- **x02 R-211** \u2014 Default
- **x08 R-201** \u2014 Default
- **x01 Tower** \u2014 Mission Update`,
      rankGuide: `Destroy 15+ targets (8 mandatory). Basically, in addition to the 8 planes one must destroy, take out 7 normal ones. This'll mean the easy five targets at the airport and two other planes, at least. To do this expediently, one would have to take out two planes EN ROUTE -- and that is ridiculously hard with the current planes, mostly because even if both missiles are fired, only one typically hits.

This is the first mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles which all but ensures a plane coming head-on is goin' down. [This mission can be finished in under 2:30 for reference.]`,
      roster: [
        { count: 4, name: "Gun", note: "Default" },
        { count: 1, name: "MSSL", note: "Default" },
        { count: 2, name: "R-102", note: "Default" },
        { count: 2, name: "R-211", note: "Default" },
        { count: 8, name: "R-201", note: "Default" },
        { count: 1, name: "Tower", note: "Mission Update" },
      ],
      narrative: `Although plenty were killed so far, apparently the military thinks eight R-201s is a huge threat, and have dispatched the player to neutralized 'em before they can wreak havoc. Either of the two latest planes will suffice, perhaps the Gyrfalcon more since its missiles are standard instead of short- -range types.

Like usual, there's a time limit (3:00) for the first half of the mission. It's one's job to fly southeast to the runway and trash the R-201s, which is easiest accomplished by -- you guessed it -- ignoring all the other threats along the way. The runway itself is protected by a few AA guns and SAMs, but the R-201s are in their hangars. If y'take too long to kill 'em, they'll get airborne and the chance of doing everything expediently nosedives.

Since the planes are in two lines (two pairs of four), it's best to just fly in a circle(ish) motion and try to take out an extra one with the guns, too.

#### Mission update

The mission ends if one takes out the planes within 3:00; the update only occurs if y'don't. So, in this case, it's a dishonorable addition to the mission. Basically, all the R-201s not destroyed will now be airborne and the mission is to destroy them, plus select base facilities (the Tower). Obtaining this update ends the excursion in a "D".`,
      role: "AIRFIELD STRIKE",
      brief:
        "Eight R-201s are preparing to launch from a mountain airfield. Hit the parked aircraft before they become a problem in the air.",
      objective: "Destroy eight parked aircraft in 3:00. Late launches reduce your rank.",
      radio: "Catch them before they get their wings.",
      environment: "mountain",
      aKills: 15,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 6,
      title: "Target Acquisition",
      location: "Expo City",
      difficulty: "3/10",
      recommended: "F-16XFU Gyrfalcon",
      unlock: "R-201 Asterozoa",
      source: `- **Location:** Expo City
- **Guide code:** WK06

- **Difficulty:** 3/10
- **Recommended:** F-16XFU Gyrfalcon
- **Unlock:** R-201 Asterozoa

In Expo City, there seems to be an illegal testing range that needs to be scooped out in case it's the foundation for a coup d'etat. For this mission, the Gyrfalcon's probably the best bet as it's rather even in all areas; the new R-101 Delphinus #1 sucks in the armor department and that'll be important here.

To reconnoiter the area, the plane must get each "Facilities" within missile range -- firing at this time will use laser targeting to photograph the place, rather than turning it into a towering inferno. There's 3:00 to do this to all facilities, so don't dawdle. Skipping the scrubs, i.e. the normal defenses, helps a lot, as one can shoot 'em down afterwards. [NOTE: Photos are only taken if the shot is lined up in a way that, if it were a missile, it would hit. Taking a pic at a 15-degree angle or something won't cut it.]

#### Mission update

Once the targets get their photo op, the additional objective of neutralizing some incoming fighters takes place. This is the type of thing an acclimated pilot can sleepwalk through.

#### A-rank requirement / strategy

Destroy 20 enemies, which means ten non-targets, such as defenses and any normal plane. The facilities "photographed" count as kills for some reason, so those _are_ factored in. There's infinite time to defeat enemies after going shutterbug on the facilities, so compared to the 5th mission, this is a cakewalk.

#### Mission roster

- **x04 Facilities** \u2014 Default
- **x03 F/A-18I** \u2014 Mission Update
- **x03 F-16XF** \u2014 Default
- **x06 F-16XA** \u2014 Default [x3 Mission Update]
- **x08 Gun** \u2014 Default
- **x03 MSSL** \u2014 Default`,
      rankGuide: `Destroy 20 enemies, which means ten non-targets, such as defenses and any normal plane. The facilities "photographed" count as kills for some reason, so those _are_ factored in. There's infinite time to defeat enemies after going shutterbug on the facilities, so compared to the 5th mission, this is a cakewalk.`,
      roster: [
        { count: 4, name: "Facilities", note: "Default" },
        { count: 3, name: "F/A-18I", note: "Mission Update" },
        { count: 3, name: "F-16XF", note: "Default" },
        { count: 6, name: "F-16XA", note: "Default [x3 Mission Update]" },
        { count: 8, name: "Gun", note: "Default" },
        { count: 3, name: "MSSL", note: "Default" },
      ],
      narrative: `In Expo City, there seems to be an illegal testing range that needs to be scooped out in case it's the foundation for a coup d'etat. For this mission, the Gyrfalcon's probably the best bet as it's rather even in all areas; the new R-101 Delphinus #1 sucks in the armor department and that'll be important here.

To reconnoiter the area, the plane must get each "Facilities" within missile range -- firing at this time will use laser targeting to photograph the place, rather than turning it into a towering inferno. There's 3:00 to do this to all facilities, so don't dawdle. Skipping the scrubs, i.e. the normal defenses, helps a lot, as one can shoot 'em down afterwards. [NOTE: Photos are only taken if the shot is lined up in a way that, if it were a missile, it would hit. Taking a pic at a 15-degree angle or something won't cut it.]

#### Mission update

Once the targets get their photo op, the additional objective of neutralizing some incoming fighters takes place. This is the type of thing an acclimated pilot can sleepwalk through.`,
      role: "ARMED RECONNAISSANCE",
      brief:
        "An illegal testing range in Expo City may be the foundation of a coup. Photograph the facilities with the targeting laser before engaging the response force.",
      objective: "Line up four facilities and press MISSILE to photograph them in 3:00.",
      radio: "Your first weapon today is a camera.",
      environment: "city",
      aKills: 20,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 7,
      title: "Fragile Cargo",
      location: "Axel Bay",
      difficulty: "4/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "---",
      source: `- **Location:** Axel Bay
- **Guide code:** WK07

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

A terrorist communique has alerted the UPEO Command that a plane carrying bioweapons is on a collision course over Axel Bay's industrial district. This is going to be an enjoyable change of pace, so pick up a top-tier plane and get moving.

The briefing detailed the general gist of things: rather than defeating the plane, which would spread its caustic payload around the region, one has to destroy the obstacles in its path: buildings, chimneys, and the like. The enemy's dirigible-like aircraft is not a speed demon, but new targets won't appear unless it's within a certain range (otherwise, y'won't know which ones to attack). Basically, just fly in a circle until the next target appears; don't go seeking them out or you risk getting too far away! They next chimney is one locally, not far away. The final target is the bridge, which allows the craft to land safely.

#### Mission update

Once the dirigible splashes down, a hydrofoil will be launched -- this one's marked for destruction. It takes a few missiles to die, but is basically a fast-moving AA gun so don't get perforated. [You still can't shoot the first craft or it's a game over!]

When the festivities end, congratulations on crippling the city economy!

#### A-rank requirement / strategy

Automatically achieved by getting all (12) targets.

#### Mission roster

- **x01 UI-4052** \u2014 Default
- **x10 Chimney** \u2014 Default
- **x01 Bridge** \u2014 Default
- **x01 Hydrofoil** \u2014 Mission Update`,
      rankGuide: "Automatically achieved by getting all (12) targets.",
      roster: [
        { count: 1, name: "UI-4052", note: "Default" },
        { count: 10, name: "Chimney", note: "Default" },
        { count: 1, name: "Bridge", note: "Default" },
        { count: 1, name: "Hydrofoil", note: "Mission Update" },
      ],
      narrative: `A terrorist communique has alerted the UPEO Command that a plane carrying bioweapons is on a collision course over Axel Bay's industrial district. This is going to be an enjoyable change of pace, so pick up a top-tier plane and get moving.

The briefing detailed the general gist of things: rather than defeating the plane, which would spread its caustic payload around the region, one has to destroy the obstacles in its path: buildings, chimneys, and the like. The enemy's dirigible-like aircraft is not a speed demon, but new targets won't appear unless it's within a certain range (otherwise, y'won't know which ones to attack). Basically, just fly in a circle until the next target appears; don't go seeking them out or you risk getting too far away! They next chimney is one locally, not far away. The final target is the bridge, which allows the craft to land safely.

#### Mission update

Once the dirigible splashes down, a hydrofoil will be launched -- this one's marked for destruction. It takes a few missiles to die, but is basically a fast-moving AA gun so don't get perforated. [You still can't shoot the first craft or it's a game over!]

When the festivities end, congratulations on crippling the city economy!`,
      role: "EMERGENCY CORRIDOR",
      brief:
        "A hijacked UI-4052 carrying biological weapons is descending toward Axel Bay. Destroy the chimneys and bridge in its path, not the aircraft.",
      objective: "Clear the eleven obstacles, protect the cargo aircraft, then destroy the hydrofoil.",
      radio: "No shots at the transport. We are clearing a path, not making a crater.",
      environment: "harbor",
      aKills: 12,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 8,
      title: "Demilitarization",
      location: "Rocky Is.",
      difficulty: "5/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "---",
      source: `- **Location:** Rocky Is.
- **Guide code:** WK08

- **Difficulty:** 5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

Despite repeated warnings, Neuwork's continuing to fortify Megafloat, its buoyant city seen in a previous mission, so now it's time to bring the hammer down with impunity. The Gyrfalcon or Delphinus work well for this task, but the new R-201 might be a fun choice because, despite its power and mobility problems, it gets the MIRV. It stands for "Multiple Independently Targetable Reentry Vehicle" but you'll can call it a splintering warhead. Basically, it's a single missile that "splinters" into other smaller ones, allowing one strike to hit multiple targets. Pretty snazzy. [NOTE: The MIRV is fun but not a good choice for trying for "A" rank.]

There's not many surprises for the demilitarizing, although there's a 3:30 time limit to do it all in. All targets are, expectedly, by Megafloat: four gun emplacements and a tower, plus two R-101s flying overhead. There's a lot of other targets around, though, including a sea full of warships and convoys. Don't leave the planes for last, as they're the most wily.

#### Mission update

This is a "dishonorable" update -- it only occurs if the primary time limit is not achieved. At that time, a hydrofoil is launched from the northern port becomes the new target. It's basically just a moving AA gun and takes a few missiles to blow up. If it escapes, mission fails even harder than it already is. [Minimum rank achieved in this case is "C", although it can go higher; I don't believe you can get an "A" here...]

#### A-rank requirement / strategy

Achieve 24+ kills -- 7 are mandatory, 17+ are normal. For the seventeen, 8 can come from ships, four from island MSSLs -- the other five have to come from planes. The easiest way to start is to kill the two convoys nearby, then the aircraft carrier in the south, then the target planes over Megafloat. Destroy all targets/MSSLs on the island but one (the Tower can't fight back so it makes a natural choice) and destroy five planes before killing the final target. Getting 19-20 kills isn't that hard about now, but this is yet another task better left for the mission simulator -- it's just mind-numbingly difficult now with the time limit. [NOTE: I don't know how the Hydrofoil comes in, as you can destroy all targets right on the time limit and still get it to launch, so it might be able to account for one of the 17.]

This is the second mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles, ensuring its targets die more often.

> **Note:** The 2nd convoy sometimes survives if you're going too fast, so try to decelerate a bit and attack from an altitude; or, use the vulcan cannon to inflict a little more punishment.

> **Note:** You may want to do the difficult part (defeating 5 planes) first, then doing the easier targets.

#### Mission roster

- **x02 R-201** \u2014 Default
- **x06 R-101** \u2014 Default
- **x01 Tower** \u2014 Default
- **x07 Gun** \u2014 Default
- **x02 Convoy** \u2014 Default
- **x06 MSSL** \u2014 Default
- **x01 Carrier** \u2014 Default
- **x01 Hydrofoil** \u2014 Mission Update [Only if 3:30 limit exceeded]`,
      rankGuide: `Achieve 24+ kills -- 7 are mandatory, 17+ are normal. For the seventeen, 8 can come from ships, four from island MSSLs -- the other five have to come from planes. The easiest way to start is to kill the two convoys nearby, then the aircraft carrier in the south, then the target planes over Megafloat. Destroy all targets/MSSLs on the island but one (the Tower can't fight back so it makes a natural choice) and destroy five planes before killing the final target. Getting 19-20 kills isn't that hard about now, but this is yet another task better left for the mission simulator -- it's just mind-numbingly difficult now with the time limit. [NOTE: I don't know how the Hydrofoil comes in, as you can destroy all targets right on the time limit and still get it to launch, so it might be able to account for one of the 17.]

This is the second mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles, ensuring its targets die more often.

> **Note:** The 2nd convoy sometimes survives if you're going too fast, so try to decelerate a bit and attack from an altitude; or, use the vulcan cannon to inflict a little more punishment.

> **Note:** You may want to do the difficult part (defeating 5 planes) first, then doing the easier targets.`,
      roster: [
        { count: 2, name: "R-201", note: "Default" },
        { count: 6, name: "R-101", note: "Default" },
        { count: 1, name: "Tower", note: "Default" },
        { count: 7, name: "Gun", note: "Default" },
        { count: 2, name: "Convoy", note: "Default" },
        { count: 6, name: "MSSL", note: "Default" },
        { count: 1, name: "Carrier", note: "Default" },
        { count: 1, name: "Hydrofoil", note: "Mission Update [Only if 3:30 limit exceeded]" },
      ],
      narrative: `Despite repeated warnings, Neuwork's continuing to fortify Megafloat, its buoyant city seen in a previous mission, so now it's time to bring the hammer down with impunity. The Gyrfalcon or Delphinus work well for this task, but the new R-201 might be a fun choice because, despite its power and mobility problems, it gets the MIRV. It stands for "Multiple Independently Targetable Reentry Vehicle" but you'll can call it a splintering warhead. Basically, it's a single missile that "splinters" into other smaller ones, allowing one strike to hit multiple targets. Pretty snazzy. [NOTE: The MIRV is fun but not a good choice for trying for "A" rank.]

There's not many surprises for the demilitarizing, although there's a 3:30 time limit to do it all in. All targets are, expectedly, by Megafloat: four gun emplacements and a tower, plus two R-101s flying overhead. There's a lot of other targets around, though, including a sea full of warships and convoys. Don't leave the planes for last, as they're the most wily.

#### Mission update

This is a "dishonorable" update -- it only occurs if the primary time limit is not achieved. At that time, a hydrofoil is launched from the northern port becomes the new target. It's basically just a moving AA gun and takes a few missiles to blow up. If it escapes, mission fails even harder than it already is. [Minimum rank achieved in this case is "C", although it can go higher; I don't believe you can get an "A" here...]`,
      role: "DEMILITARIZATION",
      brief:
        "Neuwork has ignored the warnings and continued fortifying Megafloat. Remove the island\u2019s armaments and patrol fighters.",
      objective: "Destroy the seven primary targets in 3:30; intercept any escaping hydrofoil.",
      radio: "We warned them. Now remove the weapons.",
      environment: "ocean",
      aKills: 24,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 9,
      title: "Moonlight Flower",
      location: "Scofields Plat.",
      difficulty: "4/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "---",
      source: `- **Location:** Scofields Plat.
- **Guide code:** WK09

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

One of Neuwork's power plants is supplying an illegal munitions factory, so it needs to be removed from the face of the earth. The microwave signals'll screw up missile guidance, however, so a pilot has to rely on the ole vulcan cannon for assistance. Because of this, it helps to have a maneuverable plane with a good cannon -- such as the Gyrfalcon. Do not bring the R-201! It's a slowpoke with poor maneuverability and its MIRVs, though fun, are unreliable, even in an advantageous situation (such as shooting two MIRVs at a plane's six at level altitude).

The power plant complex is in the south and arranged in a "quincunx" array: four outer targets and the reactor in the middle. The power plants themselves are immune to missile targeting, but that doesn't mean they're immune to missiles themselves, mind you: "dumb" projectiles will still destroy them. The vulcan guns are generally best unless you're a deadeye (missiles tend to drift away from target unless they're at close range).

When all four plants are rubble, the center conelike plant will expose its core. Firing blindly at level altitude won't do anything, though -- a player has to get some height and destroy the top of the structure.

#### Mission update

If the four power plants are gunned down within 5:00, the subsequent step is to destroy the exposed reactor core -- the center volcano-like structure. Fly a little above it and shoot the summit; try too low and the missiles may just hit the side harmlessly. Unlike previous missions, the timer is still running and the core must be destroyed within the 5:00 as well.

#### A-rank requirement / strategy

Kill 18+ targets: 5 are mandatory, so that makes 13 others. Luckily, this is a bit easier if y'know what to expect. First, plan on destroying the eight ground targets, plus the R-701s that are riduculously slow and don't move around much. That leaves three normal planes to destroy in five minutes. The option is how best to approach this map. My order would be this:

1. Destroy any 3 planes near northern airport [x3 KO]
2. Destroy MSSL/R-201 at northern airport [x2 KO]
3. At Power Plant area, destroy plants, then the guns and 2nd R-201 [x9 KO]
4. Destroy three MSSLs on outer fringe of map [x3 KO]
5. Race back and destroy the core before time is up.
Since the hardest "wild card" is the 3 planes, so it's important to get them out of the way first -- it can be achieved in apx. 1:00 so try to aim for that time. Make sure to take it slower (or aim more carefully) at the plant site because if you miss once, y'have to fly all the way back around and get it again. It's important to cut down on wasted time here, since the flight to all three MSSL sites takes about 1:00 on its own (maybe 0:45 if you're already going 3000mph at all sites, which isn't likely to happen).

Note that you can skip the MSSL part and get three more planes instead, but I like to go for the sure thing myself. The "A" ranks only get tougher, so...

#### Mission roster

- **x04 Gun** \u2014 Default
- **x04 MSSL** \u2014 Default
- **x04 Pow.Plant** \u2014 Default
- **x03 R-101** \u2014 Default
- **x04 R-201** \u2014 Default
- **x02 R-701** \u2014 Default`,
      rankGuide: `Kill 18+ targets: 5 are mandatory, so that makes 13 others. Luckily, this is a bit easier if y'know what to expect. First, plan on destroying the eight ground targets, plus the R-701s that are riduculously slow and don't move around much. That leaves three normal planes to destroy in five minutes. The option is how best to approach this map. My order would be this:

1. Destroy any 3 planes near northern airport [x3 KO]
2. Destroy MSSL/R-201 at northern airport [x2 KO]
3. At Power Plant area, destroy plants, then the guns and 2nd R-201 [x9 KO]
4. Destroy three MSSLs on outer fringe of map [x3 KO]
5. Race back and destroy the core before time is up.
Since the hardest "wild card" is the 3 planes, so it's important to get them out of the way first -- it can be achieved in apx. 1:00 so try to aim for that time. Make sure to take it slower (or aim more carefully) at the plant site because if you miss once, y'have to fly all the way back around and get it again. It's important to cut down on wasted time here, since the flight to all three MSSL sites takes about 1:00 on its own (maybe 0:45 if you're already going 3000mph at all sites, which isn't likely to happen).

Note that you can skip the MSSL part and get three more planes instead, but I like to go for the sure thing myself. The "A" ranks only get tougher, so...`,
      roster: [
        { count: 4, name: "Gun", note: "Default" },
        { count: 4, name: "MSSL", note: "Default" },
        { count: 4, name: "Pow.Plant", note: "Default" },
        { count: 3, name: "R-101", note: "Default" },
        { count: 4, name: "R-201", note: "Default" },
        { count: 2, name: "R-701", note: "Default" },
      ],
      narrative: `One of Neuwork's power plants is supplying an illegal munitions factory, so it needs to be removed from the face of the earth. The microwave signals'll screw up missile guidance, however, so a pilot has to rely on the ole vulcan cannon for assistance. Because of this, it helps to have a maneuverable plane with a good cannon -- such as the Gyrfalcon. Do not bring the R-201! It's a slowpoke with poor maneuverability and its MIRVs, though fun, are unreliable, even in an advantageous situation (such as shooting two MIRVs at a plane's six at level altitude).

The power plant complex is in the south and arranged in a "quincunx" array: four outer targets and the reactor in the middle. The power plants themselves are immune to missile targeting, but that doesn't mean they're immune to missiles themselves, mind you: "dumb" projectiles will still destroy them. The vulcan guns are generally best unless you're a deadeye (missiles tend to drift away from target unless they're at close range).

When all four plants are rubble, the center conelike plant will expose its core. Firing blindly at level altitude won't do anything, though -- a player has to get some height and destroy the top of the structure.

#### Mission update

If the four power plants are gunned down within 5:00, the subsequent step is to destroy the exposed reactor core -- the center volcano-like structure. Fly a little above it and shoot the summit; try too low and the missiles may just hit the side harmlessly. Unlike previous missions, the timer is still running and the core must be destroyed within the 5:00 as well.`,
      role: "PRECISION GUN STRIKE",
      brief:
        "A microwave power complex on Scofields Plateau feeds an illegal munitions factory. Its interference defeats missile locks. Silence the plants and expose the core.",
      objective: "Gun down four plants, then attack the exposed core from above. Finish within 5:00.",
      radio: "Your cannon still works. Make it count.",
      environment: "plateau",
      aKills: 18,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 10,
      title: "Maze",
      location: "Hatties Ra.",
      difficulty: "5.5/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "\u2014",
      source: `- **Location:** Hatties Ra.
- **Guide code:** WK10

- **Difficulty:** 5.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** \u2014

A bit of a breather from the ninth mission, this surveillance assignment is on a General Resources plane flying through a ravine. If you've never played an Ace Combat game, y'may be unaware of how much they like making planes fly in tight, precipitous, or claustrophobic environments -- this is the first "ravine" mission. Basically, one flies upriver, navigating the canyon while keeping a few things in mind:

- Flying in first-person mode makes this easier
- Cruise relatively slow; speed + sharp turns = burrowing into cliff
- Value a plane's mobility over everything else
- Yaw (with shoulder buttons), rather than hard turn, whenever possible
- Don't fly above the cliff rim or you're picked up on radar and auto-fail
The plane in question travels unassumingly forward, so it's a sitting duck... but like all lucky ducks, it's marked as a non-target -- refrain from any potshots. If you're wondering where the difficulty is in this excursion, it doesn't have much. Still, some of the terrain is annoying and it's possible to crash in a downturn yaw because the water's surface is so reflective, it seems like there's more distance between the pilot and it.

> **Note:** Mission failure if the chemical weapons plant is not discovered within 5:30! This is not stated anywhere but the penalty's definitely there.

The R/F-117X can rise above the canyon without any repercussions, leaving the player to squeak by some of the narrower sections of the gorge. Also, at one point, the river opens up into a circular form and there's a sharp turn to the next area -- this one has enough flying room, however, if you're going slow.

#### Mission update

About 4:00 into the pursuit -- if you were following the plane closely -- a chemical weapons factory will be discovered. It's plainly situated inside a basin's natural reservoir, which barely has enough maneuvering room, so one simply just shoots the 'base' to finish the mission.

#### A-rank requirement / strategy

Destroy 8+ enemies overall. There's only one mandatory target ("Base") but plenty of helicopters to destroy on the way. The base only has five generic targets (3 ground, two copters) so destroy some other AH-66Bs on the way to pick up the slack. If you take the west path at the first bifurcation, one can pick up four extra kills, compared to the east path which skips all of 'em. As y'know, there's a 5:30 time limit on following the plane, so don't bother exploring as there won't be any way to salvage a mission that goes off a sightseeing trip.

#### Mission roster

- **x01 R/F-117X** \u2014 Default
- **x19 AH-66B** \u2014 Default
- **x01 Base** \u2014 Mission Update
- **x02 Oil Tank** \u2014 Mission Update
- **x01 Hydrofoil** \u2014 Mission Update`,
      rankGuide: `Destroy 8+ enemies overall. There's only one mandatory target ("Base") but plenty of helicopters to destroy on the way. The base only has five generic targets (3 ground, two copters) so destroy some other AH-66Bs on the way to pick up the slack. If you take the west path at the first bifurcation, one can pick up four extra kills, compared to the east path which skips all of 'em. As y'know, there's a 5:30 time limit on following the plane, so don't bother exploring as there won't be any way to salvage a mission that goes off a sightseeing trip.`,
      roster: [
        { count: 1, name: "R/F-117X", note: "Default" },
        { count: 19, name: "AH-66B", note: "Default" },
        { count: 1, name: "Base", note: "Mission Update" },
        { count: 2, name: "Oil Tank", note: "Mission Update" },
        { count: 1, name: "Hydrofoil", note: "Mission Update" },
      ],
      narrative: `A bit of a breather from the ninth mission, this surveillance assignment is on a General Resources plane flying through a ravine. If you've never played an Ace Combat game, y'may be unaware of how much they like making planes fly in tight, precipitous, or claustrophobic environments -- this is the first "ravine" mission. Basically, one flies upriver, navigating the canyon while keeping a few things in mind:

- Flying in first-person mode makes this easier
- Cruise relatively slow; speed + sharp turns = burrowing into cliff
- Value a plane's mobility over everything else
- Yaw (with shoulder buttons), rather than hard turn, whenever possible
- Don't fly above the cliff rim or you're picked up on radar and auto-fail
The plane in question travels unassumingly forward, so it's a sitting duck... but like all lucky ducks, it's marked as a non-target -- refrain from any potshots. If you're wondering where the difficulty is in this excursion, it doesn't have much. Still, some of the terrain is annoying and it's possible to crash in a downturn yaw because the water's surface is so reflective, it seems like there's more distance between the pilot and it.


The R/F-117X can rise above the canyon without any repercussions, leaving the player to squeak by some of the narrower sections of the gorge. Also, at one point, the river opens up into a circular form and there's a sharp turn to the next area -- this one has enough flying room, however, if you're going slow.

#### Mission update

About 4:00 into the pursuit -- if you were following the plane closely -- a chemical weapons factory will be discovered. It's plainly situated inside a basin's natural reservoir, which barely has enough maneuvering room, so one simply just shoots the 'base' to finish the mission.`,
      role: "LOW-LEVEL SURVEILLANCE",
      brief:
        "Follow a General Resources reconnaissance aircraft through Hatties Ravine to uncover a chemical weapons factory. Stay below the canyon rim and do not fire at the lead aircraft.",
      objective: "Follow the river under the radar ceiling. Discover and destroy the factory within 5:30.",
      radio: "The river is your runway. The canyon is your cover.",
      environment: "canyon",
      aKills: 8,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 11,
      title: "Escort",
      location: "Mt. Lambert",
      difficulty: "3.5/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "RF-12A2 Blackbird",
      source: `- **Location:** Mt. Lambert
- **Guide code:** WK11

- **Difficulty:** 3.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** RF-12A2 Blackbird

Back to the free skies! This time, a NUN (Neo United Nations) chairman has been targeted by terrorists and requires a watchdog while flying over the Lambert Mountains. Since we haven't obtained any good planes in a long while, the Gyrfalcon is probably the best available.

As the mission starts, the bogeys are along the eastern edge of the map, two groups, five total. Fly out to meet them (why would you endanger the ally?) and systematically send them crashing to the mountains below. Although some may try to coax the player into dogfighting, always keep an eye on any who go straight for the civilian plane -- not only because it's in danger, but because those foes are easier to shoot down, generally.

> **Note:** The 1st midair refueling takes place after this, but feel free to autopilot it.

#### A-rank requirement / strategy

Defeat all five enemies in under 3:00. It's not that hard to burn figurative rubber and defeat the first two in under 1:00, so the mission doesn't seem that hard if y'use that as a baseline. Just try to shoot advantageously (like not upside-down, where missiles seem to blow at hitting things) and don't go too fast, or y'may overshoot. Also, it helps if you can destroy a plane when first encountering a group; just go slow enough and align yourself to up the likelihood of success.

#### Mission roster

- **x05 F/A-32C** \u2014 Default
- **x01 R-5050** \u2014 Default [Ally]`,
      rankGuide:
        "Defeat all five enemies in under 3:00. It's not that hard to burn figurative rubber and defeat the first two in under 1:00, so the mission doesn't seem that hard if y'use that as a baseline. Just try to shoot advantageously (like not upside-down, where missiles seem to blow at hitting things) and don't go too fast, or y'may overshoot. Also, it helps if you can destroy a plane when first encountering a group; just go slow enough and align yourself to up the likelihood of success.",
      roster: [
        { count: 5, name: "F/A-32C", note: "Default" },
        { count: 1, name: "R-5050", note: "Default [Ally]" },
      ],
      narrative: `Back to the free skies! This time, a NUN (Neo United Nations) chairman has been targeted by terrorists and requires a watchdog while flying over the Lambert Mountains. Since we haven't obtained any good planes in a long while, the Gyrfalcon is probably the best available.

As the mission starts, the bogeys are along the eastern edge of the map, two groups, five total. Fly out to meet them (why would you endanger the ally?) and systematically send them crashing to the mountains below. Although some may try to coax the player into dogfighting, always keep an eye on any who go straight for the civilian plane -- not only because it's in danger, but because those foes are easier to shoot down, generally.`,
      role: "VIP ESCORT",
      brief:
        "Terrorists have targeted the Neo United Nations chairman\u2019s aircraft over Mt. Lambert. Intercept the attackers before they reach the civilian transport.",
      objective: "Destroy five F/A-32Cs and keep the R-5050 alive.",
      radio: "Five threats. One aircraft that must get home.",
      environment: "snow",
      aKills: 0,
      aTime: 180,
      expansion: !1,
    },
    {
      id: 12,
      title: "Stratosphere",
      location: "White Valley",
      difficulty: "3/10",
      recommended: "RF-12A2 Blackbird",
      unlock: "---",
      source: `- **Location:** White Valley
- **Guide code:** WK12

- **Difficulty:** 3/10
- **Recommended:** RF-12A2 Blackbird
- **Unlock:** ---

Neuwork's sent an aerial platoon to attack White Valley airbase, and they're cruising at a 30,000-foot altitude. The only plane that can really get that high is the new Blackbird stratofighter. Since this is an aerial mission, bring normal missiles (MIRVs aren't needed and short-range missiles are dumb) and whatever gun of your choosing.

After the awesome launch sequence, the airborne fleet is met high above the earth's weather patterns. The Blackbird is made for armor and to withstand pressure (I guess?) so it's not a speed demon and, in fact, sucks at quick maneuvers, making its actions seem rather sluggish. But, that'd only be a problem if the enemy weren't; here, they too lumber about the stratosphere and are pretty easy to shoot down overall. Just make sure to hit the back ones first and move toward the front; it wastes less time.

There's a 5:00 failure limit for this mission. Also, afterwards, there'll be a (skippable) runway landing.

#### A-rank requirement / strategy

Defeat eight targets (2 normal). The dumb thing about this is, the high-up targets eventually move pretty far ahead of the pack, so to make this goal feasible, y'have to take out some of the lower-flying R-311s before engaging the "main course." [NOTE: The stratosphere planes vanish off the map if you get too low, which is another reason to get the annoying part out of the way first.] If you do things right and maybe get a little luck, y'can finish this in just over 2:00 -- hilarious!

#### Mission roster

- **x08 R-311** \u2014 Default
- **x06 R-531** \u2014 Default`,
      rankGuide: `Defeat eight targets (2 normal). The dumb thing about this is, the high-up targets eventually move pretty far ahead of the pack, so to make this goal feasible, y'have to take out some of the lower-flying R-311s before engaging the "main course." [NOTE: The stratosphere planes vanish off the map if you get too low, which is another reason to get the annoying part out of the way first.] If you do things right and maybe get a little luck, y'can finish this in just over 2:00 -- hilarious!`,
      roster: [
        { count: 8, name: "R-311", note: "Default" },
        { count: 6, name: "R-531", note: "Default" },
      ],
      narrative: `Neuwork's sent an aerial platoon to attack White Valley airbase, and they're cruising at a 30,000-foot altitude. The only plane that can really get that high is the new Blackbird stratofighter. Since this is an aerial mission, bring normal missiles (MIRVs aren't needed and short-range missiles are dumb) and whatever gun of your choosing.

After the awesome launch sequence, the airborne fleet is met high above the earth's weather patterns. The Blackbird is made for armor and to withstand pressure (I guess?) so it's not a speed demon and, in fact, sucks at quick maneuvers, making its actions seem rather sluggish. But, that'd only be a problem if the enemy weren't; here, they too lumber about the stratosphere and are pretty easy to shoot down overall. Just make sure to hit the back ones first and move toward the front; it wastes less time.

There's a 5:00 failure limit for this mission. Also, afterwards, there'll be a (skippable) runway landing.`,
      role: "HIGH-ALTITUDE INTERCEPTION",
      brief:
        "A Neuwork formation is approaching White Valley above 30,000 feet. The Blackbird is the only airframe cleared for this altitude.",
      objective: "Intercept six R-531s within 5:00. RF-12A2 required.",
      radio: "Above the weather, there is nowhere to hide.",
      environment: "strato",
      aKills: 8,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 13,
      title: "Claustrophobia",
      location: "Amber Mts.",
      difficulty: "5/10",
      recommended: "F-16XFU Gyrfalcon -or- R-101 Delphinus #1",
      unlock: "F-15S/MT Eagle+",
      source: `- **Location:** Amber Mts.
- **Guide code:** WK13

- **Difficulty:** 5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** F-15S/MT Eagle+

Intermediate-range ballistic missiles (IRBMs) have been confirmed at some mountain bases, and within the scope of their range are the cities of Expo City and Port Edwards. Although it's unknown whether they're Neuwork-made, the fact stands that they must be taken out, despite the dense fog. Like usual, the Gyrfalcon is probably the best pick here. [The RF-12A2 plane can't be selected for these normal, low-altitude missions, by the way.]

The first half has a 6:00 time limit. The targets are the eight bases (two groups) plus two guns, making a total of ten targets. However, the player's really at battle with the canyon-ridden terrane here, where some targets are on the cliffs and other emplacements below the cliff rims. Trying to do a systematic sweep ends up being rather sucky in this case.

#### Mission update

This is another "dishonorable" update. Should all targets not be destroyed within the six-minute timeframe, one of the infamous missiles (IRBMs) will be launched and the player'll have to hunt it down before it leaves the map. Expectedly, the missile is immune to lock-ons so one'll have to exercise the ole trigger finger and shoot it out of the sky with manual aim.

#### A-rank requirement / strategy

Score 30 kills. Ten (10) are mandatory, so that leaves the other twenty up to the player. Luckily, even on a "sightread" of this objective, there's so many ground targets that they easily boost the ranks to the high. However, to get 30+ in a reasonable fashion, destroy the R-701s (helicopters) floating around the canyons. If you plan on just going for the easier ground defences, you'll need to defeat three. Opportunistically, if y'can't find any around the base areas try to defeat one of the local planes. [It's possible to get thirty targets with apx 4:20 so that leaves a bit of leeway to get the last few kills.]

Also, since the base contains clustering targets, employ the machine gun and try to take out a target if no missiles are readied -- it saves a trip back.

#### Mission roster

- **x09 Gun** \u2014 Default
- **x04 MSSL** \u2014 Default
- **x08 Base** \u2014 Default
- **x03 R-102** \u2014 Default
- **x02 R-201** \u2014 Default
- **x02 R-211** \u2014 Default
- **x03 R-701** \u2014 Default
- **x01 IRBM** \u2014 Mission Update`,
      rankGuide: `Score 30 kills. Ten (10) are mandatory, so that leaves the other twenty up to the player. Luckily, even on a "sightread" of this objective, there's so many ground targets that they easily boost the ranks to the high. However, to get 30+ in a reasonable fashion, destroy the R-701s (helicopters) floating around the canyons. If you plan on just going for the easier ground defences, you'll need to defeat three. Opportunistically, if y'can't find any around the base areas try to defeat one of the local planes. [It's possible to get thirty targets with apx 4:20 so that leaves a bit of leeway to get the last few kills.]

Also, since the base contains clustering targets, employ the machine gun and try to take out a target if no missiles are readied -- it saves a trip back.`,
      roster: [
        { count: 9, name: "Gun", note: "Default" },
        { count: 4, name: "MSSL", note: "Default" },
        { count: 8, name: "Base", note: "Default" },
        { count: 3, name: "R-102", note: "Default" },
        { count: 2, name: "R-201", note: "Default" },
        { count: 2, name: "R-211", note: "Default" },
        { count: 3, name: "R-701", note: "Default" },
        { count: 1, name: "IRBM", note: "Mission Update" },
      ],
      narrative: `Intermediate-range ballistic missiles (IRBMs) have been confirmed at some mountain bases, and within the scope of their range are the cities of Expo City and Port Edwards. Although it's unknown whether they're Neuwork-made, the fact stands that they must be taken out, despite the dense fog. Like usual, the Gyrfalcon is probably the best pick here. [The RF-12A2 plane can't be selected for these normal, low-altitude missions, by the way.]

The first half has a 6:00 time limit. The targets are the eight bases (two groups) plus two guns, making a total of ten targets. However, the player's really at battle with the canyon-ridden terrane here, where some targets are on the cliffs and other emplacements below the cliff rims. Trying to do a systematic sweep ends up being rather sucky in this case.

#### Mission update

This is another "dishonorable" update. Should all targets not be destroyed within the six-minute timeframe, one of the infamous missiles (IRBMs) will be launched and the player'll have to hunt it down before it leaves the map. Expectedly, the missile is immune to lock-ons so one'll have to exercise the ole trigger finger and shoot it out of the sky with manual aim.`,
      role: "MISSILE SITE SUPPRESSION",
      brief:
        "Ballistic missile bases in the Amber Mountains threaten Expo City and Port Edwards. Fog and steep terrain conceal the installations.",
      objective: "Destroy eight bases and two guns in 6:00. Gun down any launched IRBM.",
      radio: "Find the launchers before the sky lights up.",
      environment: "mountain",
      aKills: 30,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 14,
      title: "Reaching for Stars",
      location: "Comona Is.",
      difficulty: "4/10",
      recommended: "F-16XFU Gyrfalcon -or- F-15S/MT Eagle+",
      unlock: "F-16XA Sakerfalcon",
      source: `- **Location:** Comona Is.
- **Guide code:** WK14

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- F-15S/MT Eagle+
- **Unlock:** F-16XA Sakerfalcon

A platoon of Antlion tanks has been dropped near a space shuttle launching site, and they appear to an attempt by General Resources to commandeer the research facility. This is a good time to break out the new Eagle+, which has better average stats than the other planes thus far, plus a wider arsenal. Normal missiles and whatever machine-gun should suffice.

The first half of the mission takes place as the tanks are being airdropped to the space shuttle facility. They're in parachuted freefall and have no means of attacking, and take quite awhile to hit the ground, so destroy them in your preferred way. It may take a few passes unless you go very slow and attack the nearest ones. [This part can be done in under 1:00 by this method.]

#### Mission update

When all Antlions are kaput, a squadron of five F/A-32Cs appears, inbound from the north. Not exactly a dire situation but the skies will be swarming with planes -- still, most enemy aircraft seem to just fly around at low altitudes and do nothing in particular, so keep mobile, basically.

#### A-rank requirement / strategy

Destroy all targets. Fourteen (10 Antlion, 4 F/A-32C) are mandatory, so that leaves the generic fighters plus the C-17B. Since the time limit really means nothing after the update, this should be a fun-filled airborne massacre of easy proportions.

#### Mission roster

- **x10 Antlion** \u2014 Default
- **x01 C-17B** \u2014 Default
- **x08 F/A-32C** \u2014 Default [x5 Mission Update]`,
      rankGuide:
        "Destroy all targets. Fourteen (10 Antlion, 4 F/A-32C) are mandatory, so that leaves the generic fighters plus the C-17B. Since the time limit really means nothing after the update, this should be a fun-filled airborne massacre of easy proportions.",
      roster: [
        { count: 10, name: "Antlion", note: "Default" },
        { count: 1, name: "C-17B", note: "Default" },
        { count: 8, name: "F/A-32C", note: "Default [x5 Mission Update]" },
      ],
      narrative: `A platoon of Antlion tanks has been dropped near a space shuttle launching site, and they appear to an attempt by General Resources to commandeer the research facility. This is a good time to break out the new Eagle+, which has better average stats than the other planes thus far, plus a wider arsenal. Normal missiles and whatever machine-gun should suffice.

The first half of the mission takes place as the tanks are being airdropped to the space shuttle facility. They're in parachuted freefall and have no means of attacking, and take quite awhile to hit the ground, so destroy them in your preferred way. It may take a few passes unless you go very slow and attack the nearest ones. [This part can be done in under 1:00 by this method.]

#### Mission update

When all Antlions are kaput, a squadron of five F/A-32Cs appears, inbound from the north. Not exactly a dire situation but the skies will be swarming with planes -- still, most enemy aircraft seem to just fly around at low altitudes and do nothing in particular, so keep mobile, basically.`,
      role: "LAUNCH-SITE DEFENSE",
      brief:
        "General Resources is airdropping Antlion tanks near Comona\u2019s shuttle research facility. Keep the launch site free of enemy forces.",
      objective: "Destroy ten parachuting tanks, then intercept the reinforcement fighters.",
      radio: "Give the shuttle a clean sky.",
      environment: "island",
      aKills: 19,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 15,
      title: "Guardian Angel",
      location: "Comona Is.",
      difficulty: "3.5/10",
      recommended: "F-16XFU Gyrfalcon -or- M-15S/MT Eagle+",
      unlock: "R-352 Sepia",
      source: `- **Location:** Comona Is.
- **Guide code:** WK15

- **Difficulty:** 3.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- M-15S/MT Eagle+
- **Unlock:** R-352 Sepia

With the success of the launch in the previous mission, the shuttle is now on a return course. Naturally, the General Resources gang is up to their old tricks and have come back with a few squadrons to thwart the landing attempt. Unfortunately the new (?) Salkerfalcon isn't meant for aerial fighting, so it's back on the reliable Eagle+ to keep the good times rolling.

There are two groups of enemies (4/3 split) to defeat within 4:00, which is a lot easier than y'may think -- most are less focused on extreme maneuvering than they are on finding and attacking the R-808. Take out the first four in a relatively quick time (1:30?) and be ready to hit the second wave, which is likely to be closing in on the shuttle. Obviously, it's mission failure if the civilian craft is blown to smithereens.

#### A-rank requirement / strategy

Finish in under 3:00, which is pretty easy to do in the Eagle+, although a little luck helps. I managed to sightread the excursion in 2:25:xx so it's really not too much of a pain.

#### Mission roster

- **x07 F-22C** \u2014 Default
- **x01 R-808** \u2014 Default [Ally]`,
      rankGuide:
        "Finish in under 3:00, which is pretty easy to do in the Eagle+, although a little luck helps. I managed to sightread the excursion in 2:25:xx so it's really not too much of a pain.",
      roster: [
        { count: 7, name: "F-22C", note: "Default" },
        { count: 1, name: "R-808", note: "Default [Ally]" },
      ],
      narrative: `With the success of the launch in the previous mission, the shuttle is now on a return course. Naturally, the General Resources gang is up to their old tricks and have come back with a few squadrons to thwart the landing attempt. Unfortunately the new (?) Salkerfalcon isn't meant for aerial fighting, so it's back on the reliable Eagle+ to keep the good times rolling.

There are two groups of enemies (4/3 split) to defeat within 4:00, which is a lot easier than y'may think -- most are less focused on extreme maneuvering than they are on finding and attacking the R-808. Take out the first four in a relatively quick time (1:30?) and be ready to hit the second wave, which is likely to be closing in on the shuttle. Obviously, it's mission failure if the civilian craft is blown to smithereens.`,
      role: "SHUTTLE ESCORT",
      brief:
        "The Comona shuttle is returning from orbit. General Resources fighters intend to prevent its landing. Protect the R-808 through both attack waves.",
      objective: "Destroy seven F-22Cs within 4:00. The shuttle must survive.",
      radio: "One more safe landing. Stay with it.",
      environment: "island",
      aKills: 0,
      aTime: 180,
      expansion: !1,
    },
    {
      id: 16,
      title: "Zero Gravity",
      location: "Space",
      difficulty: "4/10",
      recommended: "R-352 Sepia",
      unlock: "---",
      source: `- **Location:** Space
- **Guide code:** WK16

- **Difficulty:** 4/10
- **Recommended:** R-352 Sepia
- **Unlock:** ---

Welcome to the exosphere, i.e. outer space. There are some rebel satellites that need to be defeated within the short amount of time the plane has going for it. In this case, the R-352 Sepia is mandatory, and if y'look at its growth chart, its armor and mobility are maxed out but it's got poor fighting capabilities and stability, too. Oh dear. It does the get the unique Neutron Beam (gun slot) and Plasma Beam (missile slot) weapons.

After blastoff, the mission begins and the 3:00 timer begins. The satellites don't fight back but the zero-grav conditions make maneuverability less than stellar (not a pun), as acceleration is a bit harder than in the atmosphere. Note that if y'exceed the time limit, the satellites click on and approaching one will blow up your vessel.

> **Note:** I suggest getting through atmospheric reentry on autopilot.

#### A-rank requirement / strategy

Defeat the four satellites in under 2:30.

#### Mission roster

- **x04 Satellite** \u2014 Default`,
      rankGuide: "Defeat the four satellites in under 2:30.",
      roster: [{ count: 4, name: "Satellite", note: "Default" }],
      narrative: `Welcome to the exosphere, i.e. outer space. There are some rebel satellites that need to be defeated within the short amount of time the plane has going for it. In this case, the R-352 Sepia is mandatory, and if y'look at its growth chart, its armor and mobility are maxed out but it's got poor fighting capabilities and stability, too. Oh dear. It does the get the unique Neutron Beam (gun slot) and Plasma Beam (missile slot) weapons.

After blastoff, the mission begins and the 3:00 timer begins. The satellites don't fight back but the zero-grav conditions make maneuverability less than stellar (not a pun), as acceleration is a bit harder than in the atmosphere. Note that if y'exceed the time limit, the satellites click on and approaching one will blow up your vessel.`,
      role: "ORBITAL SUPPRESSION",
      brief:
        "Rogue satellites are preparing to activate. Launch in the R-352 Sepia and neutralize them before your operational window closes.",
      objective: "Destroy all four satellites within 3:00. Plasma and neutron beams authorized.",
      radio: "Gravity has left the conversation.",
      environment: "space",
      aKills: 0,
      aTime: 150,
      expansion: !1,
    },
    {
      id: 17,
      title: "One-Way Ticket",
      location: "Sandbury D.",
      difficulty: "4-7/10",
      recommended: "F-16XFU Gyrfalcon -or- F-15S/MT Eagle+",
      unlock: "F-22C Raptor II",
      source: `- **Location:** Sandbury D.
- **Guide code:** WK17

- **Difficulty:** 4-7/10
- **Recommended:** F-16XFU Gyrfalcon -or- F-15S/MT Eagle+
- **Unlock:** F-22C Raptor II

Some of Neuwork's researchers were abducted by unknown assailants, and they are currently fleeing across the Sandbury Desert. Warm-heartedly, the brass has ordered the player to destroy the train and save the civilians. There's no reason to pick anything other than the F-152/MT for this, but y'can if you want to.

Although there isn't a stated mission time for this, it's actually 4:30, the time it takes for the train to reach the base. Hilariously, this low-lying, fast-moving train is quite an opponent. Not only can it not be targeted by missiles, but sections of the train are marked as non-targets, so the player has to destroy a certain section with precision gunfire (or face demerits in the form of a lesser rank). The targets are all cars that do not have a weird 'x' non-lock-on symbol over them, which can be hard to match up unless you've got a bird's-eye view of things. [There are six in all.]

There are only two ways to attack the plane, which, occasionally, is obscured by tunnels and train bridges:

- Get to a height and dive at the train, pulling up during deceleration to get another shot (train moves forward, you don't, yadda yadda yadda). This isn't that bad of a way to do things, particularly as it allows for easier maneuvering where enemy planes are concerned.
- Make a parallel flightpath with the train, but a little off to one side, so that the vulcan's live rounds arc down to the train. This method doesn't require much movement (hooray!) but may endanger the other non-target cars in the process, if you're a poor shot (boo/hiss!).
Mission ends when the six 'bad' train cars are destroyed.

#### A-rank requirement / strategy

Defeat four of the seven planes flying around, in addition to destroying the 6 'bad' cars of the train. In a hilarious twist, the train part is hardest; defeating four scrub pilots is a cinch. Destroying even one civilian car will bump this down to a "C" rank, however.

#### Mission roster

- **x01 A.Train** \u2014 Default [x6 'bad' cars, x3 Non-TGT]
- **x06 F/A-32C** \u2014 Default`,
      rankGuide: `Defeat four of the seven planes flying around, in addition to destroying the 6 'bad' cars of the train. In a hilarious twist, the train part is hardest; defeating four scrub pilots is a cinch. Destroying even one civilian car will bump this down to a "C" rank, however.`,
      roster: [
        { count: 1, name: "A.Train", note: "Default [x6 'bad' cars, x3 Non-TGT]" },
        { count: 6, name: "F/A-32C", note: "Default" },
      ],
      narrative: `Some of Neuwork's researchers were abducted by unknown assailants, and they are currently fleeing across the Sandbury Desert. Warm-heartedly, the brass has ordered the player to destroy the train and save the civilians. There's no reason to pick anything other than the F-152/MT for this, but y'can if you want to.

Although there isn't a stated mission time for this, it's actually 4:30, the time it takes for the train to reach the base. Hilariously, this low-lying, fast-moving train is quite an opponent. Not only can it not be targeted by missiles, but sections of the train are marked as non-targets, so the player has to destroy a certain section with precision gunfire (or face demerits in the form of a lesser rank). The targets are all cars that do not have a weird 'x' non-lock-on symbol over them, which can be hard to match up unless you've got a bird's-eye view of things. [There are six in all.]

There are only two ways to attack the plane, which, occasionally, is obscured by tunnels and train bridges:

- Get to a height and dive at the train, pulling up during deceleration to get another shot (train moves forward, you don't, yadda yadda yadda). This isn't that bad of a way to do things, particularly as it allows for easier maneuvering where enemy planes are concerned.
- Make a parallel flightpath with the train, but a little off to one side, so that the vulcan's live rounds arc down to the train. This method doesn't require much movement (hooray!) but may endanger the other non-target cars in the process, if you're a poor shot (boo/hiss!).
Mission ends when the six 'bad' train cars are destroyed.`,
      role: "HOSTAGE RESCUE / PRECISION FIRE",
      brief:
        "Abducted Neuwork researchers are being transported across Sandbury Desert. Disable the six hostile train cars without hitting the three civilian carriages.",
      objective: "Use guns on the marked train cars before they reach the base in 4:30.",
      radio: "Read your targets. There are people in those other cars.",
      environment: "desert",
      aKills: 10,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 18,
      title: "Bug Hunt",
      location: "Chopinburg",
      difficulty: "2/10",
      recommended: "F-15S/MT Eagle+ -or- F-22C Raptor II",
      unlock: "F/A-32C Erne",
      source: `- **Location:** Chopinburg
- **Guide code:** WK18

- **Difficulty:** 2/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** F/A-32C Erne

In one of the weirder missions, some nanobite creatures have been released in the forests near Chopinburg and must be destroyed by special means. Any of the recent planes should work, although the F-22C has perhaps the best stats of any available now. All planes will be equipped with the Anti-Nanobite Bomb in the missile slot, and as you'll quickly find out, it's a ground bomb with no homing capacity.

The mission itself is fairly standard, although there will be a "virus alert" when you're at a certain radius from the nests, which darkens the screen and can cause crashes if you're at a declining angle. The A-N Bomb has an area of effect, so you'll want to aim it (with the hanging reticle) in the center of groups to score lots of kills with one boom. Try to avoid flying by the nests if y'can, as they may waste precious time.

On the flipside, Nanobites have no means of attack so one basically just has to aim well and this should be over soon. Remember that you want to aim between targets, not the targets theselves! Also, the loop-de-loop maneuvers are great for this mission as they cut down on attack recovery time and set up the player for a bird's-eye view of the bombing zone.

> **Note:** Despite the weapon's long reload time, it helps to do a well-aimed long-range shot on the approach to the colony. This clears some of the targets and gives time to get another shot before doing another flyby.

#### A-rank requirement / strategy

Finish mission in 4:30 or less.

#### Mission roster

- **x24 Nanobite** \u2014 Default`,
      rankGuide: "Finish mission in 4:30 or less.",
      roster: [{ count: 24, name: "Nanobite", note: "Default" }],
      narrative: `In one of the weirder missions, some nanobite creatures have been released in the forests near Chopinburg and must be destroyed by special means. Any of the recent planes should work, although the F-22C has perhaps the best stats of any available now. All planes will be equipped with the Anti-Nanobite Bomb in the missile slot, and as you'll quickly find out, it's a ground bomb with no homing capacity.

The mission itself is fairly standard, although there will be a "virus alert" when you're at a certain radius from the nests, which darkens the screen and can cause crashes if you're at a declining angle. The A-N Bomb has an area of effect, so you'll want to aim it (with the hanging reticle) in the center of groups to score lots of kills with one boom. Try to avoid flying by the nests if y'can, as they may waste precious time.

On the flipside, Nanobites have no means of attack so one basically just has to aim well and this should be over soon. Remember that you want to aim between targets, not the targets theselves! Also, the loop-de-loop maneuvers are great for this mission as they cut down on attack recovery time and set up the player for a bird's-eye view of the bombing zone.`,
      role: "NANOBITE CONTAINMENT",
      brief:
        "Nanobite colonies have spread through the forests near Chopinburg. Conventional weapons are ineffective; deploy the anti-nanobite payload across each cluster.",
      objective: "Destroy all 24 colonies with Anti-Nanobite Bombs. Aim between nests.",
      radio: "Small bugs. Very large problem.",
      environment: "forest",
      aKills: 0,
      aTime: 270,
      expansion: !1,
    },
    {
      id: 19,
      title: "Blackbird",
      location: "White Valley",
      difficulty: "6/10",
      recommended: "RF-12A2 Blackbird",
      unlock: "---",
      source: `- **Location:** White Valley
- **Guide code:** WK19

- **Difficulty:** 6/10
- **Recommended:** RF-12A2 Blackbird
- **Unlock:** ---

Four R-531s are cruising a high-altitude flightpath en route to White Valley airbase, so it's time to intercept using the Blackbird last seen during the "Stratosphere" mission. It's the only option for these types, of course.

There four R-531s fly in line formation, so y'can gotta have a good touch to all this.

#### Mission update

After 1:30 has elapsed on the clock, 2 R-311s (per R-531) will sortie and become the new targets. Unlike the lumbering fool bombers that have been killed lately, these ones are fleet-footed speed demons and a lot harder to destroy, so y'want to minimize as many that as soon as possible.

#### A-rank requirement / strategy

One word: DIFFICULT. If the R-531s sortie their "spawn" the mission's pretty much flushed down the toilet, so that leaves a 1:30 prep time to destroy all four planes. Since they fly in a line, the best way is to fly perpendicularly to them -- again, also hard, given the gravity, altitude, crappy turning, etc.

How many times did I reset until it finally worked? Lord only knows. But, this is the general gist of what you wanna do:

1. Steer toward the leftmost of the 4-plane unit, coming up behind it at a parallel angle.
2. As you near closer (about within 4000 feet), arc slightly "rightwards," so that as y'shoot the leftmost plane, your plane's nose is already heading for the next-nearest plane. DECELERATE HERE.
3. Destroy the next-nearest (by the skin of your teeth!) as the player's plane enters a semi-perpendicular flightpath, heading for the third plane, which is probably higher than the 2nd one. Adjust altitude for it.
4. Destroy Plane #3 and hard-decelerate. About 0:45 should have passed on the clock.
5. There's 0:45 to defeat the final plane, which, often, is overshot and has to be killed in the next flyby (that's how I did it anyway). If it comes down to overshooting the target, accelerate and circle around, then attack from aft for an ensured kill.
> **Note:** This is one mission y'may want to leave for the simulator, later on.

#### Mission roster

- **x04 R-531** \u2014 Default
- **x04 R-311** \u2014 Mission Update`,
      rankGuide: `One word: DIFFICULT. If the R-531s sortie their "spawn" the mission's pretty much flushed down the toilet, so that leaves a 1:30 prep time to destroy all four planes. Since they fly in a line, the best way is to fly perpendicularly to them -- again, also hard, given the gravity, altitude, crappy turning, etc.

How many times did I reset until it finally worked? Lord only knows. But, this is the general gist of what you wanna do:

1. Steer toward the leftmost of the 4-plane unit, coming up behind it at a parallel angle.
2. As you near closer (about within 4000 feet), arc slightly "rightwards," so that as y'shoot the leftmost plane, your plane's nose is already heading for the next-nearest plane. DECELERATE HERE.
3. Destroy the next-nearest (by the skin of your teeth!) as the player's plane enters a semi-perpendicular flightpath, heading for the third plane, which is probably higher than the 2nd one. Adjust altitude for it.
4. Destroy Plane #3 and hard-decelerate. About 0:45 should have passed on the clock.
5. There's 0:45 to defeat the final plane, which, often, is overshot and has to be killed in the next flyby (that's how I did it anyway). If it comes down to overshooting the target, accelerate and circle around, then attack from aft for an ensured kill.
> **Note:** This is one mission y'may want to leave for the simulator, later on.`,
      roster: [
        { count: 4, name: "R-531", note: "Default" },
        { count: 4, name: "R-311", note: "Mission Update" },
      ],
      narrative: `Four R-531s are cruising a high-altitude flightpath en route to White Valley airbase, so it's time to intercept using the Blackbird last seen during the "Stratosphere" mission. It's the only option for these types, of course.

There four R-531s fly in line formation, so y'can gotta have a good touch to all this.

#### Mission update

After 1:30 has elapsed on the clock, 2 R-311s (per R-531) will sortie and become the new targets. Unlike the lumbering fool bombers that have been killed lately, these ones are fleet-footed speed demons and a lot harder to destroy, so y'want to minimize as many that as soon as possible.`,
      role: "CARRIER INTERCEPTION",
      brief:
        "Four R-531 carriers are approaching White Valley. Destroy them before they release their high-speed R-311 parasite fighters.",
      objective: "Destroy the four carriers before the 1:30 launch window. Blackbird required.",
      radio: "One target becomes three. Don\u2019t let it.",
      environment: "strato",
      aKills: 0,
      aTime: 90,
      expansion: !1,
    },
    {
      id: 20,
      title: "Fjord",
      location: "Petrol Coast",
      difficulty: "4/10",
      recommended: "F-15S/MT Eagle+ -or- F-22C Raptor II",
      unlock: "---",
      source: `- **Location:** Petrol Coast
- **Guide code:** WK20

- **Difficulty:** 4/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** ---

In the Petrol Coast, a logistics base is serving as a refueling point for Neuwork's fleet. However, the fjord (which is a craggy inlet with steep cliffs, if y'didn't know) terrane can make this less than a cakewalk. The Raptor II is still probably the best available plane, but the Eagle+ will suffice as well.

There's a nine-minute (9:00) time limit to finish all this in, which should be more than enough. The targets are parked under (unbreakable) cement roofs, so the only way to destroy them is at a near-level flightpath and aiming into the port structure. Try to do it from above and the shot's trashed. Only the convoys (third-from-north inlet) are out in the open seas.

#### Mission update

If Neuwork's mobile fleet (convoys, submarines) are not destroyed within the time limit, they'll launch almost immediately after. This situation isn't that dire as the waterborne crafts are mighty slow, so you could fly halfway across the map and back without much changing.

#### A-rank requirement / strategy

Destroy 30+ enemies (12 are mandatory). Despite the enemies situated in four inlets, this manages to be one of the easier "A"s achieved. Case in point: I defeated all enemies within 11:38:xx and still got an "A". Don't worry about the time limit whatsoever, as long as you're racking up a huge number of kills. [NOTE: Auxiliary ship targets, such as Convoy guns, don't count toward the 18+ kill requirement.]

#### Mission roster

- **x03 Convoy** \u2014 Default
- **x02 R-201** \u2014 Default
- **x10 R-211** \u2014 Default
- **x08 R-701** \u2014 Default
- **x03 Submarine** \u2014 Default
- **x06 Gun** \u2014 Default`,
      rankGuide: `Destroy 30+ enemies (12 are mandatory). Despite the enemies situated in four inlets, this manages to be one of the easier "A"s achieved. Case in point: I defeated all enemies within 11:38:xx and still got an "A". Don't worry about the time limit whatsoever, as long as you're racking up a huge number of kills. [NOTE: Auxiliary ship targets, such as Convoy guns, don't count toward the 18+ kill requirement.]`,
      roster: [
        { count: 3, name: "Convoy", note: "Default" },
        { count: 2, name: "R-201", note: "Default" },
        { count: 10, name: "R-211", note: "Default" },
        { count: 8, name: "R-701", note: "Default" },
        { count: 3, name: "Submarine", note: "Default" },
        { count: 6, name: "Gun", note: "Default" },
      ],
      narrative: `In the Petrol Coast, a logistics base is serving as a refueling point for Neuwork's fleet. However, the fjord (which is a craggy inlet with steep cliffs, if y'didn't know) terrane can make this less than a cakewalk. The Raptor II is still probably the best available plane, but the Eagle+ will suffice as well.

There's a nine-minute (9:00) time limit to finish all this in, which should be more than enough. The targets are parked under (unbreakable) cement roofs, so the only way to destroy them is at a near-level flightpath and aiming into the port structure. Try to do it from above and the shot's trashed. Only the convoys (third-from-north inlet) are out in the open seas.

#### Mission update

If Neuwork's mobile fleet (convoys, submarines) are not destroyed within the time limit, they'll launch almost immediately after. This situation isn't that dire as the waterborne crafts are mighty slow, so you could fly halfway across the map and back without much changing.`,
      role: "HARBOR STRIKE",
      brief:
        "Neuwork is refueling its fleet inside the steep inlets of Petrol Coast. Sheltered ships must be attacked through their open harbor entrances.",
      objective: "Approach sheltered targets low and level. At 9:00, surviving vessels depart.",
      radio: "Roofs are armor. Find the open door.",
      environment: "fjord",
      aKills: 30,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 21,
      title: "Counterterrorism",
      location: "Gulf of St. Ark",
      difficulty: "4/10",
      recommended: "F-15S/MT Eagle+ -or- F-22C Raptor II",
      unlock: "---",
      source: `- **Location:** Gulf of St. Ark
- **Guide code:** WK21

- **Difficulty:** 4/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** ---

A large carrier craft has been spotted flying over Megafloat, and it seems to be an attempt at a coup d'etat! The player's ordered to scramble immediately and shoot it down, with either of the recommended planes (above) working just fine on that end. [A funny note is how, in Ace Combat's world, St. Ark is in the far north and Rocky Island, where Megafloat's listed as being, is in the southwest sea -- worlds apart from each other.]

The flight starts with an interception flightpath at the UI-4053 zeppelin (!?) inbound from the southeast. This beast is formidable and is equipped with permanent AA gun and missile fixtures (can't be destroyed), and since its target is on the underside, the best method is to snipe at it, make distance, and try again -- this avoids most AA gunfire and provides wiggle room should any missiles lock-on. It takes x4 missiles to destroy each part, at least on normal difficulty, with a total of x16 shots required to defeat it. It's a good idea to fire missiles in a four-pack (top-tier planes can do this) while doing loop-de-loops behind the target, maintaining distance while avoiding the ever-increasing lock-ons.

> **Note:** Attack from level or slightly lower height; from above the target, the missiles simply hit the exterior harmlessly.

#### Mission update

When the carrier is significantly damaged, 4 more targets appear to escort it out of the hotbed you've created. A fast plane with four-missile capabilities should be able to get to this point in little over a minute, luck prevailing. The dirigible still has AA gun capabilities, by the way.

#### Mission update

Wow, a 2nd update. A single UI-4054 will appear to destroy. I believe this had some storyline significance but, as you may or not know, the NTSC version of this game had its plot butchered while the JP version retains the story and split-path storyline. Oh well. This sucker is slippery and does hairpin maneuvers quite easily while maintaining distance, so hopefully catch it off-guard and defeat it quickly (to preserve "A" rank, as it were).

Enjoy the Hindenburgian ending.

#### A-rank requirement / strategy

Defeat all targets within 4:00. A plane that can fire four missile at once should be able to achieve the mission update within 1:00, give or take a few seconds, which leaves ample time to destroy the four other planes. The blimp won't have any attack capabilities either, so there's no threat of missile lock-ons (this is mentioned since the planes arrive to escort the blimp out of the region).

#### Mission roster

- **x01 UI-4053** \u2014 Default
- **x01 SU-43** \u2014 Mission Update
- **x01 XFA-36A** \u2014 Mission Update
- **x01 UI-4054** \u2014 Mission Update [II]`,
      rankGuide:
        "Defeat all targets within 4:00. A plane that can fire four missile at once should be able to achieve the mission update within 1:00, give or take a few seconds, which leaves ample time to destroy the four other planes. The blimp won't have any attack capabilities either, so there's no threat of missile lock-ons (this is mentioned since the planes arrive to escort the blimp out of the region).",
      roster: [
        { count: 1, name: "UI-4053", note: "Default" },
        { count: 1, name: "SU-43", note: "Mission Update" },
        { count: 1, name: "XFA-36A", note: "Mission Update" },
        { count: 1, name: "UI-4054", note: "Mission Update [II]" },
      ],
      narrative: `A large carrier craft has been spotted flying over Megafloat, and it seems to be an attempt at a coup d'etat! The player's ordered to scramble immediately and shoot it down, with either of the recommended planes (above) working just fine on that end. [A funny note is how, in Ace Combat's world, St. Ark is in the far north and Rocky Island, where Megafloat's listed as being, is in the southwest sea -- worlds apart from each other.]

The flight starts with an interception flightpath at the UI-4053 zeppelin (!?) inbound from the southeast. This beast is formidable and is equipped with permanent AA gun and missile fixtures (can't be destroyed), and since its target is on the underside, the best method is to snipe at it, make distance, and try again -- this avoids most AA gunfire and provides wiggle room should any missiles lock-on. It takes x4 missiles to destroy each part, at least on normal difficulty, with a total of x16 shots required to defeat it. It's a good idea to fire missiles in a four-pack (top-tier planes can do this) while doing loop-de-loops behind the target, maintaining distance while avoiding the ever-increasing lock-ons.


#### Mission update

When the carrier is significantly damaged, 4 more targets appear to escort it out of the hotbed you've created. A fast plane with four-missile capabilities should be able to get to this point in little over a minute, luck prevailing. The dirigible still has AA gun capabilities, by the way.

#### Mission update

Wow, a 2nd update. A single UI-4054 will appear to destroy. I believe this had some storyline significance but, as you may or not know, the NTSC version of this game had its plot butchered while the JP version retains the story and split-path storyline. Oh well. This sucker is slippery and does hairpin maneuvers quite easily while maintaining distance, so hopefully catch it off-guard and defeat it quickly (to preserve "A" rank, as it were).

Enjoy the Hindenburgian ending.`,
      role: "AERIAL CARRIER ASSAULT",
      brief:
        "A heavily armed UI-4053 is advancing over Megafloat near the Gulf of St. Ark. Strike its exposed underside, then intercept the escaping aircraft.",
      objective: "Destroy four armored underside nodes, the escort wave, and the UI-4054.",
      radio: "Big aircraft. Small weak spots. Stay underneath.",
      environment: "ocean",
      aKills: 0,
      aTime: 240,
      expansion: !1,
    },
    {
      id: 22,
      title: "ECM",
      location: "Expo City",
      difficulty: "3/10",
      recommended: "F-15S/MT Eagle+ -or- F-22C Raptor II",
      unlock: "Su-37 Super Flanker",
      source: `- **Location:** Expo City
- **Guide code:** WK22

- **Difficulty:** 3/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** Su-37 Super Flanker

Ouroboros is operating an illegal weapons plant in Expo City, and their radar will be jammed to ensure a stealth entry into the region. An agile plane with decent power serves a guy well here, as both will be called upon frequently, if y'want the best rank, that is. The Raptor II works well.

So, about the mission's jamming periods. The game's timer here is replaced with a countdown clock ticking off 1:30 -- green means it's not safe to go below 12500ft, red means it is safe. When the jamming period is almost over, there'll be a notification to climb back up to a safe altitude to avoid any foes learning what's going on. This can be accomplished within about 0:10 if you aim straight upwards and gun it, so don't dawdle. After a jamming period, there's always a 0:15 until the next one, so this can be a long mission for people who aren't thorough -- or just like to destroy every little thing in the map.

Success in this mission is based on how well stealth is maintained -- "A" is for no enemy detection whatsoever while "D" is if the enemy did notice one's presence (no in-betweens).

#### Mission update

This can happen at any point in the mission. If the player's detected by the enemy radar (which makes jamming a useless measure) then twelve maneuverable planes of three sorts appear on the map. Note these aren't "targets", but are generic enemies meant to add insult to injury.

#### A-rank requirement / strategy

Finish mission without enemy being alerted to the player's presence. This (detection) happens if a player is below 12500ft when a jamming period is not active. Y'know you've left the jamming area because you're in the blue skies above the cloud cover, which, from my layman understanding, is necessary to bounce radar waves off of? Maybe? Yeah, that's the ticket...

#### Mission roster

- **x02 Pr.Plant** \u2014 Default
- **x07 Radarsite** \u2014 Default
- **x02 AH-66B** \u2014 Default
- **x03 F/A-32C** \u2014 Mission Update
- **x05 F-22C** \u2014 Mission Update
- **x04 RF-12A2** \u2014 Mission Update`,
      rankGuide:
        "Finish mission without enemy being alerted to the player's presence. This (detection) happens if a player is below 12500ft when a jamming period is not active. Y'know you've left the jamming area because you're in the blue skies above the cloud cover, which, from my layman understanding, is necessary to bounce radar waves off of? Maybe? Yeah, that's the ticket...",
      roster: [
        { count: 2, name: "Pr.Plant", note: "Default" },
        { count: 7, name: "Radarsite", note: "Default" },
        { count: 2, name: "AH-66B", note: "Default" },
        { count: 3, name: "F/A-32C", note: "Mission Update" },
        { count: 5, name: "F-22C", note: "Mission Update" },
        { count: 4, name: "RF-12A2", note: "Mission Update" },
      ],
      narrative: `Ouroboros is operating an illegal weapons plant in Expo City, and their radar will be jammed to ensure a stealth entry into the region. An agile plane with decent power serves a guy well here, as both will be called upon frequently, if y'want the best rank, that is. The Raptor II works well.

So, about the mission's jamming periods. The game's timer here is replaced with a countdown clock ticking off 1:30 -- green means it's not safe to go below 12500ft, red means it is safe. When the jamming period is almost over, there'll be a notification to climb back up to a safe altitude to avoid any foes learning what's going on. This can be accomplished within about 0:10 if you aim straight upwards and gun it, so don't dawdle. After a jamming period, there's always a 0:15 until the next one, so this can be a long mission for people who aren't thorough -- or just like to destroy every little thing in the map.

Success in this mission is based on how well stealth is maintained -- "A" is for no enemy detection whatsoever while "D" is if the enemy did notice one's presence (no in-betweens).

#### Mission update

This can happen at any point in the mission. If the player's detected by the enemy radar (which makes jamming a useless measure) then twelve maneuverable planes of three sorts appear on the map. Note these aren't "targets", but are generic enemies meant to add insult to injury.`,
      role: "ELECTRONIC WARFARE",
      brief:
        "Ouroboros operates an illegal weapons plant in Expo City. Friendly jamming creates short windows for a strike below the cloud layer.",
      objective: "Attack during 90-second jamming windows. Above 12,500 ft during each 15-second gap.",
      radio: "When the jammer goes quiet, climb.",
      environment: "city",
      aKills: 0,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 23,
      title: "Swarm",
      location: "Eusian Ocean",
      difficulty: "4/10",
      recommended: "F-22C Raptor II -or- Su-37 Super Flanker",
      unlock: "R-102 Delphinus #2",
      source: `- **Location:** Eusian Ocean
- **Guide code:** WK23

- **Difficulty:** 4/10
- **Recommended:** F-22C Raptor II -or- Su-37 Super Flanker
- **Unlock:** R-102 Delphinus #2

Despite repeated warnings by UPEO, the Neuwork airforce has continued to mobilize on Megafloat. That's the last straw -- destroy all their planes! The Su-37 Super Flanker has the best stats at the moment, but doesn't have that many weapon options -- normal Missiles are better than short-range ones, at least.

In a first for the mission, there'll be an ally plane (Su-43) who'll assist in destroying the foes, and boy, are they out in force. There are twenty-six aerial targets in loose clusters, and the name derives from the enemy's "swarm" ability, which happens when a cluster is approached -- they all go for the jugular. Of course, not many are that good a pilot, so this isn't as hard as it is lengthy. Just remember to play opportunistically and don't chase one around at close range when y'can switch to a mid-range target and gun it down.

#### Mission update

When the aerial masses are finally sent to the ocean floor, Megafloat's navy becomes the next entry to cross off the hitlist. Megafloat itself has a few armaments (basically the same things seen in fourth eponymous mission) and other non-targets, such as helicopters and a few buildings.

#### A-rank requirement / strategy

Score 34 kills (26 are mandatory). The generic targets appear on Megafloat during the update, so basically destroy all foreign armaments on the island before turning one's sights to the navy. The ally Su-43's kills are added to the player's, but he doesn't really do anything during the update, which is actually good when it comes to reaching the quota.

#### Mission roster

- **x05 R-101** \u2014 Default
- **x05 R-102** \u2014 Default
- **x06 R-103** \u2014 Default
- **x05 R-201** \u2014 Default
- **x05 R-211** \u2014 Default
- **x06 MSSL** \u2014 Mission Update
- **x12 Gun** \u2014 Mission Update
- **x04 Convoy** \u2014 Mission Update
- **x02 Carrier** \u2014 Mission Update
- **x05 V-22B** \u2014 Mission Update [Non-TGT]`,
      rankGuide:
        "Score 34 kills (26 are mandatory). The generic targets appear on Megafloat during the update, so basically destroy all foreign armaments on the island before turning one's sights to the navy. The ally Su-43's kills are added to the player's, but he doesn't really do anything during the update, which is actually good when it comes to reaching the quota.",
      roster: [
        { count: 5, name: "R-101", note: "Default" },
        { count: 5, name: "R-102", note: "Default" },
        { count: 6, name: "R-103", note: "Default" },
        { count: 5, name: "R-201", note: "Default" },
        { count: 5, name: "R-211", note: "Default" },
        { count: 6, name: "MSSL", note: "Mission Update" },
        { count: 12, name: "Gun", note: "Mission Update" },
        { count: 4, name: "Convoy", note: "Mission Update" },
        { count: 2, name: "Carrier", note: "Mission Update" },
        { count: 5, name: "V-22B", note: "Mission Update [Non-TGT]" },
      ],
      narrative: `Despite repeated warnings by UPEO, the Neuwork airforce has continued to mobilize on Megafloat. That's the last straw -- destroy all their planes! The Su-37 Super Flanker has the best stats at the moment, but doesn't have that many weapon options -- normal Missiles are better than short-range ones, at least.

In a first for the mission, there'll be an ally plane (Su-43) who'll assist in destroying the foes, and boy, are they out in force. There are twenty-six aerial targets in loose clusters, and the name derives from the enemy's "swarm" ability, which happens when a cluster is approached -- they all go for the jugular. Of course, not many are that good a pilot, so this isn't as hard as it is lengthy. Just remember to play opportunistically and don't chase one around at close range when y'can switch to a mid-range target and gun it down.

#### Mission update

When the aerial masses are finally sent to the ocean floor, Megafloat's navy becomes the next entry to cross off the hitlist. Megafloat itself has a few armaments (basically the same things seen in fourth eponymous mission) and other non-targets, such as helicopters and a few buildings.`,
      role: "AIR-SUPERIORITY SWEEP",
      brief:
        "Neuwork has mobilized a large air force around Megafloat despite repeated warnings. A friendly Su-43 will assist your sweep.",
      objective: "Clear 26 hostile aircraft, then dismantle the naval force.",
      radio: "They brought a swarm. We brought you.",
      environment: "ocean",
      aKills: 34,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 24,
      title: "Damage Control",
      location: "Port Edwards",
      difficulty: "4/10",
      recommended: "Su-37 Super Flanker -or- R-102 Delphinus #2",
      unlock: "---",
      source: `- **Location:** Port Edwards
- **Guide code:** WK24

- **Difficulty:** 4/10
- **Recommended:** Su-37 Super Flanker -or- R-102 Delphinus #2
- **Unlock:** ---

Because of the actions taken aboard Megafloat, General Resources has mobilized its own air fleet and this has caused fighting to break out over Port Edwards! Some civilian press choppers have also been caught in the crossfire, so it's time to mitigate the conflict and save our reporters! Either of the two latest planes should suffice, although the Delphinus #2 gets a swazzy Pulse Laser to replace normal machine-guns!

As expected, it's typical dogfighting action. The planes travel in packs of 3-5 and are spread out across the city, but when one's almost dead another seems to join the fray, so the fighting is often continuous. Each group has one or two planes marked as the real targets, though, so a lot of the others can be ignored for these purposes. [Also, the news choppers aren't actually threatened by the other planes, so this isn't a protection gig.]

#### Mission update

When all crucial targets are buried, four targets in Port Edwards' southeast district. Since time isn't a rank-based factor in this mission, and the friendly fliers aren't endangered, dismantle their crafts at leisure.

#### A-rank requirement / strategy

Destroy 22 of 28 enemies (10 mandatory). Time doesn't factor into this, so it basically turns the entire map into a free-for-all. I killed everyone but the friendlies within 10:20:xx and still got an "A," so...hakuna matata, man!

#### Mission roster

- **x03 R-102** \u2014 Default
- **x06 R-103** \u2014 Default [x2 Mission Update]
- **x06 F-22C** \u2014 Default
- **x07 XFA-36A** \u2014 Default
- **x04 V-22B** \u2014 Default [Non-TGT]
- **x02 F/A-32C** \u2014 Mission Update`,
      rankGuide: `Destroy 22 of 28 enemies (10 mandatory). Time doesn't factor into this, so it basically turns the entire map into a free-for-all. I killed everyone but the friendlies within 10:20:xx and still got an "A," so...hakuna matata, man!`,
      roster: [
        { count: 3, name: "R-102", note: "Default" },
        { count: 6, name: "R-103", note: "Default [x2 Mission Update]" },
        { count: 6, name: "F-22C", note: "Default" },
        { count: 7, name: "XFA-36A", note: "Default" },
        { count: 4, name: "V-22B", note: "Default [Non-TGT]" },
        { count: 2, name: "F/A-32C", note: "Mission Update" },
      ],
      narrative: `Because of the actions taken aboard Megafloat, General Resources has mobilized its own air fleet and this has caused fighting to break out over Port Edwards! Some civilian press choppers have also been caught in the crossfire, so it's time to mitigate the conflict and save our reporters! Either of the two latest planes should suffice, although the Delphinus #2 gets a swazzy Pulse Laser to replace normal machine-guns!

As expected, it's typical dogfighting action. The planes travel in packs of 3-5 and are spread out across the city, but when one's almost dead another seems to join the fray, so the fighting is often continuous. Each group has one or two planes marked as the real targets, though, so a lot of the others can be ignored for these purposes. [Also, the news choppers aren't actually threatened by the other planes, so this isn't a protection gig.]

#### Mission update

When all crucial targets are buried, four targets in Port Edwards' southeast district. Since time isn't a rank-based factor in this mission, and the friendly fliers aren't endangered, dismantle their crafts at leisure.`,
      role: "URBAN AIRSPACE CONTROL",
      brief:
        "Fighting between Neuwork and General Resources has spread over Port Edwards. Clear the hostile formations while keeping civilian press helicopters safe.",
      objective: "Destroy the marked aircraft in both waves. Do not hit the news helicopters.",
      radio: "Everyone is watching. Give them a reason to look up.",
      environment: "harbor",
      aKills: 22,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 25,
      title: "Conspiracy",
      location: "Expo City",
      difficulty: "3/10",
      recommended: "Su-37 Super Flanker -or- R-102 Delphinus #2",
      unlock: "Su-43 Berkut, R211 Orcinus",
      source: `- **Location:** Expo City
- **Guide code:** WK25

- **Difficulty:** 3/10
- **Recommended:** Su-37 Super Flanker -or- R-102 Delphinus #2
- **Unlock:** Su-43 Berkut, R211 Orcinus

As it turns out, the Neuwork/General Sources fight that's been going on has been instigated by an Ouroboros outpost in Expo City (a.k.a. City of Eternal Night!) and the clearance from the higher-ups has been given for a bombing run. Either of the top-ranking planes should suffice for this raid.

The target planes are flying all around the city, but the target buildings're rather easy to destroy. There's not too many MSSL launchers in this map but there's still a few Guns here. Overall, pretty generic target requirements, exemplified by the time limit's uselessness (this is a kill-based mission and the counter is unimportant, so take as much time as y'need).

#### Mission update

After a cutscene, the enemy personnel's V-22B helicopter will try to take off from its underground hangar. The player's plane will be situated in front of it, so do a careful run into the hangar and blow it up, which ends the mission with finesse.

#### A-rank requirement / strategy

Defeat 21+ of the 24 targets (10 are mandatory). Like the previous mission, time is not a factor so destroy any and everything at your leisure and still obtain an "A" (I did it in 7:53:xx).

#### Mission roster

- **x04 Base** \u2014 Default
- **x03 R-211** \u2014 Default
- **x03 Su-37** \u2014 Default
- **x04 Su-43** \u2014 Default
- **x03 MSSL** \u2014 Default
- **x06 Gun** \u2014 Default
- **x01 V-22B** \u2014 Mission Update`,
      rankGuide:
        'Defeat 21+ of the 24 targets (10 are mandatory). Like the previous mission, time is not a factor so destroy any and everything at your leisure and still obtain an "A" (I did it in 7:53:xx).',
      roster: [
        { count: 4, name: "Base", note: "Default" },
        { count: 3, name: "R-211", note: "Default" },
        { count: 3, name: "Su-37", note: "Default" },
        { count: 4, name: "Su-43", note: "Default" },
        { count: 3, name: "MSSL", note: "Default" },
        { count: 6, name: "Gun", note: "Default" },
        { count: 1, name: "V-22B", note: "Mission Update" },
      ],
      narrative: `As it turns out, the Neuwork/General Sources fight that's been going on has been instigated by an Ouroboros outpost in Expo City (a.k.a. City of Eternal Night!) and the clearance from the higher-ups has been given for a bombing run. Either of the top-ranking planes should suffice for this raid.

The target planes are flying all around the city, but the target buildings're rather easy to destroy. There's not too many MSSL launchers in this map but there's still a few Guns here. Overall, pretty generic target requirements, exemplified by the time limit's uselessness (this is a kill-based mission and the counter is unimportant, so take as much time as y'need).

#### Mission update

After a cutscene, the enemy personnel's V-22B helicopter will try to take off from its underground hangar. The player's plane will be situated in front of it, so do a careful run into the hangar and blow it up, which ends the mission with finesse.`,
      role: "OUROBOROS OUTPOST RAID",
      brief:
        "An Ouroboros outpost has been provoking the corporate conflict from Expo City. Strike its facilities and intercept the personnel escaping through an underground hangar.",
      objective: "Destroy the primary targets, then eliminate the escaping V-22B inside the hangar.",
      radio: "We found the hand behind the curtain.",
      environment: "city",
      aKills: 21,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 26,
      title: "Intercept",
      location: "Eusian Ocean",
      difficulty: "4/10",
      recommended: "R-102 Delphinus #2 -or- Su-43 Berkut",
      unlock: "---",
      source: `- **Location:** Eusian Ocean
- **Guide code:** WK26

- **Difficulty:** 4/10
- **Recommended:** R-102 Delphinus #2 -or- Su-43 Berkut
- **Unlock:** ---

Neuwark's space research satellite has splashed down in the ocean and the hydrofoils from Megafloat are en route to collect it; however, General Resources is also aiming for that goal and have their own seacrafts tagging along. Time to scramble and make G.R. eat some dust...err, water dust. Err, sea dust. Okay, forget the metaphors! Two new planes were obtained recently and the best of the two is the Su-43 Berkut, undoubtedly.

The object of this mission is to prevent the enemy ships from contacting the shuttle first -- if they do, it's a failure. So, prioritize: at the start, head due south and destroy the target vessels, already dangerously close to the capsule ignoring the airplanes. There's a 2:00 time limit for this part.

#### Mission update

When all enemy ships are sunk, a reinforcement fleet shows up, and this one has faster hydrofoils. Again, not hard to defeat inherently, but a bit tough to deal with when grappling with the "A" rank challenge.

Always remember that this is a give-and-take mission: if you puppyguard the allies, the ships will get the satellite; if you don't destroy the ships fast enough, the aircraft will beat the crap out of the friendlies.

#### A-rank requirement / strategy

Defeat 28 enemies (20 are mandatory ship-based enemies). Although there's not a lot of time to screw around in, the basic gist of doing this is to create a window of opportunity. In the feat, defeat all but the farthest from the satellite and start decimating some aircraft. Hopefully this also takes some heat off the allied Neuwark hydrofoils inbound to collect their shuttle. If another window is needed for the 2nd and final wave, defeat all the hydrofoils and destroy all but the farthest convoy, and commence more killing.

Personally, here's my strategy:

1. En route to satellite, destroy one plane coming head-on
2. Turn around and defeat at least 2-4 more heading for the friendly h'foils
3. Defeat all ships in under 2:00 (mission failure is actually 1:56)
4. During mission update, kill [8-x] amount to reach 8 kills
5. Kill remaining ships
Note that, as long as you realize that the oncoming planes at the start are going towards the hydrofoils, you can sneak up behind them...if you react fast enough. Other planes try to engage a player and mess up their bearings, but many planes go straight north -- a guy can kill about 5 here! [I would recommend only killing four, as it wastes too much time to get back.]

> **Note:** If the ally hydrofoil unit is destroyed, a "D" is automatically gained.

> **Note:** You must destroy all ships to get an "A". If the ally hydrofoiils reach the target first, y'only get a "B". [I think this happens at 4:30]

#### Mission roster

- **x01 Satellite** \u2014 Default [Ally]
- **x04 Hydrofoil** \u2014 Default [Ally]
- **x01 Carrier** \u2014 Default
- **x06 Convoy** \u2014 Default [x2 Mission Update]
- **x01 MSSL** \u2014 Default [Ship-based]
- **x08 Gun** \u2014 Default [Ship-based]
- **x06 XFA-36A** \u2014 Default
- **x02 F-22C** \u2014 Default
- **x02 C-17B** \u2014 Mission Update
- **x04 Hydrofoil** \u2014 Mission Update`,
      rankGuide: `Defeat 28 enemies (20 are mandatory ship-based enemies). Although there's not a lot of time to screw around in, the basic gist of doing this is to create a window of opportunity. In the feat, defeat all but the farthest from the satellite and start decimating some aircraft. Hopefully this also takes some heat off the allied Neuwark hydrofoils inbound to collect their shuttle. If another window is needed for the 2nd and final wave, defeat all the hydrofoils and destroy all but the farthest convoy, and commence more killing.

Personally, here's my strategy:

1. En route to satellite, destroy one plane coming head-on
2. Turn around and defeat at least 2-4 more heading for the friendly h'foils
3. Defeat all ships in under 2:00 (mission failure is actually 1:56)
4. During mission update, kill [8-x] amount to reach 8 kills
5. Kill remaining ships
Note that, as long as you realize that the oncoming planes at the start are going towards the hydrofoils, you can sneak up behind them...if you react fast enough. Other planes try to engage a player and mess up their bearings, but many planes go straight north -- a guy can kill about 5 here! [I would recommend only killing four, as it wastes too much time to get back.]

> **Note:** If the ally hydrofoil unit is destroyed, a "D" is automatically gained.

> **Note:** You must destroy all ships to get an "A". If the ally hydrofoiils reach the target first, y'only get a "B". [I think this happens at 4:30]`,
      roster: [
        { count: 1, name: "Satellite", note: "Default [Ally]" },
        { count: 4, name: "Hydrofoil", note: "Default [Ally]" },
        { count: 1, name: "Carrier", note: "Default" },
        { count: 6, name: "Convoy", note: "Default [x2 Mission Update]" },
        { count: 1, name: "MSSL", note: "Default [Ship-based]" },
        { count: 8, name: "Gun", note: "Default [Ship-based]" },
        { count: 6, name: "XFA-36A", note: "Default" },
        { count: 2, name: "F-22C", note: "Default" },
        { count: 2, name: "C-17B", note: "Mission Update" },
        { count: 4, name: "Hydrofoil", note: "Mission Update" },
      ],
      narrative: `Neuwark's space research satellite has splashed down in the ocean and the hydrofoils from Megafloat are en route to collect it; however, General Resources is also aiming for that goal and have their own seacrafts tagging along. Time to scramble and make G.R. eat some dust...err, water dust. Err, sea dust. Okay, forget the metaphors! Two new planes were obtained recently and the best of the two is the Su-43 Berkut, undoubtedly.

The object of this mission is to prevent the enemy ships from contacting the shuttle first -- if they do, it's a failure. So, prioritize: at the start, head due south and destroy the target vessels, already dangerously close to the capsule ignoring the airplanes. There's a 2:00 time limit for this part.

#### Mission update

When all enemy ships are sunk, a reinforcement fleet shows up, and this one has faster hydrofoils. Again, not hard to defeat inherently, but a bit tough to deal with when grappling with the "A" rank challenge.

Always remember that this is a give-and-take mission: if you puppyguard the allies, the ships will get the satellite; if you don't destroy the ships fast enough, the aircraft will beat the crap out of the friendlies.`,
      role: "RECOVERY-ZONE DEFENSE",
      brief:
        "Neuwork\u2019s research satellite has splashed down in the Eusian Ocean. General Resources vessels are racing allied hydrofoils to the capsule.",
      objective: "Stop the first fleet within 1:56 and intercept the second. Preserve the recovery team.",
      radio: "Get between those ships and the capsule.",
      environment: "ocean",
      aKills: 28,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 27,
      title: "Plumber",
      location: "White Valley",
      difficulty: "2/10",
      recommended: "R-102 Delphinus #2 -or- Su-43 Berkut",
      unlock: "R-103 Delphinus #3",
      source: `- **Location:** White Valley
- **Guide code:** WK27

- **Difficulty:** 2/10
- **Recommended:** R-102 Delphinus #2 -or- Su-43 Berkut
- **Unlock:** R-103 Delphinus #3

General Resources' radar dishes have been intercepting state secrets with their powerful technology, so now it's time to "dish" out some punishment and burn 'em to the ground. The Berkut pulls its weight during this mission, and is recommended.

As said, their radar detects incoming aircraft if they're above 1300ft, so it's crucial to stay below that (a "D" is received for those not cleared to go above it). This stealthy approach applies only to the lead-up, however -- the terrane eventually steepens in preparation to the basin, at which time "cleared to engage" appears, which tells one there's no need to stick to radar cover any longer. The ground targets are conveniently located in a circle, and there will only be two planes to destroy.

> **Note:** If the enemy's radar is spiked, four F-22Cs also appear when the base is approached.

#### A-rank requirement / strategy

Defeat 14+ targets (8 mandatory). This is ridiculously easy and can be done just by removing the ground targets alone.

#### Mission roster

- **x01 Carrier** \u2014 Default [Ally]
- **x02 F-15S/MT** \u2014 Default
- **x08 Radarsite** \u2014 Default
- **x02 MSSL** \u2014 Default
- **x04 Gun** \u2014 Default
- **x04 F-22C** \u2014 Spawns only if radar is spiked`,
      rankGuide:
        "Defeat 14+ targets (8 mandatory). This is ridiculously easy and can be done just by removing the ground targets alone.",
      roster: [
        { count: 1, name: "Carrier", note: "Default [Ally]" },
        { count: 2, name: "F-15S/MT", note: "Default" },
        { count: 8, name: "Radarsite", note: "Default" },
        { count: 2, name: "MSSL", note: "Default" },
        { count: 4, name: "Gun", note: "Default" },
        { count: 4, name: "F-22C", note: "Spawns only if radar is spiked" },
      ],
      narrative: `General Resources' radar dishes have been intercepting state secrets with their powerful technology, so now it's time to "dish" out some punishment and burn 'em to the ground. The Berkut pulls its weight during this mission, and is recommended.

As said, their radar detects incoming aircraft if they're above 1300ft, so it's crucial to stay below that (a "D" is received for those not cleared to go above it). This stealthy approach applies only to the lead-up, however -- the terrane eventually steepens in preparation to the basin, at which time "cleared to engage" appears, which tells one there's no need to stick to radar cover any longer. The ground targets are conveniently located in a circle, and there will only be two planes to destroy.`,
      role: "TERRAIN-MASKED STRIKE",
      brief:
        "General Resources radar dishes are intercepting state secrets near White Valley. Approach below their surveillance envelope and destroy the array.",
      objective: "Stay below 1,300 ft until cleared to engage. Destroy eight radars.",
      radio: "Low altitude. High stakes.",
      environment: "snow",
      aKills: 14,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 28,
      title: "Pathfinder",
      location: "Expo City",
      difficulty: "3/10",
      recommended: "Su-43 Berkut -or- R-103 Delphinus #3",
      unlock: "---",
      source: `- **Location:** Expo City
- **Guide code:** WK28

- **Difficulty:** 3/10
- **Recommended:** Su-43 Berkut -or- R-103 Delphinus #3
- **Unlock:** ---

Ouroboros has kidnapped the NUN chairman and UPEO has green-lighted the retrieval mission, which entails securing a path for the rescue crews. The Delphinus #3 is a good pick for this mission, as it has a good selection of missiles (normal, MIRV) and guns (normal, cannon, pulse).

Like usual, Expo City is cloaked in nightfall and filled with a wide array of ground targets; the kicker is the inclusion of ten tanks, which take a bit more effort to neutralize. Once approached, there'll be a gaggle of planes to sift through, but other than that, business as usual. If there's one annoying part to this mission, it's that the planes follow incessantly, so one often has to break away and try again, rather than aim for good shots in the middle of the pack.

#### Mission update

Once the chairman's rescued in the first half, the second half focuses on a retreat strategy, with the player at the helm, of course. There's a couple bases and a close-knit group of Su-43s as well, but nothing too hard. Make sure to destroy any targets harassing the R-201U escape vehicle, however.

#### A-rank requirement / strategy

Defeat 31+ targets (26 mandatory). Very easy, considering how many measly ground troops there are, as well as time not factoring into the completion time.

#### Mission roster

- **x01 R-201U** \u2014 Default
- **x06 Su-37** \u2014 Default [x2 Mission Update]
- **x14 Tank** \u2014 Default [x4 Mission Update]
- **x02 R-101U** \u2014 Default
- **x02 Base** \u2014 Mission Update
- **x06 Su-43** \u2014 Mission Update
- **x01 R-201U** \u2014 Mission Update [Ally]`,
      rankGuide:
        "Defeat 31+ targets (26 mandatory). Very easy, considering how many measly ground troops there are, as well as time not factoring into the completion time.",
      roster: [
        { count: 1, name: "R-201U", note: "Default" },
        { count: 6, name: "Su-37", note: "Default [x2 Mission Update]" },
        { count: 14, name: "Tank", note: "Default [x4 Mission Update]" },
        { count: 2, name: "R-101U", note: "Default" },
        { count: 2, name: "Base", note: "Mission Update" },
        { count: 6, name: "Su-43", note: "Mission Update" },
        { count: 1, name: "R-201U", note: "Mission Update [Ally]" },
      ],
      narrative: `Ouroboros has kidnapped the NUN chairman and UPEO has green-lighted the retrieval mission, which entails securing a path for the rescue crews. The Delphinus #3 is a good pick for this mission, as it has a good selection of missiles (normal, MIRV) and guns (normal, cannon, pulse).

Like usual, Expo City is cloaked in nightfall and filled with a wide array of ground targets; the kicker is the inclusion of ten tanks, which take a bit more effort to neutralize. Once approached, there'll be a gaggle of planes to sift through, but other than that, business as usual. If there's one annoying part to this mission, it's that the planes follow incessantly, so one often has to break away and try again, rather than aim for good shots in the middle of the pack.

#### Mission update

Once the chairman's rescued in the first half, the second half focuses on a retreat strategy, with the player at the helm, of course. There's a couple bases and a close-knit group of Su-43s as well, but nothing too hard. Make sure to destroy any targets harassing the R-201U escape vehicle, however.`,
      role: "RESCUE CORRIDOR",
      brief:
        "Ouroboros has kidnapped the NUN chairman. Clear a path through Expo City, then escort the R-201U rescue aircraft out of the danger zone.",
      objective: "Clear the armored corridor and defend the escape aircraft during the second phase.",
      radio: "This time, we bring the chairman home.",
      environment: "city",
      aKills: 31,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 29,
      title: "Ouroboros",
      location: "Port Edwards",
      difficulty: "4/10",
      recommended: "Su-43 Berkut -or- R-103 Delphinus #3",
      unlock: "XFA-36A Game",
      source: `- **Location:** Port Edwards
- **Guide code:** WK29

- **Difficulty:** 4/10
- **Recommended:** Su-43 Berkut -or- R-103 Delphinus #3
- **Unlock:** XFA-36A Game

Port Edwards is under attack by Ouroboros' air force, so it's time to get in gear and neutralize. As y'can expect, this isn't a very inventive mission so just pack up the best plane y'got.

There are six XFA-35As to deal with first, and they're split into two groups. We've seen their song and dance before...nothing special, right? The same goes for the squadron of Su-37s, on the east side of the map. If y'didn't enjoy the annoying free-for-all of the previous mission, too bad -- it's a near repeat. [Although they're not as feisty as before, seemingly.] If the swarm gets too thick, fly away and reassess before jumpin' back in.

#### Mission update

When the initial force is toast, Ouroboros' aircraft carrier will be shown flying in the north. The UI-4053 has four escort fighters, but they're not the main concern (unless you're going for "A" rank) -- the target ship is the same kind seen in "Counterterrorism". It has permanent missile and AA gun fixtures and requires 16 missiles (x4 for each target) before it'll give up the ghost. Any plane that can fire four missiles at once is in luck, as the same strategy as back then applies here. [Also remember that higher trajectories will not work as the targets are on the blimp's underside.]

#### A-rank requirement / strategy

Defeat 18+ targets (11 mandatory). There are no ground targets here so one'll have to nuke 11+ of the 14 generic planes. Luckily the player isn't on the clock here, so destroy and dismantle in due time.

#### Mission roster

- **x06 XFA-35A** \u2014 Default
- **x10 Su-37** \u2014 Default
- **x01 UI-4053** \u2014 Mission Update
- **x02 R-103** \u2014 Mission Update
- **x02 Su-32** \u2014 Mission Update`,
      rankGuide:
        "Defeat 18+ targets (11 mandatory). There are no ground targets here so one'll have to nuke 11+ of the 14 generic planes. Luckily the player isn't on the clock here, so destroy and dismantle in due time.",
      roster: [
        { count: 6, name: "XFA-35A", note: "Default" },
        { count: 10, name: "Su-37", note: "Default" },
        { count: 1, name: "UI-4053", note: "Mission Update" },
        { count: 2, name: "R-103", note: "Mission Update" },
        { count: 2, name: "Su-32", note: "Mission Update" },
      ],
      narrative: `Port Edwards is under attack by Ouroboros' air force, so it's time to get in gear and neutralize. As y'can expect, this isn't a very inventive mission so just pack up the best plane y'got.

There are six XFA-35As to deal with first, and they're split into two groups. We've seen their song and dance before...nothing special, right? The same goes for the squadron of Su-37s, on the east side of the map. If y'didn't enjoy the annoying free-for-all of the previous mission, too bad -- it's a near repeat. [Although they're not as feisty as before, seemingly.] If the swarm gets too thick, fly away and reassess before jumpin' back in.

#### Mission update

When the initial force is toast, Ouroboros' aircraft carrier will be shown flying in the north. The UI-4053 has four escort fighters, but they're not the main concern (unless you're going for "A" rank) -- the target ship is the same kind seen in "Counterterrorism". It has permanent missile and AA gun fixtures and requires 16 missiles (x4 for each target) before it'll give up the ghost. Any plane that can fire four missiles at once is in luck, as the same strategy as back then applies here. [Also remember that higher trajectories will not work as the targets are on the blimp's underside.]`,
      role: "CARRIER PURSUIT",
      brief:
        "Ouroboros fighters are attacking Port Edwards. Break their initial formation, then pursue the aerial carrier revealed to the north.",
      objective: "Clear the marked fighters and strike all four underside nodes of the UI-4053.",
      radio: "Same carrier design. Same weak belly.",
      environment: "harbor",
      aKills: 18,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 30,
      title: "Search and Destroy",
      location: "Eusian Ocean",
      difficulty: "3/10",
      recommended: "R-103 Delphinus #3 -or- XFA-36A Game",
      unlock: "---",
      source: `- **Location:** Eusian Ocean
- **Guide code:** WK30

- **Difficulty:** 3/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** ---

Ouroboros' navy is apparently heading toward Megafloat in an attempt to take control, so now it's time to nip another problem in the bud. The new XFA-36A Game gets the best gun/missile selection and stats of any plane so far, and is the obvious pick for the mission.

The mission starts over Megafloat, already awash in overhead activity and a maritime military presence (although no land fortifications, as they were destroyed earlier).

#### Mission update

After the awesome Megafloat cutscene, the new target will be the UI-4053 that flies at 10,000ft over the southwestern island in the archipelago. As we've seen before, this tough puppy is equipped with permanent weapon emplacements and takes 16 missiles (x4/per target) to destroy. Any plane that can fire four missiles at once, and by now that should be all of 'em, can destroy it without too much trouble: flyby to destroy a target, loop-de-loop a ways away, and repeat. Remember that y'have to shoot at level or lower altitude to score the hits; higher hits simply hit the "overbelly" and do no damage. Aim for the soft, white underbelly!

#### A-rank requirement / strategy

Destroy 23+ targets (14 mandatory). Time is no factor here, and there's plenty of generic planes to deep-six, and they'll still be there during the mission update portion. Voila!

#### Mission roster

- **x08 XFA-36A** \u2014 Default
- **x03 S.Warship** \u2014 Default
- **x01 Carrier** \u2014 Default
- **x08 Gun** \u2014 Default
- **x01 MSSL** \u2014 Default
- **x01 UI-4053** \u2014 Mission Update
- **x06 R-103** \u2014 Mission Update
> **Note:** The end of this mission segues into the next without time to save!`,
      rankGuide:
        "Destroy 23+ targets (14 mandatory). Time is no factor here, and there's plenty of generic planes to deep-six, and they'll still be there during the mission update portion. Voila!",
      roster: [
        { count: 8, name: "XFA-36A", note: "Default" },
        { count: 3, name: "S.Warship", note: "Default" },
        { count: 1, name: "Carrier", note: "Default" },
        { count: 8, name: "Gun", note: "Default" },
        { count: 1, name: "MSSL", note: "Default" },
        { count: 1, name: "UI-4053", note: "Mission Update" },
        { count: 6, name: "R-103", note: "Mission Update" },
      ],
      narrative: `Ouroboros' navy is apparently heading toward Megafloat in an attempt to take control, so now it's time to nip another problem in the bud. The new XFA-36A Game gets the best gun/missile selection and stats of any plane so far, and is the obvious pick for the mission.

The mission starts over Megafloat, already awash in overhead activity and a maritime military presence (although no land fortifications, as they were destroyed earlier).

#### Mission update

After the awesome Megafloat cutscene, the new target will be the UI-4053 that flies at 10,000ft over the southwestern island in the archipelago. As we've seen before, this tough puppy is equipped with permanent weapon emplacements and takes 16 missiles (x4/per target) to destroy. Any plane that can fire four missiles at once, and by now that should be all of 'em, can destroy it without too much trouble: flyby to destroy a target, loop-de-loop a ways away, and repeat. Remember that y'have to shoot at level or lower altitude to score the hits; higher hits simply hit the "overbelly" and do no damage. Aim for the soft, white underbelly!`,
      role: "MEGAFLOAT OFFENSIVE",
      brief:
        "Ouroboros naval forces are moving to take Megafloat. Defeat the fleet and its aerial carrier before the operation moves underground.",
      objective: "Clear the naval targets, then destroy the UI-4053. Your airframe carries through Mission 35.",
      radio: "This operation does not end at the waterline.",
      environment: "ocean",
      aKills: 23,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 31,
      title: "Tunnel Vision",
      location: "Geofront",
      difficulty: "5.5/10",
      recommended: "Whatever was used in Mission #30 (mandatory)",
      unlock: "---",
      source: `- **Location:** Geofront
- **Guide code:** WK31

- **Difficulty:** 5.5/10
- **Recommended:** Whatever was used in Mission #30 (mandatory)
- **Unlock:** ---

As said, this mission begins right after the previous is completed. During the downward spiral of Ouroboros' UI-4053, two unidentified crafts managed to escape into Geofront, a long underground tunnel system. Whatever plane was used in Mission #30 has to be done here as well, as there's no time to waste in pursuing.

Geofront is a tunnel network underground, so of course there's going to be some problems: (1) structural partitions that act as obstacles (2) simply being in a claustrophobic space (3) some doorways close when they're neared. Although some doors of the partitions shut on the highway immediately, the other one will close slowly -- so while it helps to go slow enough to change direction, y'can't go too slow or y'can't slip under the door. I suggest cruising at around 1800-2000MPH and about 1200ft. off the ground, which will allow one to casually yaw over the median strip.

> **Note:** All of the closing-door portions are randomized, including future ones.

Past the opening/shutting door area, the road bifurcates: left is straighter but with a crapton of obstacles, while the right is more curvy but generally easier. The former is a great "shorcut" if you're trying to get "A" rank, but if you're not, go the latter.

The third stretch entails doing another opening/shutting highway partition trap, although this time the road is a three-lane, so it gets tougher. Don't go as before and be prepared to enter the lane kittie-corner to the one just passed through, as it happens rather frequently. Also, the doors are faster than before, although not uncomfortably so.

Past there, the annoying route to the end continues: instead of highways, now the pilot has to display some prowess in flying in even smaller spaces, such as the green culverts/pipes now faced. The road bifurcates here again but rejoins a lot more frequently. Don't go faster than 1000MPH here and remember to yaw as opposed to hard turning. The cavernous other chambers can be traversed rather easily, luckily...just watch out for weird pillars blocking the way for no particular reason (who hired the worst architect ever?).

#### A-rank requirement / strategy

Get through in under 4:00. Although an agile player can probably sightread the mission, it's a good idea to play through the course until the last two green tunnels and retry, using that new knowledge to get through in an even better time. Also, at the first bifurcation, go through the left tunnel (the obstacle-filled one) to save time -- this allows one to reach the 1st path rejoin in under a 1:00.

#### Mission roster

- None

> **Note:** The end of this mission segues into the next without time to save!`,
      rankGuide:
        "Get through in under 4:00. Although an agile player can probably sightread the mission, it's a good idea to play through the course until the last two green tunnels and retry, using that new knowledge to get through in an even better time. Also, at the first bifurcation, go through the left tunnel (the obstacle-filled one) to save time -- this allows one to reach the 1st path rejoin in under a 1:00.",
      roster: [],
      narrative: `As said, this mission begins right after the previous is completed. During the downward spiral of Ouroboros' UI-4053, two unidentified crafts managed to escape into Geofront, a long underground tunnel system. Whatever plane was used in Mission #30 has to be done here as well, as there's no time to waste in pursuing.

Geofront is a tunnel network underground, so of course there's going to be some problems: (1) structural partitions that act as obstacles (2) simply being in a claustrophobic space (3) some doorways close when they're neared. Although some doors of the partitions shut on the highway immediately, the other one will close slowly -- so while it helps to go slow enough to change direction, y'can't go too slow or y'can't slip under the door. I suggest cruising at around 1800-2000MPH and about 1200ft. off the ground, which will allow one to casually yaw over the median strip.


Past the opening/shutting door area, the road bifurcates: left is straighter but with a crapton of obstacles, while the right is more curvy but generally easier. The former is a great "shorcut" if you're trying to get "A" rank, but if you're not, go the latter.

The third stretch entails doing another opening/shutting highway partition trap, although this time the road is a three-lane, so it gets tougher. Don't go as before and be prepared to enter the lane kittie-corner to the one just passed through, as it happens rather frequently. Also, the doors are faster than before, although not uncomfortably so.

Past there, the annoying route to the end continues: instead of highways, now the pilot has to display some prowess in flying in even smaller spaces, such as the green culverts/pipes now faced. The road bifurcates here again but rejoins a lot more frequently. Don't go faster than 1000MPH here and remember to yaw as opposed to hard turning. The cavernous other chambers can be traversed rather easily, luckily...just watch out for weird pillars blocking the way for no particular reason (who hired the worst architect ever?).`,
      role: "GEOFRONT PURSUIT",
      brief:
        "Two unidentified aircraft have escaped the destroyed carrier into Geofront. Pursue them through the underground transit network.",
      objective: "Navigate closing gates, divided highways, and green culverts. Reach the exit.",
      radio: "The doors are closing. Find the green lane.",
      environment: "tunnel",
      aKills: 0,
      aTime: 240,
      expansion: !1,
    },
    {
      id: 32,
      title: "Night Raven",
      location: "Geofront",
      difficulty: "4/10",
      recommended: "Whatever was used previous mission (Mandatory)",
      unlock: "---",
      source: `- **Location:** Geofront
- **Guide code:** WK32

- **Difficulty:** 4/10
- **Recommended:** Whatever was used previous mission (Mandatory)
- **Unlock:** ---

One of the two planes that escaped Ouroboros' destroyed blimp has been ID'd as an X-49 Night Raven, and is the plane responsible for the senseless deaths witnessed a little while ago. Like before, the plane used in "Tunnel Vision" is the same one the player's using, as the pursuit's still ongoing.

First off, a note about Geofront. As we now see, it's not just a tunnel system but an underground city (this may be evident in the JP version but it hasn't be alluded to in the NTSC version)! Because of this, don't mistake the eerily brown overhead sky as cloud cover...it's actually a cement ceiling and spells doom for any pilot who doesn't realize it soon enough!

The X-49 is a super-agile plane capable of surprisingly sharp turns without deceleration, which makes it the most formidable foe yet -- although mostly when regards to achieving "A" rank. The city is mostly flat, but with the solid overhead, y'gotta remember to yaw downward (relative) when turning.

There are two opportune moments to attack this sucker: (1) firing at its 12 o'clock position -- when it's coming head-on -- while at level altitude and it's going faster than the player (2) firing at its 6 o'clock position while the player is going faster than it, and the missiles are fired from 500-600ft away. Doing this drastically minimizes the chance of evasion and should serve one well.

When enough missiles hit (maybe x8?), the player is told to stop firing as the foe is proving to be too difficult.

#### A-rank requirement / strategy

Finish mission in under 3:00 (approximately). Use the two maneuvers listed above in order to defeat it expediently.

#### Mission roster

- **x01 X-49** \u2014 Default
> **Note:** The end of this mission segues into the next without time to save!`,
      rankGuide:
        "Finish mission in under 3:00 (approximately). Use the two maneuvers listed above in order to defeat it expediently.",
      roster: [{ count: 1, name: "X-49", note: "Default" }],
      narrative: `One of the two planes that escaped Ouroboros' destroyed blimp has been ID'd as an X-49 Night Raven, and is the plane responsible for the senseless deaths witnessed a little while ago. Like before, the plane used in "Tunnel Vision" is the same one the player's using, as the pursuit's still ongoing.

First off, a note about Geofront. As we now see, it's not just a tunnel system but an underground city (this may be evident in the JP version but it hasn't be alluded to in the NTSC version)! Because of this, don't mistake the eerily brown overhead sky as cloud cover...it's actually a cement ceiling and spells doom for any pilot who doesn't realize it soon enough!

The X-49 is a super-agile plane capable of surprisingly sharp turns without deceleration, which makes it the most formidable foe yet -- although mostly when regards to achieving "A" rank. The city is mostly flat, but with the solid overhead, y'gotta remember to yaw downward (relative) when turning.

There are two opportune moments to attack this sucker: (1) firing at its 12 o'clock position -- when it's coming head-on -- while at level altitude and it's going faster than the player (2) firing at its 6 o'clock position while the player is going faster than it, and the missiles are fired from 500-600ft away. Doing this drastically minimizes the chance of evasion and should serve one well.

When enough missiles hit (maybe x8?), the player is told to stop firing as the foe is proving to be too difficult.`,
      role: "EXPERIMENTAL AIRFRAME CONTACT",
      brief:
        "One escapee is the X-49 Night Raven. Engage it inside Geofront\u2019s underground city, but remember that the apparent sky is a concrete ceiling.",
      objective: "Damage the X-49 until command recalls the attack. Stay below the ceiling.",
      radio: "That is not cloud cover above you.",
      environment: "geofront",
      aKills: 0,
      aTime: 180,
      expansion: !1,
    },
    {
      id: 33,
      title: "Geofront Attack",
      location: "Geofront",
      difficulty: "3/10",
      recommended: "Whatever was used in previous mission (mandatory)",
      unlock: "---",
      source: `- **Location:** Geofront
- **Guide code:** WK33

- **Difficulty:** 3/10
- **Recommended:** Whatever was used in previous mission (mandatory)
- **Unlock:** ---

With the X-49 being too dangerous a foe to hit normally, UPEO command has come up with a surprisingly vicious scorched earth policy: destroy Geofront's structural supports and destroy the plane in the ensuing collapse! Quite a mission to carry out but it's all we've got! [Same plane used in last mission will be used here.]

The structural supports, obviously, are holding up the ceiling. Lock-on can't be achieved for missiles but as we've seen throughout the game, missiles are still able to destroy them without targeting. [The command suggests using the aircraft's machine-guns.] The enemy X-49 will still be around, even if it's not pestering the player, so ignore it and focus on the pillars.

Laughably, the X-49 will fire its lasers but seems to have little skill in aiming -- even when right behind, they'll often be wide left/right. Haha...

#### A-rank requirement / strategy

Finish mission in under 4:00 (approximately). A player'll often have to cut it close, but it's rather doable. Just form a flightpath that cuts down on backtracking -- for instance, do the east side, work inward to SW corner, then do the two western. [Remember that when a pillar's destroyed there'll be support beam still in the rubble, so don't be going to fast that y'hit it.]

#### Mission roster

- **x10 Timer** \u2014 Default
- **x01 X-49** \u2014 Default
> **Note:** The end of this mission segues into the next without time to save!`,
      rankGuide:
        "Finish mission in under 4:00 (approximately). A player'll often have to cut it close, but it's rather doable. Just form a flightpath that cuts down on backtracking -- for instance, do the east side, work inward to SW corner, then do the two western. [Remember that when a pillar's destroyed there'll be support beam still in the rubble, so don't be going to fast that y'hit it.]",
      roster: [
        { count: 10, name: "Timer", note: "Default" },
        { count: 1, name: "X-49", note: "Default" },
      ],
      narrative: `With the X-49 being too dangerous a foe to hit normally, UPEO command has come up with a surprisingly vicious scorched earth policy: destroy Geofront's structural supports and destroy the plane in the ensuing collapse! Quite a mission to carry out but it's all we've got! [Same plane used in last mission will be used here.]

The structural supports, obviously, are holding up the ceiling. Lock-on can't be achieved for missiles but as we've seen throughout the game, missiles are still able to destroy them without targeting. [The command suggests using the aircraft's machine-guns.] The enemy X-49 will still be around, even if it's not pestering the player, so ignore it and focus on the pillars.

Laughably, the X-49 will fire its lasers but seems to have little skill in aiming -- even when right behind, they'll often be wide left/right. Haha...`,
      role: "STRUCTURAL DEMOLITION",
      brief:
        "Direct attacks have failed to stop the Night Raven. Command has ordered Geofront\u2019s supports destroyed to collapse the chamber around it.",
      objective: "Use guns or unguided fire on ten structural supports. Evade the X-49.",
      radio: "Ten supports. One terrible solution.",
      environment: "geofront",
      aKills: 0,
      aTime: 240,
      expansion: !1,
    },
    {
      id: 34,
      title: "Aurora",
      location: "Port Edwards",
      difficulty: "7/10",
      recommended: "R-103 Delphinus #3 -or- XFA-36A Game",
      unlock: "---",
      source: `- **Location:** Port Edwards
- **Guide code:** WK34

- **Difficulty:** 7/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** ---

After the Geofront debacle, the other X-49 that escaped from Ouroboros' aerial warship is now flying over Port Edwards, so it's time to bury the hatchet... in the Night Raven's back! Ahaha... Despite the change in scenery, the same plane that has been used since Mission #30 (Search and Destroy) is still being employed.

Essentially, this mission is one big hullabaloo with the fast target being accompanied by some top-tier other enemies, who'll try to pester the player or (often annoyingly) change the lock-on. Be sure to aim from an advantageous position, as the X-49 will often put on afterburners -- which leave that sparkly stardust trail behind it -- in an effort to outmaneuver projectiles. Remember to break away from the pack and circle back, which should give one a better vantage of attack (nice rhyme, huh?). The X-49 will start smoking when it's heavily damaged, so use that to gauge your progress.

#### Mission update

Once the X-49 bites the dust, a single UI-4051 Aurora will be inbound from the north. Hopefully y'saved a bunch of missiles as this sucker is the most slippery of any enemy aircraft seen so far. This part will often take quite awhile and waste a lot of missiles, so don't fire four at once like before -- 90% of the time all will fail. In fact, count yourself lucky to even get one hit on this bad boy. [If you run out of missiles, restart the mission...there is pretty much no way to hit the target with guns, due to the high fluidity of its flightpath.]

There are very few situations where evasion is nearly impossible, but there are two, both at close proximity: (1) firing missiles at an oncoming plane at level altitude and with enough response time to fire, meaning slower than the target (2) the flipside, firing at the target's six o'clock. The first may actually be the best as it's easier to gauge when one's about to turn; this is the disadvantage of the latter strategy. Regardless, firing missiles when the target's 1000ft. or more away is just begging for the shot to miss, sorry.

There aren't too many excursions where a plane with 180+ missiles can run out entirely, but this is one of 'em.

#### A-rank requirement / strategy

Defeat 6+ targets (2 mandatory). Time limit isn't a factor and the generic planes aren't that tough, although they may take 3+ missiles to defeat. At least they stay around for the mission update.

#### Mission roster

- **x01 X-49** \u2014 Default
- **x02 R-103** \u2014 Default
- **x02 XFA-36A** \u2014 Default
- **x02 Su-43** \u2014 Default
- **x01 UI-4051 Aurora** \u2014 Mission Update
> **Note:** The end of this mission segues into the next without time to save!`,
      rankGuide:
        "Defeat 6+ targets (2 mandatory). Time limit isn't a factor and the generic planes aren't that tough, although they may take 3+ missiles to defeat. At least they stay around for the mission update.",
      roster: [
        { count: 1, name: "X-49", note: "Default" },
        { count: 2, name: "R-103", note: "Default" },
        { count: 2, name: "XFA-36A", note: "Default" },
        { count: 2, name: "Su-43", note: "Default" },
        { count: 1, name: "UI-4051 Aurora", note: "Mission Update" },
      ],
      narrative: `After the Geofront debacle, the other X-49 that escaped from Ouroboros' aerial warship is now flying over Port Edwards, so it's time to bury the hatchet... in the Night Raven's back! Ahaha... Despite the change in scenery, the same plane that has been used since Mission #30 (Search and Destroy) is still being employed.

Essentially, this mission is one big hullabaloo with the fast target being accompanied by some top-tier other enemies, who'll try to pester the player or (often annoyingly) change the lock-on. Be sure to aim from an advantageous position, as the X-49 will often put on afterburners -- which leave that sparkly stardust trail behind it -- in an effort to outmaneuver projectiles. Remember to break away from the pack and circle back, which should give one a better vantage of attack (nice rhyme, huh?). The X-49 will start smoking when it's heavily damaged, so use that to gauge your progress.

#### Mission update

Once the X-49 bites the dust, a single UI-4051 Aurora will be inbound from the north. Hopefully y'saved a bunch of missiles as this sucker is the most slippery of any enemy aircraft seen so far. This part will often take quite awhile and waste a lot of missiles, so don't fire four at once like before -- 90% of the time all will fail. In fact, count yourself lucky to even get one hit on this bad boy. [If you run out of missiles, restart the mission...there is pretty much no way to hit the target with guns, due to the high fluidity of its flightpath.]

There are very few situations where evasion is nearly impossible, but there are two, both at close proximity: (1) firing missiles at an oncoming plane at level altitude and with enough response time to fire, meaning slower than the target (2) the flipside, firing at the target's six o'clock. The first may actually be the best as it's easier to gauge when one's about to turn; this is the disadvantage of the latter strategy. Regardless, firing missiles when the target's 1000ft. or more away is just begging for the shot to miss, sorry.

There aren't too many excursions where a plane with 180+ missiles can run out entirely, but this is one of 'em.`,
      role: "NIGHT RAVEN / AURORA",
      brief:
        "The second Night Raven has escaped to Port Edwards. Destroy it and confront the exceptionally agile Aurora that follows.",
      objective: "Destroy X-49, then UI-4051 Aurora. Close-range head-on and tail shots are most reliable.",
      radio: "There is always one more ghost.",
      environment: "harbor",
      aKills: 6,
      aTime: 0,
      expansion: !1,
    },
    {
      id: 35,
      title: "Electrosphere",
      location: "Eusian Ocean",
      difficulty: "7/10",
      recommended: "Whatever was used in previous mission (mandatory)",
      unlock: "---",
      source: `- **Location:** Eusian Ocean
- **Guide code:** WK35

- **Difficulty:** 7/10
- **Recommended:** Whatever was used in previous mission (mandatory)
- **Unlock:** ---

The final mandatory mission in the game takes place over Megafloat's new, uh, islands. The UI-4054 is the same target as before and there are no normal enemies to face -- it's mano e mano. Whatever plane was used before is still being ridden here, although ammo has been replenished (how? a wizard did it).

Okay, so the Aurora plane is the target. As told in the previous mission, with its highly capable maneuvering abilities, there are really only two ways to land hits, both of which entail no time for it to evade: (1) shoot at its 12 o'clock position, i.e. head-on, at a level altitude with it going faster than the player (2) fire at it's six o'clock position while coming up fast on it, which often lands at least one hit. In this case, the latter is the most frequent opportunity.

#### Mission update

The player will enter the Electrosphere after the first half, which turns the entire field of vision into how a machine would view 3D things: different planes of height, vectors, etc. Although it appears as though the player is within a tunnel, don't be fooled: there's plenty of room to move in. Just keep an eye on the altimeter as it's still possible to crash into the ground! This is a very disorienting part of the mission so rely on the upper-left minimap to get some bearings as following the "target pointer" on the screen is not that helpful (y'want to go perpendicular to it, oftentimes).

#### A-rank requirement / strategy

Finish in under 4:00, which requires 4-5 clean hits on the enemy.

#### Mission roster

- **x01 UI-4054 Aurora** \u2014 Default
This ends normal gameplay. After the credits is a save prompt, which will overwrite the currently-used level (although this won't impact much). This will unlock the mission simulator, which lets one play any previous level, with any plane (except where certain types are required, such as during the space/high-altitude missions). Y'can open the simulator by going to the Load file select screen and finding "simulator" all the way on the right.

> **Note:** If you got all A/Bs on the previous missions, Mission #36 plays instead of the ending, which will then follow that one.`,
      rankGuide: "Finish in under 4:00, which requires 4-5 clean hits on the enemy.",
      roster: [{ count: 1, name: "UI-4054 Aurora", note: "Default" }],
      narrative: `The final mandatory mission in the game takes place over Megafloat's new, uh, islands. The UI-4054 is the same target as before and there are no normal enemies to face -- it's mano e mano. Whatever plane was used before is still being ridden here, although ammo has been replenished (how? a wizard did it).

Okay, so the Aurora plane is the target. As told in the previous mission, with its highly capable maneuvering abilities, there are really only two ways to land hits, both of which entail no time for it to evade: (1) shoot at its 12 o'clock position, i.e. head-on, at a level altitude with it going faster than the player (2) fire at it's six o'clock position while coming up fast on it, which often lands at least one hit. In this case, the latter is the most frequent opportunity.

#### Mission update

The player will enter the Electrosphere after the first half, which turns the entire field of vision into how a machine would view 3D things: different planes of height, vectors, etc. Although it appears as though the player is within a tunnel, don't be fooled: there's plenty of room to move in. Just keep an eye on the altimeter as it's still possible to crash into the ground! This is a very disorienting part of the mission so rely on the upper-left minimap to get some bearings as following the "target pointer" on the screen is not that helpful (y'want to go perpendicular to it, oftentimes).`,
      role: "ELECTROSPHERE ENTRY",
      brief:
        "Aurora is alone above Megafloat\u2019s shattered islands. Pursue it beyond ordinary airspace and into the Electrosphere.",
      objective: "Defeat Aurora in physical airspace, then finish the duel inside the digital field.",
      radio: "Trust your instruments. Not your eyes.",
      environment: "ocean",
      aKills: 0,
      aTime: 240,
      expansion: !1,
    },
    {
      id: 36,
      title: "Geopelia",
      location: "Port Edwards",
      difficulty: "3/10",
      recommended: "R-103 Delphinus #3 -or- XFA-36A Game",
      unlock: "XR-900",
      source: `- **Location:** Port Edwards
- **Guide code:** WK36

- **Difficulty:** 3/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** XR-900

> **Note:** This mission is only unlocked by getting "A" rank on all missions on any difficulty.

The final FINAL mission in the game is a special unlockable, as stated above. Neuwark's powerful unmanned fighting force, the Geopelias, are spotted over Port Edwards and should be shot down, while minimizing collateral damage. Any good plane will be helpful here.

The entire squadron will be inbound from the southeast part of the city, and they all have those "stardust afterburners" that make them highly agile. Once any single XR-900 is killed, there'll be a cutscene where the player controls a hacked XR-900. Using this, defeat its comrades!

This thing is so sly that no enemy should ever lay a finger on the player, and they don't even fight back -- I guess they haven't realized one of their own has gone haywire. This is great for back attack opportunities! Get about 600ft behind one and go at its speed, then unleash a full salvo and hopefully highly damage it. These types of planes take more than a couple to be killed, so every moment counts if you're trying for "A" rank. Use the laser beam for additional damage, too.

#### A-rank requirement / strategy

Finish in under 5:00. Quite easy if you prefer close-range (see above strat) or long-range (fire missiles from 2000ish feet away and hope most hit, which does happen more than the other maneuverable crafts). Y'usually finish with 0:30 to spare or so, if you're lucky.

#### Mission roster

- **x08 XR-900** \u2014 Default`,
      rankGuide:
        "Finish in under 5:00. Quite easy if you prefer close-range (see above strat) or long-range (fire missiles from 2000ish feet away and hope most hit, which does happen more than the other maneuverable crafts). Y'usually finish with 0:30 to spare or so, if you're lucky.",
      roster: [{ count: 8, name: "XR-900", note: "Default" }],
      narrative: `The final FINAL mission in the game is a special unlockable, as stated above. Neuwark's powerful unmanned fighting force, the Geopelias, are spotted over Port Edwards and should be shot down, while minimizing collateral damage. Any good plane will be helpful here.

The entire squadron will be inbound from the southeast part of the city, and they all have those "stardust afterburners" that make them highly agile. Once any single XR-900 is killed, there'll be a cutscene where the player controls a hacked XR-900. Using this, defeat its comrades!

This thing is so sly that no enemy should ever lay a finger on the player, and they don't even fight back -- I guess they haven't realized one of their own has gone haywire. This is great for back attack opportunities! Get about 600ft behind one and go at its speed, then unleash a full salvo and hopefully highly damage it. These types of planes take more than a couple to be killed, so every moment counts if you're trying for "A" rank. Use the laser beam for additional damage, too.`,
      role: "UNMANNED SWARM / OVERRIDE",
      brief:
        "Neuwork\u2019s Geopelia unmanned squadron has appeared over Port Edwards. Disable one unit, seize its flight systems, and turn the swarm against itself.",
      objective: "Destroy one XR-900 to take control of it. Eliminate the remaining seven.",
      radio: "One of us is about to become one of them.",
      environment: "harbor",
      aKills: 0,
      aTime: 300,
      expansion: !1,
    },
  ],
  AIRCRAFT = [
    {
      id: 0,
      code: "EF2000E",
      name: "Typhoon II",
      unlock: "Dft",
      ammo: 72,
      stats: [3, 3, 4, 1, 2],
      guns: ["Vul"],
      missiles: ["Msl"],
    },
    {
      id: 1,
      code: "MiG 33",
      name: "Fulcrum SS",
      unlock: "01*",
      ammo: 80,
      stats: [4, 4, 3, 2, 4],
      guns: ["Vul"],
      missiles: ["Msl"],
    },
    {
      id: 2,
      code: "F/A-18U",
      name: "Hornet ADV",
      unlock: "02*",
      ammo: 96,
      stats: [2, 3, 5, 5, 4],
      guns: ["Vul", "HMG"],
      missiles: ["SRM", "GrM"],
    },
    {
      id: 3,
      code: "F-16XFU",
      name: "Gyrfalcon",
      unlock: "04",
      ammo: 80,
      stats: [3, 3, 3, 4, 4],
      guns: ["Vul", "HMG"],
      missiles: ["Msl"],
    },
    {
      id: 4,
      code: "R-101",
      name: "Delphinus #1",
      unlock: "05*",
      ammo: 88,
      stats: [5, 4, 1, 5, 3],
      guns: ["HMG"],
      missiles: ["Msl"],
    },
    {
      id: 5,
      code: "R-201",
      name: "Asterozoa",
      unlock: "06",
      ammo: 104,
      stats: [1, 5, 8, 8, 1],
      guns: ["Can"],
      missiles: ["SRM", "GrM", "MIRV"],
    },
    {
      id: 6,
      code: "RF-12A2",
      name: "Blackbird",
      unlock: "11",
      ammo: 160,
      stats: [10, 3, 7, 3, 1],
      guns: ["Vul", "HMG"],
      missiles: ["Msl", "SRM", "MIRV", "Spread Bomb"],
    },
    {
      id: 7,
      code: "F-15S/MT",
      name: "Eagle+",
      unlock: "13",
      ammo: 112,
      stats: [7, 5, 5, 4, 6],
      guns: ["Vul", "Can"],
      missiles: ["Msl", "SRM", "MIRV"],
    },
    {
      id: 8,
      code: "F-16XA",
      name: "Sakerfalcon",
      unlock: "14*",
      ammo: 96,
      stats: [8, 4, 8, 2, 4],
      guns: ["Vul", "HMG"],
      missiles: ["GrM"],
    },
    {
      id: 9,
      code: "R-352",
      name: "Sepia",
      unlock: "15",
      ammo: 100,
      stats: [2, 2, 10, 5, 9],
      guns: ["Neutron Beam"],
      missiles: ["Plasma Beam", "Spread Bomb"],
    },
    {
      id: 10,
      code: "F-22C",
      name: "Raptor II",
      unlock: "17",
      ammo: 104,
      stats: [5, 5, 5, 10, 5],
      guns: ["Vul", "HMG"],
      missiles: ["Msl"],
    },
    {
      id: 11,
      code: "F/A-32C",
      name: "Erne",
      unlock: "18*",
      ammo: 136,
      stats: [2, 3, 8, 9, 7],
      guns: ["Vul", "Can"],
      missiles: ["SRM", "GrM"],
    },
    {
      id: 12,
      code: "Su-37",
      name: "Super Flanker",
      unlock: "22",
      ammo: 120,
      stats: [7, 7, 5, 6, 6],
      guns: ["Vul", "Can"],
      missiles: ["Msl"],
    },
    {
      id: 13,
      code: "R-102",
      name: "Delphinus #2",
      unlock: "23*",
      ammo: 128,
      stats: [7, 8, 5, 5, 7],
      guns: ["HMG", "Pul"],
      missiles: ["Msl"],
    },
    {
      id: 14,
      code: "R-211",
      name: "Orcinus",
      unlock: "25",
      ammo: 144,
      stats: [8, 8, 8, 9, 2],
      guns: ["Can", "Pul"],
      missiles: ["SRM", "GrM"],
    },
    {
      id: 15,
      code: "Su-43",
      name: "Berkut",
      unlock: "25",
      ammo: 152,
      stats: [7, 9, 8, 5, 10],
      guns: ["Vul", "HMG", "Can"],
      missiles: ["Msl", "MIRV"],
    },
    {
      id: 16,
      code: "R-103",
      name: "Delphinus #3",
      unlock: "27*",
      ammo: 168,
      stats: [10, 9, 5, 8, 7],
      guns: ["HMG", "Can", "Pul"],
      missiles: ["Msl", "MIRV"],
    },
    {
      id: 17,
      code: "XFA-36A",
      name: "Game",
      unlock: "29",
      ammo: 184,
      stats: [8, 10, 8, 7, 7],
      guns: ["Vul", "HMG", "Can"],
      missiles: ["Msl", "SRM", "MIRV"],
    },
    {
      id: 18,
      code: "UI-4054",
      name: "Aurora",
      unlock: "Spc",
      ammo: 176,
      stats: [10, 10, 8, 7, 9],
      guns: ["Vul", "HMG", "Can"],
      missiles: ["SRM", "GrM", "MIRV", "Spread Bomb"],
    },
    {
      id: 19,
      code: "X-49",
      name: "Night Raven",
      unlock: "Spc",
      ammo: 184,
      stats: [10, 8, 10, 3, 10],
      guns: ["Las"],
      missiles: ["SRM", "GrM", "MIRV", "Spread Bomb"],
    },
    {
      id: 20,
      code: "XR-900",
      name: "Geopelia",
      unlock: "Spc",
      ammo: 192,
      stats: [10, 9, 10, 3, 10],
      guns: ["Las"],
      missiles: ["SRM", "GrM", "MIRV", "Spread Bomb"],
    },
  ],
  WEAPONS = {
    Vul: {
      name: "Vulcan",
      slot: "gun",
      range: 1600,
      damage: 6,
      rate: 0.09,
      heat: 0.04,
      desc: "High-rate rotary cannon. Long reach, light impacts, generous cooling.",
    },
    HMG: {
      name: "Heavy Machine Gun",
      slot: "gun",
      range: 1250,
      damage: 10,
      rate: 0.13,
      heat: 0.05,
      desc: "Shorter-ranged heavy rounds with stronger armor penetration.",
    },
    Can: {
      name: "Cannon",
      slot: "gun",
      range: 1900,
      damage: 23,
      rate: 0.28,
      heat: 0.085,
      desc: "Heavy shells. Slow fire, decisive damage, excellent against ground emplacements.",
    },
    "Neutron Beam": {
      name: "Neutron Beam",
      slot: "gun",
      range: 3500,
      damage: 20,
      rate: 0.13,
      heat: 0.04,
      desc: "Sepia\u2019s orbital particle beam. Designed for zero-gravity combat.",
    },
    Pul: {
      name: "Pulse Laser",
      slot: "gun",
      range: 2300,
      damage: 16,
      rate: 0.12,
      heat: 0.065,
      desc: "Precise cyan pulses with fast travel and sustained damage.",
    },
    Las: {
      name: "Laser Cannon",
      slot: "gun",
      range: 3e3,
      damage: 35,
      rate: 0.22,
      heat: 0.065,
      desc: "Experimental coherent beam carried by Night Raven and Geopelia.",
    },
    Msl: {
      name: "Missile",
      slot: "missile",
      range: 3200,
      damage: 44,
      reload: 2.4,
      speed: 1e3,
      turn: 2.6,
      desc: "Balanced all-purpose homing missile. A tail-aspect lock is most reliable.",
    },
    SRM: {
      name: "Short-Range Missile",
      slot: "missile",
      range: 1900,
      damage: 48,
      reload: 1.75,
      speed: 1150,
      turn: 3.6,
      desc: "Fast-lock, agile dogfight missile. Trades range for close-combat performance.",
    },
    GrM: {
      name: "Ground Missile",
      slot: "missile",
      range: 4200,
      damage: 72,
      reload: 3.3,
      speed: 820,
      turn: 1.8,
      desc: "Long-range ground-attack missile. Cannot home on aircraft.",
    },
    MIRV: {
      name: "M.I.R.V.",
      slot: "missile",
      range: 3400,
      damage: 31,
      reload: 4.1,
      speed: 820,
      turn: 2.2,
      desc: "Splits into three independently homing submunitions near the target.",
    },
    "Plasma Beam": {
      name: "Plasma Beam",
      slot: "missile",
      range: 5e3,
      damage: 90,
      reload: 1.8,
      speed: 6e3,
      turn: 0,
      desc: "Sepia\u2019s near-instant beam weapon for orbital interception.",
    },
    "Spread Bomb": {
      name: "Spread Bomb",
      slot: "missile",
      range: 3600,
      damage: 95,
      reload: 4.8,
      speed: 300,
      turn: 0,
      radius: 420,
      desc: "Unguided area weapon. Follow the ground-impact reticle to place the blast.",
    },
    "Anti-Nanobite Bomb": {
      name: "Anti-Nanobite Bomb",
      slot: "missile",
      range: 3600,
      damage: 200,
      reload: 3.9,
      speed: 350,
      turn: 0,
      radius: 520,
      desc: "Mission-specific containment payload. Erases nanobite colonies across a wide radius.",
    },
    OSL: {
      name: "O.S.L.",
      slot: "missile",
      range: 6e3,
      damage: 1e4,
      reload: 3.8,
      speed: 9e3,
      turn: 0,
      desc: "Orbital Satellite Laser. A confirmed lock calls down an instant precision strike. Hard campaign reward.",
    },
  },
  SIDE_OPS = [
    {
      id: 37,
      title: "Dead Air",
      location: "Expo City",
      role: "SIDE OP / SIGNAL RECOVERY",
      brief:
        "Expansion: With the radar network damaged, UPEO needs four emergency beacons surveyed before civilian air traffic can resume.",
      objective: "Photograph four beacons, then neutralize the two rogue patrols.",
      radio: "A quiet frequency is not always a safe one.",
      environment: "city",
      aKills: 6,
      aTime: 150,
      level: 3,
      expansion: !0,
    },
    {
      id: 38,
      title: "Mercy Corridor",
      location: "Axel Bay",
      role: "SIDE OP / MEDEVAC ESCORT",
      brief:
        "Expansion: The Axel Bay emergency has left relief flights exposed. Escort a medical transport through a renewed hostile patrol.",
      objective: "Protect the medical transport and destroy six hostile aircraft.",
      radio: "No medals in the cargo hold. Just people.",
      environment: "harbor",
      aKills: 6,
      aTime: 180,
      level: 6,
      expansion: !0,
    },
    {
      id: 39,
      title: "Ghost Frequency",
      location: "Electrosphere",
      role: "SIDE OP / DIGITAL CLEANUP",
      brief:
        "Expansion: A residual combat process is rebuilding itself inside the Electrosphere. Shut down its relay nodes and eliminate the reconstructed ace.",
      objective: "Destroy three relay nodes and the digital ace. Avoid the corrupted field.",
      radio: "The signal is old. The danger is current.",
      environment: "cyber",
      aKills: 4,
      aTime: 180,
      level: 10,
      expansion: !0,
    },
  ],
  SOURCE_NOTES = [
    "SOURCE SCOPE: The supplied Shotgunnova guide describes the international 36-mission campaign. Japanese branching routes and anime cutscenes are not supplied and are not recreated. New radio dialogue, pilot levels, upgrades, flight assists and three side operations are original additions.",
    "UNLOCK CONFLICT: Mission 36\u2019s chapter says all A ranks; the tips, FAQ and unlock appendix say all A/B ranks. This game uses all A/B ranks for Mission 36, and all A ranks for Aurora and Night Raven.",
    "ROSTER CONFLICTS: Joint Maneuvers is score-based. Reaching for Stars lists five reinforcement fighters but four mandatory ones. Damage Control\u2019s prose says 28 enemies while its roster totals 24. This build uses the printed roster counts and the printed A-rank target of 22.",
    "BLACKBIRD: The prose specifies two R-311 launches per surviving R-531; the roster lists only four R-311s. Launches here follow the prose, up to eight.",
    "CARRIER TARGETS: A UI-4053 is represented by four armored underside components (four missile hits each). Carrier and convoy auxiliary defenses are counted except in Fjord, matching the guide\u2019s caveat.",
    "AURORA IDENTIFIERS: The guide uses UI-4051 in Mission 34 and UI-4054 in Mission 35, and varies Neuwork / Neuwark / Neuwark spellings. Original labels remain in the source archive; campaign briefings consistently use Neuwork.",
    "MOBILE ADAPTATION: Distances and terrain are compressed for readable handheld sorties. Timers and rank goals retain the source\u2019s values. Flight assists, generous formation-failure grace, checkpoint autosaves during Missions 30\u201335, and optional service autopilot are modern additions.",
    "BONUS MEDIA: The original Japanese intro and music assets were not supplied. Their unlock milestones are recorded; the cinema and music player use original procedural visuals and synthesized tracks instead. No extracted commercial assets are included.",
  ],
  GUIDE_TEXT = `# Ace Combat 3: Electrosphere \u2014 Guide and Walkthrough

- **Platform:** PlayStation
- **Guide author:** Shotgunnova (P. Summers)
- **Updated:** 2009-10-19
- **Scope:** Spoiler-free FAQ/walkthrough; walkthrough is written for Normal difficulty unless noted.
- **Source format:** GameFAQs text guide, normalized to Markdown for compact machine/agent reading.

> Editorial normalization only: webpage chrome, ASCII art, decorative separators, and redundant fixed-width formatting were removed. Gameplay facts, requirements, caveats, opinions that affect strategy, appendices, FAQ, credits, and legal terms are retained.

## Contents

- Controls
- Tips and tricks
- Walkthrough: Missions 01\u201336
- Appendices: Planes; Unlockables/Cheats
- Frequently asked questions
- Updates and contributors
- Legality

## Controls

Ace Combat 3 is compatible with all normal controllers, including NeoCon and digital (non-analog stick) controllers. Digital config can only be used if the player lacks a DualShock 2 (or other analog stick) controller, or the analog function is intentionally switched off. [Analog is on by default.]

| BUTTON | ANALOG CONFIG | DIGITAL CONFIG |
| --- | --- | --- |
| D-Pad | Move camera (at direction) | Maneuvers (chosen direction) |
| Start | Un/pause game | Un/pause game |
| Analog | Toggle Analog mode | \u2014 |
| Select | Toggle 1st/3rd person POV | Toggle 1st/3rd person POV |
| Circle | Fire missile-slot weapon | Fire missile-slot weapon |
| Square | (Hold) display level map | (Hold) display level map |
| Triangle | Cycle thru available targets | Cycle thru available targets |
| X-Button | Fire machinegun-slot weapon | Fire machinegun-slot weapon |
| L1 Button | Decelerate | Decelerate |
| L2 Button | Yaw Left | Yaw left |
| L3 Button | \u2014 | \u2014 |
| R1 Button | Accelerate | \u2014 |
| R2 Button | Yaw Right | \u2014 |
| R3 Button | Rear view (chosen direction) | \u2014 |
| L. Analog | Maneuver (chosen direction) | \u2014 |
| R. Analog | Move camera (at direction) | \u2014 |

## Tips and tricks

Hey, greenhorns! Don't put a single hand on the missile launch button without first knowing the basics! [If anyone has good ones to send in, drop 'em in my email inbox and I'll stick 'em here.]

- Saving! Getting A/B Rank on all normal missions in the game will unlock a 36th final mission, so if y'screw up an assignment, redo it until it's got a good marking; THEN, save.
- The most advantageous firing position is from behind the enemy while they are in a mid-turn and at similar altitude. They'll be slowing down, and the missiles have a higher chance of hitting because they're not working off some huge mismatch in height. Always try to achieve this positioning.
The worst positioning, thus, would be about the exact opposite: enemy is heading towards you from an altitude extremely different than yours, and you're shooting from behind as you head straight up/down. Not only is this going to waste ammo 99% of the time due to outmaneuvering, but it's simply...stupid.

- Try to pace yourself on difficulty first off. The walkthrough is written in Normal Mode so that it's a balance, but go with easy if you have to. When you get better, try out Expert level.
- Don't pull your hair out trying to get "A" ranks! If you settle for B's, the 36th mission is still unlocked. Plus, y'can right performance issues by going into the simulator and doing better (and with better planes as well, which makes some of the harder, earlier mission goals more palatable).

## Walkthrough

### 01. Transport

- **Location:** Expo City
- **Guide code:** WK01

> **Walkthrough difficulty:** Normal (medium).

- **Difficulty:** 2/10
- **Recommended:** EF2000E Typhoon II
- **Unlock:** MiG-33 Fulcrum SS

Only the EF2000E is unlocked initially and that son of a gun's a dogfighter, which should help against the slower soon-to-be-destroyed transports flying over restricted airspace. Weapons can't be changed yet...

> **Heads-up:** To unlock the thirty-sixth mission, you (the player) must obtain A- and B-ranks in all other (35) missions! Now's a good time to start... The Mission Simulator is unlocked only by beating the game on Normal, however!

Long-time veterans should have the controls down pat, especially if they've played later PS2 installments in the series -- they're basically the same. Rookie pilots should use this chance to get familiarized, however. One thing that differs from the newer AC games is that these planes are FAST...like, 2000+ m.p.h fast. When you're coming up behind a target, be careful not too zoom past and waste missiles when the lock-on appears, as it's quite easy to do so until y'get the hang of things. Similarly, if you brake too hard the craft will stall and point nose-first at the ground, rather than a slow plummet. If you're flying too low and y'stall, there won't be time enough to recover speed and the army medics will be collecting you in tiny bite-sized bits later on.

As for the mission itself, the first is always the easiest and this one's no different. The R-501 transports are slow and lumbering, unable to fight back. Their escort fighters (R201s) can definitely fight back but usually cruise at about 1500 m.p.h. so that speed often lends itself to their missed attempts. If the first four targets are not defeated within a reasonable time (3:00), then the mission update's skipped and this run gets an automatic "D" ranking.

#### Mission update

With the transports deep-sixed, reinforcements will come from the south. One target (R-101) and a bunch of similar escorts will try to engage the player in some dogfighting as retribution for destroying their transports. There's not a lot of challenge to this part; it's more of an introduction to the many mission updates to follow. However, flying right into the sun is always gonna be annoying...

#### A-rank requirement / strategy

Unlock: MiG-33 Fulcrum SS

Defeat the first four targets in under 3:00 to get the mission update, then defeat the final target. During all of this, defeat five other non-target escorts to get "A" rank. At least five normal fighters appear in the update portion, so feel free to ignore the others in the 1st part to cut down on time. [The timer doesn't factor into the mission update part, mind you.]

Since there's no score system like in future ACs, a lot of the extra "oomph" to hit a certain rank is done on a kill-based system. For instance, killing five-plus bogies earns an "A"; killing two would earn a "C".

#### Mission roster

- **x04 R-501** \u2014 Default
- **x01 R-101** \u2014 Default
- **x05 R-201** \u2014 Default [x3 Mission Update]
- **x02 R-101** \u2014 Mission Update

### 02. Interference

- **Location:** Waiapolo Mts.
- **Guide code:** WK02

- **Difficulty:** 3/10
- **Recommended:** EF2000E Typhoon II (or MiG-33 Fulcrum SS)
- **Unlock:** F/A-18U Hornet ADV

Once again, the Typhoon's the only plane up for this job...unless you gained the Fulcrum SS doing the previous mission!

The mission goal is to destroy all the radar sites plaguing General Defense's surveillance, and the mountainous region ain't making it any easier. As far as air support goes, there's a pair of R-101s and R-201s flying around, but that's pretty lightweight. If you check the pre-mission map, you'll see that there is a 4:00 time limit -- this applies to the first eight targets. Should the player not destroy them in within 3:59, then the mission update is skipped and an inferior rank attributed. Naturally, to squeeze inside this time limit, one should ignore the aircraft and concentrate solely on ground targets. [It only takes one missile to destroy the targets, for reference.]

A good tip is to start from the north and work south, taking it slow to the plane doesn't overshoot the target and waste time. Radarsites themselves have no offensive capabilities, which is even more reason to not worry about

#### Mission update

Should the first eight (8) be defeated in an expedient fashion, then the go-ahead to attack the northern base is given and the time limit is factored out. The new set of victims includes a bridge and four base buildings. Two of the buildings are set in dormant volcano cones, and the rims of them will definitely trash missile lock-ons if the player fails to correct trajectories, either by going slow and aiming down just over the rim or flying high and doing a dive maneuver. Mission ends when all five structures are rubble.

#### A-rank requirement / strategy

One must destroy at least 23 out of the 24 total enemies, which equates to ten normal enemies (13 are targets). All normal defenses and aircraft appear at once; no new ones are added in the update. However, the update is required to break the quota since 5 targets are added at that time.

#### Mission roster

- **x02 R-201** \u2014 Default
- **x02 R-101** \u2014 Default
- **x08 Radarsite** \u2014 Default
- **x05 AA Gun** \u2014 Default
- **x02 MSSL** \u2014 Default
- **x04 Base** \u2014 Mission Update
- **x01 Bridge** \u2014 Mission Update

### 03. Joint Maneuvers

- **Location:** Chopinburg
- **Guide code:** WK03

- **Difficulty:** 3.5/10
- **Recommended:** MiG-33 Fulcrum SS -or- F/A-18U
- **Unlock:** none

Based on the success in "Interference," the military has agreed to do joint training exercises. Having a plane with good mobility is key here, so if you have it, the F/A-18U is the clear winner. However, make that it isn't using its ground (cruise) missiles because you'll want a good air-to-air missile for this one. [The F/A's heavy guns have shorter range as well, so sticking with the Vulcan may not be a bad idea either.]

The mission itself first requires the player to trail a friendly (Eagle+) at no more than a 1000-foot radius. If it gets too far away, it's game over, so be sure to keep "Pursue!" on the screen because that's a notification that things are going well. [And no, you can't shoot this guy down.] He'll pull a few basic and crazy diving/ascending maneuvers, but as long as he's within a decent range, this part shouldn't that hard. Just be careful not to overshoot when following him because slowing down means he may get a bigger lead -- be sure to check your speed at all times and adjust accordingly. [By the way, yawing is incredible for keeping a visual on this guy so employ that tactic.] The point total for the pursuing part will be the lion's share of the ranking for this mission -- score 3200 for an assured "A".

After a few loop-de-loops, some training decoys will be released. They'll be missile-unfriendly and require one's guns, so a pilot has to stick to his guns, literally. Obviously it helps to go rather slow since they have no way of fighting back. When they're destroyed, three towers appear as missile practice. Take 'em down to end the mission with a bang.

#### Mission update

...or at least that's how it would go on a normal day. Incidentally, there's a freight plane violating Neuwork airspace and dropping some cargo, which is guarded by a few fighters. The parachuting containers are the real targets but y'may have to wait for 'em to drop below 12,000ft or the plane'll stall due to the thinness of the air (or something).

#### A-rank requirement / strategy

Score 5000 points. The decoys and towers make up 1800 points, so the player has to score 3200 during the follow-the-leader portion. Points accumulate only when there's less than 1000 feet distance between the two crafts; it'll stop when there's more. [No points are accumulated during the non-exercise airspace violation portion.] It make take a few times to do get the right score, so pay attention to the F-15S/MT's flightpath. Y'probably don't have to be reminded how easily it is for the leader to make a 1500-2000ft gap if y'lose sight of him.

#### Mission roster

- **x03 Decoy** \u2014 First half of mission
- **x03 Tower** \u2014 First half of mission
- **x05 Container** \u2014 Second half of mission
- **x01 R-501** \u2014 Second half of mission
- **x04 R-201** \u2014 Second half of mission

### 04. Megafloat

- **Location:** Rocky Is.
- **Guide code:** WK04

- **Difficulty:** 3/10
- **Recommended:** MiG-33 Fulcrum SS -or- F/A-18U
- **Unlock:** F-16XFU Gyrfalcon

Neuwork's sending warships to reinforce the militarization of Megafloat, a floating city -- and it's your mission to stop 'em dead in their tracks. The best plane available will be the F/A-18U. Even though most of the targets are ships, y'might as well stick to normal short-range missiles and whatever type of machine-gun's available.

The first half of this mission, destroying the listed targets north and south of Rocky Island, is on a timer (3:00) which will, of course, affect possible updates. A good tip about defeating warships is that, when the main target's destroyed, all auxiliary defenses are as well, so concentrate on those to cut down on flyby time.

#### Mission update

When the inbound carriers are defeated within 3:00, four southeast-bound fighters will appear as reinforcements. Although their target is the city itself, which has neutral targets aplenty (you're not killing them are you?) the foes will simply circle like vultures, so don't confuse this for a protection mission. If y'plan on flying over the city, taking out the coastal defenses isn't such a bad idea though -- there's three guns and SAMs there.

Afterwards you can land on the carrier, but I suggest having autopilot do all the work.

#### A-rank requirement / strategy

Defeat 23+ targets in the mission. Thirteen are mandatory (3 warships, 6 auxiliary warship targets, 4 planes) so this requires defeating ten others. Non-targets are exempt from the tally, of course. The easiest way to do this is destroy Megafloat's 8 coastal defenses and two generic planes, but there's no reason y'can't mix-and-match as required.

#### Mission roster

- **x01 Carrier** \u2014 Default
- **x01 Convoy** \u2014 Default
- **x04 Facilities** \u2014 Default [Island - Non-TGT]
- **x09 Gun** \u2014 Default [x4 Island]
- **x05 MSSL** \u2014 Default [x4 Island]
- **x02 Transport** \u2014 Default [Island - Non-TGT]
- **x04 R-201** \u2014 Default [x2 Mission Update]
- **x05 R-101** \u2014 Default [x2 Mission Update]
- **x01 Warship** \u2014 Default

### 05. Scramble

- **Location:** Wiapolo Mts.
- **Guide code:** WK05

- **Difficulty:** 5.5/10
- **Recommended:** F/A-18 Hornet ADV -or- F-16XFU Gyrfalcon
- **Unlock:** R-101 Delphinus #1

Although plenty were killed so far, apparently the military thinks eight R-201s is a huge threat, and have dispatched the player to neutralized 'em before they can wreak havoc. Either of the two latest planes will suffice, perhaps the Gyrfalcon more since its missiles are standard instead of short- -range types.

Like usual, there's a time limit (3:00) for the first half of the mission. It's one's job to fly southeast to the runway and trash the R-201s, which is easiest accomplished by -- you guessed it -- ignoring all the other threats along the way. The runway itself is protected by a few AA guns and SAMs, but the R-201s are in their hangars. If y'take too long to kill 'em, they'll get airborne and the chance of doing everything expediently nosedives.

Since the planes are in two lines (two pairs of four), it's best to just fly in a circle(ish) motion and try to take out an extra one with the guns, too.

#### Mission update

The mission ends if one takes out the planes within 3:00; the update only occurs if y'don't. So, in this case, it's a dishonorable addition to the mission. Basically, all the R-201s not destroyed will now be airborne and the mission is to destroy them, plus select base facilities (the Tower). Obtaining this update ends the excursion in a "D".

#### A-rank requirement / strategy

Destroy 15+ targets (8 mandatory). Basically, in addition to the 8 planes one must destroy, take out 7 normal ones. This'll mean the easy five targets at the airport and two other planes, at least. To do this expediently, one would have to take out two planes EN ROUTE -- and that is ridiculously hard with the current planes, mostly because even if both missiles are fired, only one typically hits.

This is the first mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles which all but ensures a plane coming head-on is goin' down. [This mission can be finished in under 2:30 for reference.]

#### Mission roster

- **x04 Gun** \u2014 Default
- **x01 MSSL** \u2014 Default
- **x02 R-102** \u2014 Default
- **x02 R-211** \u2014 Default
- **x08 R-201** \u2014 Default
- **x01 Tower** \u2014 Mission Update

### 06. Target Acquisition

- **Location:** Expo City
- **Guide code:** WK06

- **Difficulty:** 3/10
- **Recommended:** F-16XFU Gyrfalcon
- **Unlock:** R-201 Asterozoa

In Expo City, there seems to be an illegal testing range that needs to be scooped out in case it's the foundation for a coup d'etat. For this mission, the Gyrfalcon's probably the best bet as it's rather even in all areas; the new R-101 Delphinus #1 sucks in the armor department and that'll be important here.

To reconnoiter the area, the plane must get each "Facilities" within missile range -- firing at this time will use laser targeting to photograph the place, rather than turning it into a towering inferno. There's 3:00 to do this to all facilities, so don't dawdle. Skipping the scrubs, i.e. the normal defenses, helps a lot, as one can shoot 'em down afterwards. [NOTE: Photos are only taken if the shot is lined up in a way that, if it were a missile, it would hit. Taking a pic at a 15-degree angle or something won't cut it.]

#### Mission update

Once the targets get their photo op, the additional objective of neutralizing some incoming fighters takes place. This is the type of thing an acclimated pilot can sleepwalk through.

#### A-rank requirement / strategy

Destroy 20 enemies, which means ten non-targets, such as defenses and any normal plane. The facilities "photographed" count as kills for some reason, so those _are_ factored in. There's infinite time to defeat enemies after going shutterbug on the facilities, so compared to the 5th mission, this is a cakewalk.

#### Mission roster

- **x04 Facilities** \u2014 Default
- **x03 F/A-18I** \u2014 Mission Update
- **x03 F-16XF** \u2014 Default
- **x06 F-16XA** \u2014 Default [x3 Mission Update]
- **x08 Gun** \u2014 Default
- **x03 MSSL** \u2014 Default

### 07. Fragile Cargo

- **Location:** Axel Bay
- **Guide code:** WK07

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

A terrorist communique has alerted the UPEO Command that a plane carrying bioweapons is on a collision course over Axel Bay's industrial district. This is going to be an enjoyable change of pace, so pick up a top-tier plane and get moving.

The briefing detailed the general gist of things: rather than defeating the plane, which would spread its caustic payload around the region, one has to destroy the obstacles in its path: buildings, chimneys, and the like. The enemy's dirigible-like aircraft is not a speed demon, but new targets won't appear unless it's within a certain range (otherwise, y'won't know which ones to attack). Basically, just fly in a circle until the next target appears; don't go seeking them out or you risk getting too far away! They next chimney is one locally, not far away. The final target is the bridge, which allows the craft to land safely.

#### Mission update

Once the dirigible splashes down, a hydrofoil will be launched -- this one's marked for destruction. It takes a few missiles to die, but is basically a fast-moving AA gun so don't get perforated. [You still can't shoot the first craft or it's a game over!]

When the festivities end, congratulations on crippling the city economy!

#### A-rank requirement / strategy

Automatically achieved by getting all (12) targets.

#### Mission roster

- **x01 UI-4052** \u2014 Default
- **x10 Chimney** \u2014 Default
- **x01 Bridge** \u2014 Default
- **x01 Hydrofoil** \u2014 Mission Update

### 08. Demilitarization

- **Location:** Rocky Is.
- **Guide code:** WK08

- **Difficulty:** 5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

Despite repeated warnings, Neuwork's continuing to fortify Megafloat, its buoyant city seen in a previous mission, so now it's time to bring the hammer down with impunity. The Gyrfalcon or Delphinus work well for this task, but the new R-201 might be a fun choice because, despite its power and mobility problems, it gets the MIRV. It stands for "Multiple Independently Targetable Reentry Vehicle" but you'll can call it a splintering warhead. Basically, it's a single missile that "splinters" into other smaller ones, allowing one strike to hit multiple targets. Pretty snazzy. [NOTE: The MIRV is fun but not a good choice for trying for "A" rank.]

There's not many surprises for the demilitarizing, although there's a 3:30 time limit to do it all in. All targets are, expectedly, by Megafloat: four gun emplacements and a tower, plus two R-101s flying overhead. There's a lot of other targets around, though, including a sea full of warships and convoys. Don't leave the planes for last, as they're the most wily.

#### Mission update

This is a "dishonorable" update -- it only occurs if the primary time limit is not achieved. At that time, a hydrofoil is launched from the northern port becomes the new target. It's basically just a moving AA gun and takes a few missiles to blow up. If it escapes, mission fails even harder than it already is. [Minimum rank achieved in this case is "C", although it can go higher; I don't believe you can get an "A" here...]

#### A-rank requirement / strategy

Achieve 24+ kills -- 7 are mandatory, 17+ are normal. For the seventeen, 8 can come from ships, four from island MSSLs -- the other five have to come from planes. The easiest way to start is to kill the two convoys nearby, then the aircraft carrier in the south, then the target planes over Megafloat. Destroy all targets/MSSLs on the island but one (the Tower can't fight back so it makes a natural choice) and destroy five planes before killing the final target. Getting 19-20 kills isn't that hard about now, but this is yet another task better left for the mission simulator -- it's just mind-numbingly difficult now with the time limit. [NOTE: I don't know how the Hydrofoil comes in, as you can destroy all targets right on the time limit and still get it to launch, so it might be able to account for one of the 17.]

This is the second mission in the game where it's suggested to take a lower rank and achieve an "A" in the mission simulator (unlocked by beating game on Normal difficulty), which allows one to use later planes. These ones can fire 4 missiles, ensuring its targets die more often.

> **Note:** The 2nd convoy sometimes survives if you're going too fast, so try to decelerate a bit and attack from an altitude; or, use the vulcan cannon to inflict a little more punishment.

> **Note:** You may want to do the difficult part (defeating 5 planes) first, then doing the easier targets.

#### Mission roster

- **x02 R-201** \u2014 Default
- **x06 R-101** \u2014 Default
- **x01 Tower** \u2014 Default
- **x07 Gun** \u2014 Default
- **x02 Convoy** \u2014 Default
- **x06 MSSL** \u2014 Default
- **x01 Carrier** \u2014 Default
- **x01 Hydrofoil** \u2014 Mission Update [Only if 3:30 limit exceeded]

### 09. Moonlight Flower

- **Location:** Scofields Plat.
- **Guide code:** WK09

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** ---

One of Neuwork's power plants is supplying an illegal munitions factory, so it needs to be removed from the face of the earth. The microwave signals'll screw up missile guidance, however, so a pilot has to rely on the ole vulcan cannon for assistance. Because of this, it helps to have a maneuverable plane with a good cannon -- such as the Gyrfalcon. Do not bring the R-201! It's a slowpoke with poor maneuverability and its MIRVs, though fun, are unreliable, even in an advantageous situation (such as shooting two MIRVs at a plane's six at level altitude).

The power plant complex is in the south and arranged in a "quincunx" array: four outer targets and the reactor in the middle. The power plants themselves are immune to missile targeting, but that doesn't mean they're immune to missiles themselves, mind you: "dumb" projectiles will still destroy them. The vulcan guns are generally best unless you're a deadeye (missiles tend to drift away from target unless they're at close range).

When all four plants are rubble, the center conelike plant will expose its core. Firing blindly at level altitude won't do anything, though -- a player has to get some height and destroy the top of the structure.

#### Mission update

If the four power plants are gunned down within 5:00, the subsequent step is to destroy the exposed reactor core -- the center volcano-like structure. Fly a little above it and shoot the summit; try too low and the missiles may just hit the side harmlessly. Unlike previous missions, the timer is still running and the core must be destroyed within the 5:00 as well.

#### A-rank requirement / strategy

Kill 18+ targets: 5 are mandatory, so that makes 13 others. Luckily, this is a bit easier if y'know what to expect. First, plan on destroying the eight ground targets, plus the R-701s that are riduculously slow and don't move around much. That leaves three normal planes to destroy in five minutes. The option is how best to approach this map. My order would be this:

1. Destroy any 3 planes near northern airport [x3 KO]
2. Destroy MSSL/R-201 at northern airport [x2 KO]
3. At Power Plant area, destroy plants, then the guns and 2nd R-201 [x9 KO]
4. Destroy three MSSLs on outer fringe of map [x3 KO]
5. Race back and destroy the core before time is up.
Since the hardest "wild card" is the 3 planes, so it's important to get them out of the way first -- it can be achieved in apx. 1:00 so try to aim for that time. Make sure to take it slower (or aim more carefully) at the plant site because if you miss once, y'have to fly all the way back around and get it again. It's important to cut down on wasted time here, since the flight to all three MSSL sites takes about 1:00 on its own (maybe 0:45 if you're already going 3000mph at all sites, which isn't likely to happen).

Note that you can skip the MSSL part and get three more planes instead, but I like to go for the sure thing myself. The "A" ranks only get tougher, so...

#### Mission roster

- **x04 Gun** \u2014 Default
- **x04 MSSL** \u2014 Default
- **x04 Pow.Plant** \u2014 Default
- **x03 R-101** \u2014 Default
- **x04 R-201** \u2014 Default
- **x02 R-701** \u2014 Default

### 10. Maze

- **Location:** Hatties Ra.
- **Guide code:** WK10

- **Difficulty:** 5.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** \u2014

A bit of a breather from the ninth mission, this surveillance assignment is on a General Resources plane flying through a ravine. If you've never played an Ace Combat game, y'may be unaware of how much they like making planes fly in tight, precipitous, or claustrophobic environments -- this is the first "ravine" mission. Basically, one flies upriver, navigating the canyon while keeping a few things in mind:

- Flying in first-person mode makes this easier
- Cruise relatively slow; speed + sharp turns = burrowing into cliff
- Value a plane's mobility over everything else
- Yaw (with shoulder buttons), rather than hard turn, whenever possible
- Don't fly above the cliff rim or you're picked up on radar and auto-fail
The plane in question travels unassumingly forward, so it's a sitting duck... but like all lucky ducks, it's marked as a non-target -- refrain from any potshots. If you're wondering where the difficulty is in this excursion, it doesn't have much. Still, some of the terrain is annoying and it's possible to crash in a downturn yaw because the water's surface is so reflective, it seems like there's more distance between the pilot and it.

> **Note:** Mission failure if the chemical weapons plant is not discovered within 5:30! This is not stated anywhere but the penalty's definitely there.

The R/F-117X can rise above the canyon without any repercussions, leaving the player to squeak by some of the narrower sections of the gorge. Also, at one point, the river opens up into a circular form and there's a sharp turn to the next area -- this one has enough flying room, however, if you're going slow.

#### Mission update

About 4:00 into the pursuit -- if you were following the plane closely -- a chemical weapons factory will be discovered. It's plainly situated inside a basin's natural reservoir, which barely has enough maneuvering room, so one simply just shoots the 'base' to finish the mission.

#### A-rank requirement / strategy

Destroy 8+ enemies overall. There's only one mandatory target ("Base") but plenty of helicopters to destroy on the way. The base only has five generic targets (3 ground, two copters) so destroy some other AH-66Bs on the way to pick up the slack. If you take the west path at the first bifurcation, one can pick up four extra kills, compared to the east path which skips all of 'em. As y'know, there's a 5:30 time limit on following the plane, so don't bother exploring as there won't be any way to salvage a mission that goes off a sightseeing trip.

#### Mission roster

- **x01 R/F-117X** \u2014 Default
- **x19 AH-66B** \u2014 Default
- **x01 Base** \u2014 Mission Update
- **x02 Oil Tank** \u2014 Mission Update
- **x01 Hydrofoil** \u2014 Mission Update

### 11. Escort

- **Location:** Mt. Lambert
- **Guide code:** WK11

- **Difficulty:** 3.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** RF-12A2 Blackbird

Back to the free skies! This time, a NUN (Neo United Nations) chairman has been targeted by terrorists and requires a watchdog while flying over the Lambert Mountains. Since we haven't obtained any good planes in a long while, the Gyrfalcon is probably the best available.

As the mission starts, the bogeys are along the eastern edge of the map, two groups, five total. Fly out to meet them (why would you endanger the ally?) and systematically send them crashing to the mountains below. Although some may try to coax the player into dogfighting, always keep an eye on any who go straight for the civilian plane -- not only because it's in danger, but because those foes are easier to shoot down, generally.

> **Note:** The 1st midair refueling takes place after this, but feel free to autopilot it.

#### A-rank requirement / strategy

Defeat all five enemies in under 3:00. It's not that hard to burn figurative rubber and defeat the first two in under 1:00, so the mission doesn't seem that hard if y'use that as a baseline. Just try to shoot advantageously (like not upside-down, where missiles seem to blow at hitting things) and don't go too fast, or y'may overshoot. Also, it helps if you can destroy a plane when first encountering a group; just go slow enough and align yourself to up the likelihood of success.

#### Mission roster

- **x05 F/A-32C** \u2014 Default
- **x01 R-5050** \u2014 Default [Ally]

### 12. Stratosphere

- **Location:** White Valley
- **Guide code:** WK12

- **Difficulty:** 3/10
- **Recommended:** RF-12A2 Blackbird
- **Unlock:** ---

Neuwork's sent an aerial platoon to attack White Valley airbase, and they're cruising at a 30,000-foot altitude. The only plane that can really get that high is the new Blackbird stratofighter. Since this is an aerial mission, bring normal missiles (MIRVs aren't needed and short-range missiles are dumb) and whatever gun of your choosing.

After the awesome launch sequence, the airborne fleet is met high above the earth's weather patterns. The Blackbird is made for armor and to withstand pressure (I guess?) so it's not a speed demon and, in fact, sucks at quick maneuvers, making its actions seem rather sluggish. But, that'd only be a problem if the enemy weren't; here, they too lumber about the stratosphere and are pretty easy to shoot down overall. Just make sure to hit the back ones first and move toward the front; it wastes less time.

There's a 5:00 failure limit for this mission. Also, afterwards, there'll be a (skippable) runway landing.

#### A-rank requirement / strategy

Defeat eight targets (2 normal). The dumb thing about this is, the high-up targets eventually move pretty far ahead of the pack, so to make this goal feasible, y'have to take out some of the lower-flying R-311s before engaging the "main course." [NOTE: The stratosphere planes vanish off the map if you get too low, which is another reason to get the annoying part out of the way first.] If you do things right and maybe get a little luck, y'can finish this in just over 2:00 -- hilarious!

#### Mission roster

- **x08 R-311** \u2014 Default
- **x06 R-531** \u2014 Default

### 13. Claustrophobia

- **Location:** Amber Mts.
- **Guide code:** WK13

- **Difficulty:** 5/10
- **Recommended:** F-16XFU Gyrfalcon -or- R-101 Delphinus #1
- **Unlock:** F-15S/MT Eagle+

Intermediate-range ballistic missiles (IRBMs) have been confirmed at some mountain bases, and within the scope of their range are the cities of Expo City and Port Edwards. Although it's unknown whether they're Neuwork-made, the fact stands that they must be taken out, despite the dense fog. Like usual, the Gyrfalcon is probably the best pick here. [The RF-12A2 plane can't be selected for these normal, low-altitude missions, by the way.]

The first half has a 6:00 time limit. The targets are the eight bases (two groups) plus two guns, making a total of ten targets. However, the player's really at battle with the canyon-ridden terrane here, where some targets are on the cliffs and other emplacements below the cliff rims. Trying to do a systematic sweep ends up being rather sucky in this case.

#### Mission update

This is another "dishonorable" update. Should all targets not be destroyed within the six-minute timeframe, one of the infamous missiles (IRBMs) will be launched and the player'll have to hunt it down before it leaves the map. Expectedly, the missile is immune to lock-ons so one'll have to exercise the ole trigger finger and shoot it out of the sky with manual aim.

#### A-rank requirement / strategy

Score 30 kills. Ten (10) are mandatory, so that leaves the other twenty up to the player. Luckily, even on a "sightread" of this objective, there's so many ground targets that they easily boost the ranks to the high. However, to get 30+ in a reasonable fashion, destroy the R-701s (helicopters) floating around the canyons. If you plan on just going for the easier ground defences, you'll need to defeat three. Opportunistically, if y'can't find any around the base areas try to defeat one of the local planes. [It's possible to get thirty targets with apx 4:20 so that leaves a bit of leeway to get the last few kills.]

Also, since the base contains clustering targets, employ the machine gun and try to take out a target if no missiles are readied -- it saves a trip back.

#### Mission roster

- **x09 Gun** \u2014 Default
- **x04 MSSL** \u2014 Default
- **x08 Base** \u2014 Default
- **x03 R-102** \u2014 Default
- **x02 R-201** \u2014 Default
- **x02 R-211** \u2014 Default
- **x03 R-701** \u2014 Default
- **x01 IRBM** \u2014 Mission Update

### 14. Reaching for Stars

- **Location:** Comona Is.
- **Guide code:** WK14

- **Difficulty:** 4/10
- **Recommended:** F-16XFU Gyrfalcon -or- F-15S/MT Eagle+
- **Unlock:** F-16XA Sakerfalcon

A platoon of Antlion tanks has been dropped near a space shuttle launching site, and they appear to an attempt by General Resources to commandeer the research facility. This is a good time to break out the new Eagle+, which has better average stats than the other planes thus far, plus a wider arsenal. Normal missiles and whatever machine-gun should suffice.

The first half of the mission takes place as the tanks are being airdropped to the space shuttle facility. They're in parachuted freefall and have no means of attacking, and take quite awhile to hit the ground, so destroy them in your preferred way. It may take a few passes unless you go very slow and attack the nearest ones. [This part can be done in under 1:00 by this method.]

#### Mission update

When all Antlions are kaput, a squadron of five F/A-32Cs appears, inbound from the north. Not exactly a dire situation but the skies will be swarming with planes -- still, most enemy aircraft seem to just fly around at low altitudes and do nothing in particular, so keep mobile, basically.

#### A-rank requirement / strategy

Destroy all targets. Fourteen (10 Antlion, 4 F/A-32C) are mandatory, so that leaves the generic fighters plus the C-17B. Since the time limit really means nothing after the update, this should be a fun-filled airborne massacre of easy proportions.

#### Mission roster

- **x10 Antlion** \u2014 Default
- **x01 C-17B** \u2014 Default
- **x08 F/A-32C** \u2014 Default [x5 Mission Update]

### 15. Guardian Angel

- **Location:** Comona Is.
- **Guide code:** WK15

- **Difficulty:** 3.5/10
- **Recommended:** F-16XFU Gyrfalcon -or- M-15S/MT Eagle+
- **Unlock:** R-352 Sepia

With the success of the launch in the previous mission, the shuttle is now on a return course. Naturally, the General Resources gang is up to their old tricks and have come back with a few squadrons to thwart the landing attempt. Unfortunately the new (?) Salkerfalcon isn't meant for aerial fighting, so it's back on the reliable Eagle+ to keep the good times rolling.

There are two groups of enemies (4/3 split) to defeat within 4:00, which is a lot easier than y'may think -- most are less focused on extreme maneuvering than they are on finding and attacking the R-808. Take out the first four in a relatively quick time (1:30?) and be ready to hit the second wave, which is likely to be closing in on the shuttle. Obviously, it's mission failure if the civilian craft is blown to smithereens.

#### A-rank requirement / strategy

Finish in under 3:00, which is pretty easy to do in the Eagle+, although a little luck helps. I managed to sightread the excursion in 2:25:xx so it's really not too much of a pain.

#### Mission roster

- **x07 F-22C** \u2014 Default
- **x01 R-808** \u2014 Default [Ally]

### 16. Zero Gravity

- **Location:** Space
- **Guide code:** WK16

- **Difficulty:** 4/10
- **Recommended:** R-352 Sepia
- **Unlock:** ---

Welcome to the exosphere, i.e. outer space. There are some rebel satellites that need to be defeated within the short amount of time the plane has going for it. In this case, the R-352 Sepia is mandatory, and if y'look at its growth chart, its armor and mobility are maxed out but it's got poor fighting capabilities and stability, too. Oh dear. It does the get the unique Neutron Beam (gun slot) and Plasma Beam (missile slot) weapons.

After blastoff, the mission begins and the 3:00 timer begins. The satellites don't fight back but the zero-grav conditions make maneuverability less than stellar (not a pun), as acceleration is a bit harder than in the atmosphere. Note that if y'exceed the time limit, the satellites click on and approaching one will blow up your vessel.

> **Note:** I suggest getting through atmospheric reentry on autopilot.

#### A-rank requirement / strategy

Defeat the four satellites in under 2:30.

#### Mission roster

- **x04 Satellite** \u2014 Default

### 17. One-Way Ticket

- **Location:** Sandbury D.
- **Guide code:** WK17

- **Difficulty:** 4-7/10
- **Recommended:** F-16XFU Gyrfalcon -or- F-15S/MT Eagle+
- **Unlock:** F-22C Raptor II

Some of Neuwork's researchers were abducted by unknown assailants, and they are currently fleeing across the Sandbury Desert. Warm-heartedly, the brass has ordered the player to destroy the train and save the civilians. There's no reason to pick anything other than the F-152/MT for this, but y'can if you want to.

Although there isn't a stated mission time for this, it's actually 4:30, the time it takes for the train to reach the base. Hilariously, this low-lying, fast-moving train is quite an opponent. Not only can it not be targeted by missiles, but sections of the train are marked as non-targets, so the player has to destroy a certain section with precision gunfire (or face demerits in the form of a lesser rank). The targets are all cars that do not have a weird 'x' non-lock-on symbol over them, which can be hard to match up unless you've got a bird's-eye view of things. [There are six in all.]

There are only two ways to attack the plane, which, occasionally, is obscured by tunnels and train bridges:

- Get to a height and dive at the train, pulling up during deceleration to get another shot (train moves forward, you don't, yadda yadda yadda). This isn't that bad of a way to do things, particularly as it allows for easier maneuvering where enemy planes are concerned.
- Make a parallel flightpath with the train, but a little off to one side, so that the vulcan's live rounds arc down to the train. This method doesn't require much movement (hooray!) but may endanger the other non-target cars in the process, if you're a poor shot (boo/hiss!).
Mission ends when the six 'bad' train cars are destroyed.

#### A-rank requirement / strategy

Defeat four of the seven planes flying around, in addition to destroying the 6 'bad' cars of the train. In a hilarious twist, the train part is hardest; defeating four scrub pilots is a cinch. Destroying even one civilian car will bump this down to a "C" rank, however.

#### Mission roster

- **x01 A.Train** \u2014 Default [x6 'bad' cars, x3 Non-TGT]
- **x06 F/A-32C** \u2014 Default

### 18. Bug Hunt

- **Location:** Chopinburg
- **Guide code:** WK18

- **Difficulty:** 2/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** F/A-32C Erne

In one of the weirder missions, some nanobite creatures have been released in the forests near Chopinburg and must be destroyed by special means. Any of the recent planes should work, although the F-22C has perhaps the best stats of any available now. All planes will be equipped with the Anti-Nanobite Bomb in the missile slot, and as you'll quickly find out, it's a ground bomb with no homing capacity.

The mission itself is fairly standard, although there will be a "virus alert" when you're at a certain radius from the nests, which darkens the screen and can cause crashes if you're at a declining angle. The A-N Bomb has an area of effect, so you'll want to aim it (with the hanging reticle) in the center of groups to score lots of kills with one boom. Try to avoid flying by the nests if y'can, as they may waste precious time.

On the flipside, Nanobites have no means of attack so one basically just has to aim well and this should be over soon. Remember that you want to aim between targets, not the targets theselves! Also, the loop-de-loop maneuvers are great for this mission as they cut down on attack recovery time and set up the player for a bird's-eye view of the bombing zone.

> **Note:** Despite the weapon's long reload time, it helps to do a well-aimed long-range shot on the approach to the colony. This clears some of the targets and gives time to get another shot before doing another flyby.

#### A-rank requirement / strategy

Finish mission in 4:30 or less.

#### Mission roster

- **x24 Nanobite** \u2014 Default

### 19. Blackbird

- **Location:** White Valley
- **Guide code:** WK19

- **Difficulty:** 6/10
- **Recommended:** RF-12A2 Blackbird
- **Unlock:** ---

Four R-531s are cruising a high-altitude flightpath en route to White Valley airbase, so it's time to intercept using the Blackbird last seen during the "Stratosphere" mission. It's the only option for these types, of course.

There four R-531s fly in line formation, so y'can gotta have a good touch to all this.

#### Mission update

After 1:30 has elapsed on the clock, 2 R-311s (per R-531) will sortie and become the new targets. Unlike the lumbering fool bombers that have been killed lately, these ones are fleet-footed speed demons and a lot harder to destroy, so y'want to minimize as many that as soon as possible.

#### A-rank requirement / strategy

One word: DIFFICULT. If the R-531s sortie their "spawn" the mission's pretty much flushed down the toilet, so that leaves a 1:30 prep time to destroy all four planes. Since they fly in a line, the best way is to fly perpendicularly to them -- again, also hard, given the gravity, altitude, crappy turning, etc.

How many times did I reset until it finally worked? Lord only knows. But, this is the general gist of what you wanna do:

1. Steer toward the leftmost of the 4-plane unit, coming up behind it at a parallel angle.
2. As you near closer (about within 4000 feet), arc slightly "rightwards," so that as y'shoot the leftmost plane, your plane's nose is already heading for the next-nearest plane. DECELERATE HERE.
3. Destroy the next-nearest (by the skin of your teeth!) as the player's plane enters a semi-perpendicular flightpath, heading for the third plane, which is probably higher than the 2nd one. Adjust altitude for it.
4. Destroy Plane #3 and hard-decelerate. About 0:45 should have passed on the clock.
5. There's 0:45 to defeat the final plane, which, often, is overshot and has to be killed in the next flyby (that's how I did it anyway). If it comes down to overshooting the target, accelerate and circle around, then attack from aft for an ensured kill.
> **Note:** This is one mission y'may want to leave for the simulator, later on.

#### Mission roster

- **x04 R-531** \u2014 Default
- **x04 R-311** \u2014 Mission Update

### 20. Fjord

- **Location:** Petrol Coast
- **Guide code:** WK20

- **Difficulty:** 4/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** ---

In the Petrol Coast, a logistics base is serving as a refueling point for Neuwork's fleet. However, the fjord (which is a craggy inlet with steep cliffs, if y'didn't know) terrane can make this less than a cakewalk. The Raptor II is still probably the best available plane, but the Eagle+ will suffice as well.

There's a nine-minute (9:00) time limit to finish all this in, which should be more than enough. The targets are parked under (unbreakable) cement roofs, so the only way to destroy them is at a near-level flightpath and aiming into the port structure. Try to do it from above and the shot's trashed. Only the convoys (third-from-north inlet) are out in the open seas.

#### Mission update

If Neuwork's mobile fleet (convoys, submarines) are not destroyed within the time limit, they'll launch almost immediately after. This situation isn't that dire as the waterborne crafts are mighty slow, so you could fly halfway across the map and back without much changing.

#### A-rank requirement / strategy

Destroy 30+ enemies (12 are mandatory). Despite the enemies situated in four inlets, this manages to be one of the easier "A"s achieved. Case in point: I defeated all enemies within 11:38:xx and still got an "A". Don't worry about the time limit whatsoever, as long as you're racking up a huge number of kills. [NOTE: Auxiliary ship targets, such as Convoy guns, don't count toward the 18+ kill requirement.]

#### Mission roster

- **x03 Convoy** \u2014 Default
- **x02 R-201** \u2014 Default
- **x10 R-211** \u2014 Default
- **x08 R-701** \u2014 Default
- **x03 Submarine** \u2014 Default
- **x06 Gun** \u2014 Default

### 21. Counterterrorism

- **Location:** Gulf of St. Ark
- **Guide code:** WK21

- **Difficulty:** 4/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** ---

A large carrier craft has been spotted flying over Megafloat, and it seems to be an attempt at a coup d'etat! The player's ordered to scramble immediately and shoot it down, with either of the recommended planes (above) working just fine on that end. [A funny note is how, in Ace Combat's world, St. Ark is in the far north and Rocky Island, where Megafloat's listed as being, is in the southwest sea -- worlds apart from each other.]

The flight starts with an interception flightpath at the UI-4053 zeppelin (!?) inbound from the southeast. This beast is formidable and is equipped with permanent AA gun and missile fixtures (can't be destroyed), and since its target is on the underside, the best method is to snipe at it, make distance, and try again -- this avoids most AA gunfire and provides wiggle room should any missiles lock-on. It takes x4 missiles to destroy each part, at least on normal difficulty, with a total of x16 shots required to defeat it. It's a good idea to fire missiles in a four-pack (top-tier planes can do this) while doing loop-de-loops behind the target, maintaining distance while avoiding the ever-increasing lock-ons.

> **Note:** Attack from level or slightly lower height; from above the target, the missiles simply hit the exterior harmlessly.

#### Mission update

When the carrier is significantly damaged, 4 more targets appear to escort it out of the hotbed you've created. A fast plane with four-missile capabilities should be able to get to this point in little over a minute, luck prevailing. The dirigible still has AA gun capabilities, by the way.

#### Mission update

Wow, a 2nd update. A single UI-4054 will appear to destroy. I believe this had some storyline significance but, as you may or not know, the NTSC version of this game had its plot butchered while the JP version retains the story and split-path storyline. Oh well. This sucker is slippery and does hairpin maneuvers quite easily while maintaining distance, so hopefully catch it off-guard and defeat it quickly (to preserve "A" rank, as it were).

Enjoy the Hindenburgian ending.

#### A-rank requirement / strategy

Defeat all targets within 4:00. A plane that can fire four missile at once should be able to achieve the mission update within 1:00, give or take a few seconds, which leaves ample time to destroy the four other planes. The blimp won't have any attack capabilities either, so there's no threat of missile lock-ons (this is mentioned since the planes arrive to escort the blimp out of the region).

#### Mission roster

- **x01 UI-4053** \u2014 Default
- **x01 SU-43** \u2014 Mission Update
- **x01 XFA-36A** \u2014 Mission Update
- **x01 UI-4054** \u2014 Mission Update [II]

### 22. ECM

- **Location:** Expo City
- **Guide code:** WK22

- **Difficulty:** 3/10
- **Recommended:** F-15S/MT Eagle+ -or- F-22C Raptor II
- **Unlock:** Su-37 Super Flanker

Ouroboros is operating an illegal weapons plant in Expo City, and their radar will be jammed to ensure a stealth entry into the region. An agile plane with decent power serves a guy well here, as both will be called upon frequently, if y'want the best rank, that is. The Raptor II works well.

So, about the mission's jamming periods. The game's timer here is replaced with a countdown clock ticking off 1:30 -- green means it's not safe to go below 12500ft, red means it is safe. When the jamming period is almost over, there'll be a notification to climb back up to a safe altitude to avoid any foes learning what's going on. This can be accomplished within about 0:10 if you aim straight upwards and gun it, so don't dawdle. After a jamming period, there's always a 0:15 until the next one, so this can be a long mission for people who aren't thorough -- or just like to destroy every little thing in the map.

Success in this mission is based on how well stealth is maintained -- "A" is for no enemy detection whatsoever while "D" is if the enemy did notice one's presence (no in-betweens).

#### Mission update

This can happen at any point in the mission. If the player's detected by the enemy radar (which makes jamming a useless measure) then twelve maneuverable planes of three sorts appear on the map. Note these aren't "targets", but are generic enemies meant to add insult to injury.

#### A-rank requirement / strategy

Finish mission without enemy being alerted to the player's presence. This (detection) happens if a player is below 12500ft when a jamming period is not active. Y'know you've left the jamming area because you're in the blue skies above the cloud cover, which, from my layman understanding, is necessary to bounce radar waves off of? Maybe? Yeah, that's the ticket...

#### Mission roster

- **x02 Pr.Plant** \u2014 Default
- **x07 Radarsite** \u2014 Default
- **x02 AH-66B** \u2014 Default
- **x03 F/A-32C** \u2014 Mission Update
- **x05 F-22C** \u2014 Mission Update
- **x04 RF-12A2** \u2014 Mission Update

### 23. Swarm

- **Location:** Eusian Ocean
- **Guide code:** WK23

- **Difficulty:** 4/10
- **Recommended:** F-22C Raptor II -or- Su-37 Super Flanker
- **Unlock:** R-102 Delphinus #2

Despite repeated warnings by UPEO, the Neuwork airforce has continued to mobilize on Megafloat. That's the last straw -- destroy all their planes! The Su-37 Super Flanker has the best stats at the moment, but doesn't have that many weapon options -- normal Missiles are better than short-range ones, at least.

In a first for the mission, there'll be an ally plane (Su-43) who'll assist in destroying the foes, and boy, are they out in force. There are twenty-six aerial targets in loose clusters, and the name derives from the enemy's "swarm" ability, which happens when a cluster is approached -- they all go for the jugular. Of course, not many are that good a pilot, so this isn't as hard as it is lengthy. Just remember to play opportunistically and don't chase one around at close range when y'can switch to a mid-range target and gun it down.

#### Mission update

When the aerial masses are finally sent to the ocean floor, Megafloat's navy becomes the next entry to cross off the hitlist. Megafloat itself has a few armaments (basically the same things seen in fourth eponymous mission) and other non-targets, such as helicopters and a few buildings.

#### A-rank requirement / strategy

Score 34 kills (26 are mandatory). The generic targets appear on Megafloat during the update, so basically destroy all foreign armaments on the island before turning one's sights to the navy. The ally Su-43's kills are added to the player's, but he doesn't really do anything during the update, which is actually good when it comes to reaching the quota.

#### Mission roster

- **x05 R-101** \u2014 Default
- **x05 R-102** \u2014 Default
- **x06 R-103** \u2014 Default
- **x05 R-201** \u2014 Default
- **x05 R-211** \u2014 Default
- **x06 MSSL** \u2014 Mission Update
- **x12 Gun** \u2014 Mission Update
- **x04 Convoy** \u2014 Mission Update
- **x02 Carrier** \u2014 Mission Update
- **x05 V-22B** \u2014 Mission Update [Non-TGT]

### 24. Damage Control

- **Location:** Port Edwards
- **Guide code:** WK24

- **Difficulty:** 4/10
- **Recommended:** Su-37 Super Flanker -or- R-102 Delphinus #2
- **Unlock:** ---

Because of the actions taken aboard Megafloat, General Resources has mobilized its own air fleet and this has caused fighting to break out over Port Edwards! Some civilian press choppers have also been caught in the crossfire, so it's time to mitigate the conflict and save our reporters! Either of the two latest planes should suffice, although the Delphinus #2 gets a swazzy Pulse Laser to replace normal machine-guns!

As expected, it's typical dogfighting action. The planes travel in packs of 3-5 and are spread out across the city, but when one's almost dead another seems to join the fray, so the fighting is often continuous. Each group has one or two planes marked as the real targets, though, so a lot of the others can be ignored for these purposes. [Also, the news choppers aren't actually threatened by the other planes, so this isn't a protection gig.]

#### Mission update

When all crucial targets are buried, four targets in Port Edwards' southeast district. Since time isn't a rank-based factor in this mission, and the friendly fliers aren't endangered, dismantle their crafts at leisure.

#### A-rank requirement / strategy

Destroy 22 of 28 enemies (10 mandatory). Time doesn't factor into this, so it basically turns the entire map into a free-for-all. I killed everyone but the friendlies within 10:20:xx and still got an "A," so...hakuna matata, man!

#### Mission roster

- **x03 R-102** \u2014 Default
- **x06 R-103** \u2014 Default [x2 Mission Update]
- **x06 F-22C** \u2014 Default
- **x07 XFA-36A** \u2014 Default
- **x04 V-22B** \u2014 Default [Non-TGT]
- **x02 F/A-32C** \u2014 Mission Update

### 25. Conspiracy

- **Location:** Expo City
- **Guide code:** WK25

- **Difficulty:** 3/10
- **Recommended:** Su-37 Super Flanker -or- R-102 Delphinus #2
- **Unlock:** Su-43 Berkut, R211 Orcinus

As it turns out, the Neuwork/General Sources fight that's been going on has been instigated by an Ouroboros outpost in Expo City (a.k.a. City of Eternal Night!) and the clearance from the higher-ups has been given for a bombing run. Either of the top-ranking planes should suffice for this raid.

The target planes are flying all around the city, but the target buildings're rather easy to destroy. There's not too many MSSL launchers in this map but there's still a few Guns here. Overall, pretty generic target requirements, exemplified by the time limit's uselessness (this is a kill-based mission and the counter is unimportant, so take as much time as y'need).

#### Mission update

After a cutscene, the enemy personnel's V-22B helicopter will try to take off from its underground hangar. The player's plane will be situated in front of it, so do a careful run into the hangar and blow it up, which ends the mission with finesse.

#### A-rank requirement / strategy

Defeat 21+ of the 24 targets (10 are mandatory). Like the previous mission, time is not a factor so destroy any and everything at your leisure and still obtain an "A" (I did it in 7:53:xx).

#### Mission roster

- **x04 Base** \u2014 Default
- **x03 R-211** \u2014 Default
- **x03 Su-37** \u2014 Default
- **x04 Su-43** \u2014 Default
- **x03 MSSL** \u2014 Default
- **x06 Gun** \u2014 Default
- **x01 V-22B** \u2014 Mission Update

### 26. Intercept

- **Location:** Eusian Ocean
- **Guide code:** WK26

- **Difficulty:** 4/10
- **Recommended:** R-102 Delphinus #2 -or- Su-43 Berkut
- **Unlock:** ---

Neuwark's space research satellite has splashed down in the ocean and the hydrofoils from Megafloat are en route to collect it; however, General Resources is also aiming for that goal and have their own seacrafts tagging along. Time to scramble and make G.R. eat some dust...err, water dust. Err, sea dust. Okay, forget the metaphors! Two new planes were obtained recently and the best of the two is the Su-43 Berkut, undoubtedly.

The object of this mission is to prevent the enemy ships from contacting the shuttle first -- if they do, it's a failure. So, prioritize: at the start, head due south and destroy the target vessels, already dangerously close to the capsule ignoring the airplanes. There's a 2:00 time limit for this part.

#### Mission update

When all enemy ships are sunk, a reinforcement fleet shows up, and this one has faster hydrofoils. Again, not hard to defeat inherently, but a bit tough to deal with when grappling with the "A" rank challenge.

Always remember that this is a give-and-take mission: if you puppyguard the allies, the ships will get the satellite; if you don't destroy the ships fast enough, the aircraft will beat the crap out of the friendlies.

#### A-rank requirement / strategy

Defeat 28 enemies (20 are mandatory ship-based enemies). Although there's not a lot of time to screw around in, the basic gist of doing this is to create a window of opportunity. In the feat, defeat all but the farthest from the satellite and start decimating some aircraft. Hopefully this also takes some heat off the allied Neuwark hydrofoils inbound to collect their shuttle. If another window is needed for the 2nd and final wave, defeat all the hydrofoils and destroy all but the farthest convoy, and commence more killing.

Personally, here's my strategy:

1. En route to satellite, destroy one plane coming head-on
2. Turn around and defeat at least 2-4 more heading for the friendly h'foils
3. Defeat all ships in under 2:00 (mission failure is actually 1:56)
4. During mission update, kill [8-x] amount to reach 8 kills
5. Kill remaining ships
Note that, as long as you realize that the oncoming planes at the start are going towards the hydrofoils, you can sneak up behind them...if you react fast enough. Other planes try to engage a player and mess up their bearings, but many planes go straight north -- a guy can kill about 5 here! [I would recommend only killing four, as it wastes too much time to get back.]

> **Note:** If the ally hydrofoil unit is destroyed, a "D" is automatically gained.

> **Note:** You must destroy all ships to get an "A". If the ally hydrofoiils reach the target first, y'only get a "B". [I think this happens at 4:30]

#### Mission roster

- **x01 Satellite** \u2014 Default [Ally]
- **x04 Hydrofoil** \u2014 Default [Ally]
- **x01 Carrier** \u2014 Default
- **x06 Convoy** \u2014 Default [x2 Mission Update]
- **x01 MSSL** \u2014 Default [Ship-based]
- **x08 Gun** \u2014 Default [Ship-based]
- **x06 XFA-36A** \u2014 Default
- **x02 F-22C** \u2014 Default
- **x02 C-17B** \u2014 Mission Update
- **x04 Hydrofoil** \u2014 Mission Update

### 27. Plumber

- **Location:** White Valley
- **Guide code:** WK27

- **Difficulty:** 2/10
- **Recommended:** R-102 Delphinus #2 -or- Su-43 Berkut
- **Unlock:** R-103 Delphinus #3

General Resources' radar dishes have been intercepting state secrets with their powerful technology, so now it's time to "dish" out some punishment and burn 'em to the ground. The Berkut pulls its weight during this mission, and is recommended.

As said, their radar detects incoming aircraft if they're above 1300ft, so it's crucial to stay below that (a "D" is received for those not cleared to go above it). This stealthy approach applies only to the lead-up, however -- the terrane eventually steepens in preparation to the basin, at which time "cleared to engage" appears, which tells one there's no need to stick to radar cover any longer. The ground targets are conveniently located in a circle, and there will only be two planes to destroy.

> **Note:** If the enemy's radar is spiked, four F-22Cs also appear when the base is approached.

#### A-rank requirement / strategy

Defeat 14+ targets (8 mandatory). This is ridiculously easy and can be done just by removing the ground targets alone.

#### Mission roster

- **x01 Carrier** \u2014 Default [Ally]
- **x02 F-15S/MT** \u2014 Default
- **x08 Radarsite** \u2014 Default
- **x02 MSSL** \u2014 Default
- **x04 Gun** \u2014 Default
- **x04 F-22C** \u2014 Spawns only if radar is spiked

### 28. Pathfinder

- **Location:** Expo City
- **Guide code:** WK28

- **Difficulty:** 3/10
- **Recommended:** Su-43 Berkut -or- R-103 Delphinus #3
- **Unlock:** ---

Ouroboros has kidnapped the NUN chairman and UPEO has green-lighted the retrieval mission, which entails securing a path for the rescue crews. The Delphinus #3 is a good pick for this mission, as it has a good selection of missiles (normal, MIRV) and guns (normal, cannon, pulse).

Like usual, Expo City is cloaked in nightfall and filled with a wide array of ground targets; the kicker is the inclusion of ten tanks, which take a bit more effort to neutralize. Once approached, there'll be a gaggle of planes to sift through, but other than that, business as usual. If there's one annoying part to this mission, it's that the planes follow incessantly, so one often has to break away and try again, rather than aim for good shots in the middle of the pack.

#### Mission update

Once the chairman's rescued in the first half, the second half focuses on a retreat strategy, with the player at the helm, of course. There's a couple bases and a close-knit group of Su-43s as well, but nothing too hard. Make sure to destroy any targets harassing the R-201U escape vehicle, however.

#### A-rank requirement / strategy

Defeat 31+ targets (26 mandatory). Very easy, considering how many measly ground troops there are, as well as time not factoring into the completion time.

#### Mission roster

- **x01 R-201U** \u2014 Default
- **x06 Su-37** \u2014 Default [x2 Mission Update]
- **x14 Tank** \u2014 Default [x4 Mission Update]
- **x02 R-101U** \u2014 Default
- **x02 Base** \u2014 Mission Update
- **x06 Su-43** \u2014 Mission Update
- **x01 R-201U** \u2014 Mission Update [Ally]

### 29. Ouroboros

- **Location:** Port Edwards
- **Guide code:** WK29

- **Difficulty:** 4/10
- **Recommended:** Su-43 Berkut -or- R-103 Delphinus #3
- **Unlock:** XFA-36A Game

Port Edwards is under attack by Ouroboros' air force, so it's time to get in gear and neutralize. As y'can expect, this isn't a very inventive mission so just pack up the best plane y'got.

There are six XFA-35As to deal with first, and they're split into two groups. We've seen their song and dance before...nothing special, right? The same goes for the squadron of Su-37s, on the east side of the map. If y'didn't enjoy the annoying free-for-all of the previous mission, too bad -- it's a near repeat. [Although they're not as feisty as before, seemingly.] If the swarm gets too thick, fly away and reassess before jumpin' back in.

#### Mission update

When the initial force is toast, Ouroboros' aircraft carrier will be shown flying in the north. The UI-4053 has four escort fighters, but they're not the main concern (unless you're going for "A" rank) -- the target ship is the same kind seen in "Counterterrorism". It has permanent missile and AA gun fixtures and requires 16 missiles (x4 for each target) before it'll give up the ghost. Any plane that can fire four missiles at once is in luck, as the same strategy as back then applies here. [Also remember that higher trajectories will not work as the targets are on the blimp's underside.]

#### A-rank requirement / strategy

Defeat 18+ targets (11 mandatory). There are no ground targets here so one'll have to nuke 11+ of the 14 generic planes. Luckily the player isn't on the clock here, so destroy and dismantle in due time.

#### Mission roster

- **x06 XFA-35A** \u2014 Default
- **x10 Su-37** \u2014 Default
- **x01 UI-4053** \u2014 Mission Update
- **x02 R-103** \u2014 Mission Update
- **x02 Su-32** \u2014 Mission Update

### 30. Search and Destroy

- **Location:** Eusian Ocean
- **Guide code:** WK30

- **Difficulty:** 3/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** ---

Ouroboros' navy is apparently heading toward Megafloat in an attempt to take control, so now it's time to nip another problem in the bud. The new XFA-36A Game gets the best gun/missile selection and stats of any plane so far, and is the obvious pick for the mission.

The mission starts over Megafloat, already awash in overhead activity and a maritime military presence (although no land fortifications, as they were destroyed earlier).

#### Mission update

After the awesome Megafloat cutscene, the new target will be the UI-4053 that flies at 10,000ft over the southwestern island in the archipelago. As we've seen before, this tough puppy is equipped with permanent weapon emplacements and takes 16 missiles (x4/per target) to destroy. Any plane that can fire four missiles at once, and by now that should be all of 'em, can destroy it without too much trouble: flyby to destroy a target, loop-de-loop a ways away, and repeat. Remember that y'have to shoot at level or lower altitude to score the hits; higher hits simply hit the "overbelly" and do no damage. Aim for the soft, white underbelly!

#### A-rank requirement / strategy

Destroy 23+ targets (14 mandatory). Time is no factor here, and there's plenty of generic planes to deep-six, and they'll still be there during the mission update portion. Voila!

#### Mission roster

- **x08 XFA-36A** \u2014 Default
- **x03 S.Warship** \u2014 Default
- **x01 Carrier** \u2014 Default
- **x08 Gun** \u2014 Default
- **x01 MSSL** \u2014 Default
- **x01 UI-4053** \u2014 Mission Update
- **x06 R-103** \u2014 Mission Update
> **Note:** The end of this mission segues into the next without time to save!

### 31. Tunnel Vision

- **Location:** Geofront
- **Guide code:** WK31

- **Difficulty:** 5.5/10
- **Recommended:** Whatever was used in Mission #30 (mandatory)
- **Unlock:** ---

As said, this mission begins right after the previous is completed. During the downward spiral of Ouroboros' UI-4053, two unidentified crafts managed to escape into Geofront, a long underground tunnel system. Whatever plane was used in Mission #30 has to be done here as well, as there's no time to waste in pursuing.

Geofront is a tunnel network underground, so of course there's going to be some problems: (1) structural partitions that act as obstacles (2) simply being in a claustrophobic space (3) some doorways close when they're neared. Although some doors of the partitions shut on the highway immediately, the other one will close slowly -- so while it helps to go slow enough to change direction, y'can't go too slow or y'can't slip under the door. I suggest cruising at around 1800-2000MPH and about 1200ft. off the ground, which will allow one to casually yaw over the median strip.

> **Note:** All of the closing-door portions are randomized, including future ones.

Past the opening/shutting door area, the road bifurcates: left is straighter but with a crapton of obstacles, while the right is more curvy but generally easier. The former is a great "shorcut" if you're trying to get "A" rank, but if you're not, go the latter.

The third stretch entails doing another opening/shutting highway partition trap, although this time the road is a three-lane, so it gets tougher. Don't go as before and be prepared to enter the lane kittie-corner to the one just passed through, as it happens rather frequently. Also, the doors are faster than before, although not uncomfortably so.

Past there, the annoying route to the end continues: instead of highways, now the pilot has to display some prowess in flying in even smaller spaces, such as the green culverts/pipes now faced. The road bifurcates here again but rejoins a lot more frequently. Don't go faster than 1000MPH here and remember to yaw as opposed to hard turning. The cavernous other chambers can be traversed rather easily, luckily...just watch out for weird pillars blocking the way for no particular reason (who hired the worst architect ever?).

#### A-rank requirement / strategy

Get through in under 4:00. Although an agile player can probably sightread the mission, it's a good idea to play through the course until the last two green tunnels and retry, using that new knowledge to get through in an even better time. Also, at the first bifurcation, go through the left tunnel (the obstacle-filled one) to save time -- this allows one to reach the 1st path rejoin in under a 1:00.

#### Mission roster

- None

> **Note:** The end of this mission segues into the next without time to save!

### 32. Night Raven

- **Location:** Geofront
- **Guide code:** WK32

- **Difficulty:** 4/10
- **Recommended:** Whatever was used previous mission (Mandatory)
- **Unlock:** ---

One of the two planes that escaped Ouroboros' destroyed blimp has been ID'd as an X-49 Night Raven, and is the plane responsible for the senseless deaths witnessed a little while ago. Like before, the plane used in "Tunnel Vision" is the same one the player's using, as the pursuit's still ongoing.

First off, a note about Geofront. As we now see, it's not just a tunnel system but an underground city (this may be evident in the JP version but it hasn't be alluded to in the NTSC version)! Because of this, don't mistake the eerily brown overhead sky as cloud cover...it's actually a cement ceiling and spells doom for any pilot who doesn't realize it soon enough!

The X-49 is a super-agile plane capable of surprisingly sharp turns without deceleration, which makes it the most formidable foe yet -- although mostly when regards to achieving "A" rank. The city is mostly flat, but with the solid overhead, y'gotta remember to yaw downward (relative) when turning.

There are two opportune moments to attack this sucker: (1) firing at its 12 o'clock position -- when it's coming head-on -- while at level altitude and it's going faster than the player (2) firing at its 6 o'clock position while the player is going faster than it, and the missiles are fired from 500-600ft away. Doing this drastically minimizes the chance of evasion and should serve one well.

When enough missiles hit (maybe x8?), the player is told to stop firing as the foe is proving to be too difficult.

#### A-rank requirement / strategy

Finish mission in under 3:00 (approximately). Use the two maneuvers listed above in order to defeat it expediently.

#### Mission roster

- **x01 X-49** \u2014 Default
> **Note:** The end of this mission segues into the next without time to save!

### 33. Geofront Attack

- **Location:** Geofront
- **Guide code:** WK33

- **Difficulty:** 3/10
- **Recommended:** Whatever was used in previous mission (mandatory)
- **Unlock:** ---

With the X-49 being too dangerous a foe to hit normally, UPEO command has come up with a surprisingly vicious scorched earth policy: destroy Geofront's structural supports and destroy the plane in the ensuing collapse! Quite a mission to carry out but it's all we've got! [Same plane used in last mission will be used here.]

The structural supports, obviously, are holding up the ceiling. Lock-on can't be achieved for missiles but as we've seen throughout the game, missiles are still able to destroy them without targeting. [The command suggests using the aircraft's machine-guns.] The enemy X-49 will still be around, even if it's not pestering the player, so ignore it and focus on the pillars.

Laughably, the X-49 will fire its lasers but seems to have little skill in aiming -- even when right behind, they'll often be wide left/right. Haha...

#### A-rank requirement / strategy

Finish mission in under 4:00 (approximately). A player'll often have to cut it close, but it's rather doable. Just form a flightpath that cuts down on backtracking -- for instance, do the east side, work inward to SW corner, then do the two western. [Remember that when a pillar's destroyed there'll be support beam still in the rubble, so don't be going to fast that y'hit it.]

#### Mission roster

- **x10 Timer** \u2014 Default
- **x01 X-49** \u2014 Default
> **Note:** The end of this mission segues into the next without time to save!

### 34. Aurora

- **Location:** Port Edwards
- **Guide code:** WK34

- **Difficulty:** 7/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** ---

After the Geofront debacle, the other X-49 that escaped from Ouroboros' aerial warship is now flying over Port Edwards, so it's time to bury the hatchet... in the Night Raven's back! Ahaha... Despite the change in scenery, the same plane that has been used since Mission #30 (Search and Destroy) is still being employed.

Essentially, this mission is one big hullabaloo with the fast target being accompanied by some top-tier other enemies, who'll try to pester the player or (often annoyingly) change the lock-on. Be sure to aim from an advantageous position, as the X-49 will often put on afterburners -- which leave that sparkly stardust trail behind it -- in an effort to outmaneuver projectiles. Remember to break away from the pack and circle back, which should give one a better vantage of attack (nice rhyme, huh?). The X-49 will start smoking when it's heavily damaged, so use that to gauge your progress.

#### Mission update

Once the X-49 bites the dust, a single UI-4051 Aurora will be inbound from the north. Hopefully y'saved a bunch of missiles as this sucker is the most slippery of any enemy aircraft seen so far. This part will often take quite awhile and waste a lot of missiles, so don't fire four at once like before -- 90% of the time all will fail. In fact, count yourself lucky to even get one hit on this bad boy. [If you run out of missiles, restart the mission...there is pretty much no way to hit the target with guns, due to the high fluidity of its flightpath.]

There are very few situations where evasion is nearly impossible, but there are two, both at close proximity: (1) firing missiles at an oncoming plane at level altitude and with enough response time to fire, meaning slower than the target (2) the flipside, firing at the target's six o'clock. The first may actually be the best as it's easier to gauge when one's about to turn; this is the disadvantage of the latter strategy. Regardless, firing missiles when the target's 1000ft. or more away is just begging for the shot to miss, sorry.

There aren't too many excursions where a plane with 180+ missiles can run out entirely, but this is one of 'em.

#### A-rank requirement / strategy

Defeat 6+ targets (2 mandatory). Time limit isn't a factor and the generic planes aren't that tough, although they may take 3+ missiles to defeat. At least they stay around for the mission update.

#### Mission roster

- **x01 X-49** \u2014 Default
- **x02 R-103** \u2014 Default
- **x02 XFA-36A** \u2014 Default
- **x02 Su-43** \u2014 Default
- **x01 UI-4051 Aurora** \u2014 Mission Update
> **Note:** The end of this mission segues into the next without time to save!

### 35. Electrosphere

- **Location:** Eusian Ocean
- **Guide code:** WK35

- **Difficulty:** 7/10
- **Recommended:** Whatever was used in previous mission (mandatory)
- **Unlock:** ---

The final mandatory mission in the game takes place over Megafloat's new, uh, islands. The UI-4054 is the same target as before and there are no normal enemies to face -- it's mano e mano. Whatever plane was used before is still being ridden here, although ammo has been replenished (how? a wizard did it).

Okay, so the Aurora plane is the target. As told in the previous mission, with its highly capable maneuvering abilities, there are really only two ways to land hits, both of which entail no time for it to evade: (1) shoot at its 12 o'clock position, i.e. head-on, at a level altitude with it going faster than the player (2) fire at it's six o'clock position while coming up fast on it, which often lands at least one hit. In this case, the latter is the most frequent opportunity.

#### Mission update

The player will enter the Electrosphere after the first half, which turns the entire field of vision into how a machine would view 3D things: different planes of height, vectors, etc. Although it appears as though the player is within a tunnel, don't be fooled: there's plenty of room to move in. Just keep an eye on the altimeter as it's still possible to crash into the ground! This is a very disorienting part of the mission so rely on the upper-left minimap to get some bearings as following the "target pointer" on the screen is not that helpful (y'want to go perpendicular to it, oftentimes).

#### A-rank requirement / strategy

Finish in under 4:00, which requires 4-5 clean hits on the enemy.

#### Mission roster

- **x01 UI-4054 Aurora** \u2014 Default
This ends normal gameplay. After the credits is a save prompt, which will overwrite the currently-used level (although this won't impact much). This will unlock the mission simulator, which lets one play any previous level, with any plane (except where certain types are required, such as during the space/high-altitude missions). Y'can open the simulator by going to the Load file select screen and finding "simulator" all the way on the right.

> **Note:** If you got all A/Bs on the previous missions, Mission #36 plays instead of the ending, which will then follow that one.

### 36. Geopelia

- **Location:** Port Edwards
- **Guide code:** WK36

- **Difficulty:** 3/10
- **Recommended:** R-103 Delphinus #3 -or- XFA-36A Game
- **Unlock:** XR-900

> **Note:** This mission is only unlocked by getting "A" rank on all missions on any difficulty.

The final FINAL mission in the game is a special unlockable, as stated above. Neuwark's powerful unmanned fighting force, the Geopelias, are spotted over Port Edwards and should be shot down, while minimizing collateral damage. Any good plane will be helpful here.

The entire squadron will be inbound from the southeast part of the city, and they all have those "stardust afterburners" that make them highly agile. Once any single XR-900 is killed, there'll be a cutscene where the player controls a hacked XR-900. Using this, defeat its comrades!

This thing is so sly that no enemy should ever lay a finger on the player, and they don't even fight back -- I guess they haven't realized one of their own has gone haywire. This is great for back attack opportunities! Get about 600ft behind one and go at its speed, then unleash a full salvo and hopefully highly damage it. These types of planes take more than a couple to be killed, so every moment counts if you're trying for "A" rank. Use the laser beam for additional damage, too.

#### A-rank requirement / strategy

Finish in under 5:00. Quite easy if you prefer close-range (see above strat) or long-range (fire missiles from 2000ish feet away and hope most hit, which does happen more than the other maneuverable crafts). Y'usually finish with 0:30 to spare or so, if you're lucky.

#### Mission roster

- **x08 XR-900** \u2014 Default

## Appendices

### Planes

There are twenty-one (21) planes in the game, which can be unlocked either by completing a mission, completing one with an "A" rank, or by some special means. The player selects which aircraft to use in all missions, excepting a few high-altitude or outer space missions which require special planes (these are obtained mandatorily beforehand). As for the legend...

- **PLANE:** Type of plane
- **MSN:** Mission it's obtained in (* - Requires A-Rank; SPC is Special)
- **MS#:** Missile payload
- **Pw:** Power (affects acceleration/deceleration)
- **At:** Attack (affects attack range...maybe?)
- **Ar:** Armor (affects damage dampening; the higher the better)
- **St:** Stability (affects smoothness in turning, etc.)
- **Mo:** Mobility (affects maneuverability)
- **Gun Types:** Types of guns plane can carry (max 4)
- **Missile T:** Types of missiles plane can carry (max 4)
**Other notes:**

- Gun types are Vulcan, Heavy Machine Gun, Cannon, Neutron Beam, Pulse Laser, Laser Cannon
- Missile types are: Missile, Short-Range Missile, Ground Missile, M.I.R.V., Plasma Beam, Spread Bomb, Anti-Nanobite Bomb, O.S.L.

| ## | PLANE | MSN | MS# | Pw At Ar St Mo | Gun Types | Missile Types |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | EF2000E | Dft | 72 | 03 03 04 01 02 | Vul | Msl |
| 02 | MiG 33 | 01* | 80 | 04 04 03 02 04 | Vul | Msl |
| 03 | F/A-18U | 02* | 96 | 02 03 05 05 04 | Vul, HMG | SRM, GrM |
| 04 | F-16XFU | 04 | 80 | 03 03 03 04 04 | Vul, HMG | Msl |
| 05 | R-101 | 05* | 88 | 05 04 01 05 03 | HMG | Msl |
| 06 | R-201 | 06 | 104 | 01 05 08 08 01 | Can | SRM, GrM, MIRV |
| 07 | RF-12A2 | 11 | 160 | ** 03 07 03 01 | Vul, HMG | Msl, SRM, MIRV |
| 08 | F-15S/MT | 13 | 112 | 07 05 05 04 06 | Vul, Can | Msl, SRM, MIRV |
| 09 | F-16XA | 14* | 96 | 08 04 08 02 04 | Vul, HMG | GrM |
| 10 | R-352 | 15 | 100 | 02 02 10 05 09 | Neutron Beam | Plasma Beam |
| 11 | F-22C | 17 | 104 | 05 05 05 ** 05 | Vul, HMG | Msl |
| 12 | F/A-32C | 18* | 136 | 02 03 08 09 07 | Vul, Can | SRM, GrM |
| 13 | Su-37 | 22 | 120 | 07 07 05 06 06 | Vul, Can | Msl |
| 14 | R-102 | 23* | 128 | 07 08 05 05 07 | HMG, Pul | Msl |
| 15 | R-211 | 25 | 144 | 08 08 08 09 02 | Can, Pul | SRM, GrM |
| 16 | Su-43 | 25 | 152 | 07 09 08 05 ** | Vul, HMG, Can | Msl, MIRV |
| 17 | R-103 | 27* | 168 | ** 09 05 08 07 | HMG, Can, Pul | Msl, MIRV |
| 18 | XFA-36A | 29 | 184 | 08 ** 08 07 07 | Vul, HMG, Can | Msl, SRM, MIRV |
| 19 | UI-4054 | Spc | 176 | ** ** 08 07 09 | Vul, HMG, Can | SRM, GrM, MIRV |
| 20 | X-49 | Spc | 184 | ** 08 ** 03 ** | Las | SRM, GrM, MIRV |
| 21 | XR-900 | Spc | 192 | 10 09 10 03 10 | Las | SRM, GrM, MIRV |

> **Note:** All 'Spc', RF-12A2, and R-352 have "Spread Bomb" as 4th option

### Unlockables and cheats

> **Note:** Only special unlock methods are listed; see guide for normal aircraft.

| UNLOCKABLES | UNLOCK METHOD |
| --- | --- |
| Music Player | Beat game on Easy (only) difficulty |
| Mission Simulator | Beat game on Normal or Hard difficulty |
| O.S.L. Weapon | Beat game on Hard (only) difficulty |
| Japanese Intro | Beat game on Hard (only) difficulty |
| Mission #36 | Beat game with A/Bs on all missions (any difficulty) |
| UI-4054 Aurora | Get "A" rank on all missions (any difficulty) |
| X-49 Night Raven | Get "A" rank on all missions (Normal or Hard) |
| XR-900 Geopelia | Complete Mission #36 (Geopelia) in under 5:00 |

> **Note:** For Mission #36's unlock method, you can beat the game to unlock the mission simulator and clear things up that way. Then, when the game's beaten again, Mission #36 can be played after the thirty-fifth.

> **Note:** Mission Simulator, once unlocked, can be accessed by (1) going to the load screen and finding the option all the way on the right (2) beating the game, after which it automatically can be done. The former method is the more helpful, of course.

> **Note:** The Japanese Intro is shown at the main title screen, by holding L1 & R1 before hitting start.

On a separate note, for the mission simulator, there are some cheat inputs to change weapons. Basically, at the weapon selection screen, hold down Start + another button until gameplay begins. [This supersedes the weapons chosen a moment before, and only for appropriate slots. For instance, the Plasma Beam can't be in the machine-gun slot.]

- **Start + O:** Missiles (normal, not short-range)
- **Start + Square:** Spread Bombs
- **Start + Triangle:** O.S.L.
- **Start + X:** Plasma Beam

Some missions, such as Zero Gravity or those requiring particular weapons to complete, can't be changed by this method.

## Frequently asked questions

### Q: Hey, I heard there were anime scenes, split paths, etc.! What gives?

Those were in the superior JP version, which kept the plot interesting and had gameplay to match. Unfortunately, the NTSC (and PAL?) versions only retain the fabulous gameplay, while the plot becomes a shadowy organization ordeal, much like the first two AC games. It's unfortunate but that's how it is...

### Q: How do I beat the X-49 and/or UI-4054 Aurora?

They're quite dexterous so y'have to hedge your bets by narrowing the chance of them evading -- this means close-range. There are basically two good missile-dependant maneuvers to take: (1) fire salvo at target's 12 o'clock at level altitude, while they're going faster than self (2) fire salvo at target's six while oneself is faster than target and at a closing distance of about 500-600ft. Try to fire missiles at these puppies from 1000ft+ and they'll just evade it; gotta bring it the hurt home old-school, up-close and personal.

### Q: How do I get "A" on [mission]!? Urgh! *throws chair*

This happens to everyone -- for me, Blackbird was the most annoying "A" rank in the game. Once a game is beaten on Normal with all missions having A/B ranks, then the thirty-sixth mission (Geopelia) opens. If it's finished within 5:00, then the XR-900 Geopelia plane is unlocked for Mission Simulator use. This craft makes most missions a breeze, so if "Demilitarization" gave problems early on, this one decimates things in no time. Really, if you want to unlock everything but can't do it with your current arsenal, this is the way to go.

### Q: When I loaded up my save, I didn't have the mission simulator anymore!

Go to the Load file select screen and it should be on the right-hand side.

### Q: What's the O.S.L.?

The Orbital Satellite Laser, the most overpowered weapon in the game. When a lock-on is achieved and the missile button's pressed, the target automatically dies due to the satellite's precision attack. Nice!

### Q: What's those colored bars on the title screen?

They represent the missions beaten so far, and are colorized based on the ranking obtained (Red means "A," orange means "B" and so on). This is the _TRUE_ ranking, including the mission simulator; when a save is loaded, that represents just the current missions. Don't be thrown off by that!

## Updates and contributors

- **09-18-09:** Started walkthrough
- **10-17-09:** Finished walkthrough

### Thanks to

- Sailor/Ceej, for puttin' up my junk
- Armin Lukic, for the push-button cheats
- Rastislav Kov\xE1?, for Asterozoa unlock correction
- Dragoon of Infinity, for talkin' with me about the game
- Stepswordsman, for telling how to access the mission simulator
- The readers, 'cause I wuv youse guys! But keep yo' hands to yourself. ;)

## Legality

This document is intended for private home use ONLY, and may not be reproduced through electronic or commercial means without the expressed consent of the author (P. Summers). It cannot be hosted, edited, or distributed for profit, and may not be given away as an add-in/gift to bought items. All rights are reserved to respective parties, even those not explicitly stated herein. Those who find this document on sites not listed below should e-mail the author (me). Thanks for reading this, and thanks for respectin' FAQ authors.

### Hosting permissions listed by the author

**Allowed sites:** Gametalk.com; GameFAQs.com; MyCheats.com; Neoseeker.com; Gamesradar.com; Supercheats.com; Cheathappens.com; Honestgamers.com; Chaptercheats.com; Cavesofnarshe.com.

**Disallowed site:** cheatcc.com.

For permissions, the guide lists the author's obfuscated email as \`shotgunnova (a+) gmail (d0t) com\`.

- Document \xA9 Shotgunnova, 1997\u20132009 (and counting).

- Ace Combat namesake \xA9 respective owners.
`;
