import { rng, hash } from './math.js';

/** All characters and conversations are fictional, authored locally. No API, recording, or profiling. */
export const REGULARS = [
  { id: 'leena', name: 'Leena', line: 'Huomenta. A quieter morning today.', again: 'Morning again. Looks like we both made the same bus.' },
  { id: 'mika', name: 'Mika', line: 'Morning. Just going a couple of stops.', again: 'Hi again. The usual stop, please.' },
  { id: 'sara', name: 'Sara', line: 'Hi. I thought I had just missed you.', again: 'Hello again. Good to see this bus at the stop.' },
];

export function makePassenger(id, stopIndex, lastStop, seed = 0, kind = null) {
  const random = rng(hash(id) + seed), types = ['ordinary', 'ordinary', 'destination', 'contactless', 'slow', 'ordinary'];
  kind = kind || types[Math.floor(random() * types.length)];
  return {
    id, kind, destination: Math.min(lastStop, stopIndex + 1 + Math.floor(random() * Math.max(1, lastStop - stopIndex))),
    ticket: random() > 0.5 ? 'app' : 'card', coat: Math.floor(random() * 7), agePose: kind === 'slow', approved: kind === 'ordinary',
    boarded: false, asked: false, regular: kind === 'regular' ? REGULARS[Math.floor(random() * REGULARS.length)] : null,
  };
}

export function interactionFor(passenger, sim) {
  const stops = sim.world.stops, here = sim.stopIndex, dest = stops[passenger.destination], remaining = passenger.destination - here;
  const choice = (text, reply, action = 'approve', value = 1) => ({ text, reply, action, value });
  const common = { passengerId: passenger.id, kind: passenger.kind, speaker: 'Passenger', choices: [] };
  switch (passenger.kind) {
    case 'regular': {
      const reg = passenger.regular, seen = sim.memory[reg.id] || 0;
      return {
        ...common, speaker: `${reg.name} · ${seen ? 'returning regular' : 'regular rider'}`, text: seen ? reg.again : reg.line,
        choices: [choice(seen ? 'Morning. Nice to see you again.' : 'Huomenta. Good morning.', 'Thanks.'), choice('Give a friendly nod.', 'The rider nods back and shows a valid ticket.'), choice('A little quieter, yes. Take your time.', 'That is a nice change, isn’t it?')],
      };
    }
    case 'destination': return {
      ...common, text: `Sorry, does this bus stop at ${dest.name}?`, choices: [
        choice(`Yes. ${remaining === 1 ? 'It is the next stop.' : `It is ${remaining} stops from here.`}`, 'Thank you. I’m not used to this route.'),
        choice('You can follow the stops on the display. I will announce them.', 'All right, thanks.'),
        choice('I cannot help with that.', 'Oh. I’ll try to check the stop list.', 'approve', -3)],
    };
    case 'contactless': return {
      ...common, text: 'Can I pay with my bank card here, or do I need the app?', choices: [
        choice('You can use the reader. Select your zones, then tap your card.', 'Great, thank you.', 'approve'),
        choice('The reader accepts contactless. The app is another option.', 'I’ll use the reader, thanks.'),
        choice('You have to use the app.', 'I thought the reader accepted contactless.', 'retry', -4)],
    };
    case 'slow': return {
      ...common, text: 'Could you give me a moment to find a seat before you move?', choices: [
        choice('Of course. Take your time; I will wait.', 'Thank you. I’m nearly there.', 'wait'),
        choice('Yes. There is a priority seat just inside.', 'Thanks for waiting.', 'wait'),
        choice('Please hold on. We need to leave.', 'I need a moment to sit down.', 'retry', -5)],
    };
    case 'pram': return {
      ...common, text: 'Hi. Could you open the middle door for the pushchair?', choices: [
        choice('Of course. I will lower the bus and open the middle door.', 'Thank you. I’ll put the brake on once we’re in.', 'pram'),
        choice('I will make room. Please wait while I lower the bus.', 'Thanks. We can wait.', 'pram'),
        choice('Please bring it through the front door.', 'There isn’t enough room through here.', 'retry', -4)],
    };
    case 'wheelchair': return {
      ...common, text: 'Hello. Could you put the ramp out, please?', choices: [
        choice('Of course. I’ll secure the bus and prepare the middle door and ramp.', 'Thank you. Let me know when it is ready.', 'ramp'),
        choice('Certainly. Please wait until the ramp is fully down.', 'No problem.', 'ramp'),
        choice('It should be all right without the ramp.', 'I need the ramp to board safely.', 'retry', -7)],
    };
    case 'ticket': return {
      ...common, text: 'Sorry, my ticket is taking a moment to appear. The app was working outside.', choices: [
        choice('I can wait here while you bring up the valid ticket.', 'There it is. Thank you for waiting.', 'wait'),
        choice('Take a moment. Please show it before you move into the bus.', 'Thanks. Here you go.', 'wait'),
        choice('Never mind, just get on without it.', 'The ticket still needs to be checked.', 'retry', -5)],
    };
    case 'tourist': return {
      ...common, speaker: 'Visitor with a map', text: `Excuse me, is this the bus for ${dest.name}? We want to see the harbour, and we have a day ticket.`, choices: [
        choice(`Yes. ${remaining === 1 ? 'It is the next stop.' : `It is ${remaining} stops from here.`} The day ticket is valid on board.`, 'Wonderful, thank you. Kiitos!'),
        choice('Yes. Watch the display; I will announce the stop for you.', 'Thank you, we will listen for it.'),
        choice('Read the timetable at the stop.', 'Oh. Sorry, we only wanted to check.', 'approve', -3)],
    };
    case 'luggage': return {
      ...common, speaker: 'Passenger from the ferry', text: 'Hi. I have just come off the ferry and this suitcase is heavy. Could you lower the bus a little?', choices: [
        choice('Of course. I will lower the bus for you.', 'Thank you, that makes it much easier.', 'kneel'),
        choice('Sure. One moment while I kneel the bus; mind the step.', 'Thanks. I’ll wait for it.', 'kneel'),
        choice('You will have to lift it in.', 'It is too heavy to lift this high.', 'retry', -4)],
    };
    default: return { ...common, text: 'Hello.', choices: [choice('Hello.', 'Thank you.')] };
  }
}

export const AMBIENT = [
  { speaker: 'Two riders, a few rows back', lines: ['“Did you remember the library book?”', '“Yes. It’s in the other bag. I checked twice.”'] },
  { speaker: 'A quiet conversation nearby', lines: ['“The parcel is at the collection point, not at the door.”', '“All right. I can pick it up on the way home.”'] },
  { speaker: 'From the middle of the bus', lines: ['“We said half past, didn’t we?”', '“Yes. There’s no rush. They don’t open until then.”'] },
  { speaker: 'Two colleagues', lines: ['“Do we need to bring anything to the meeting?”', '“Just the notes. I sent you the corrected version.”'] },
  { speaker: 'A brief phone call', lines: ['“I’m on the bus now. I’ll call you when I get there.”', '“Yes, I’ve got the keys. See you in a bit.”'] },
  { speaker: 'Two friends', lines: ['“Was the exhibition worth going to?”', '“I liked the smaller room at the back. We can go another afternoon.”'] },
  { speaker: 'A rider by the window', lines: ['“I should have brought the lighter jacket.”', '“It was cooler when we left. Just put it on your bag.”'] },
  { speaker: 'Two riders near the rear door', lines: ['“Do you want me to save you a seat?”', '“No, thanks. I’m getting off soon.”'] },
  { speaker: 'A low conversation', lines: ['“The washing machine is booked for this evening.”', '“Good. I’ll be back before then.”'] },
  { speaker: 'Two friends, quietly', lines: ['“The recipe said twenty minutes. Mine needed thirty.”', '“Ours is like that too. I never trust the oven clock.”'] },
  { speaker: 'From the priority seats', lines: ['“Would you like this seat?”', '“Thank you. That would help.”'] },
  { speaker: 'A passenger on the phone', lines: ['“No, I can’t look at the document properly just now.”', '“I’ll send you a message when I’m there.”'] },
  { speaker: 'Two neighbours', lines: ['“Have they put the notice up downstairs?”', '“Yes, by the lift. It’s only for the morning.”'] },
  { speaker: 'A short exchange near the front', lines: ['“Is that your scarf?”', '“Oh, yes. Thank you for noticing.”'] },
  { speaker: 'Two riders looking out', lines: ['“Shall we walk the rest?”', '“Let’s get off at the next stop and see.”'] },
  { speaker: 'A quiet phone call', lines: ['“Could you leave it inside the door?”', '“Thanks. I’ll be home this afternoon.”'] },
  // Harbour-side conversations (any route).
  { speaker: 'Two riders by the window', lines: ['“Look, the Suomenlinna ferry is just leaving.”', '“We can take the next one. They run often in summer.”'] },
  { speaker: 'A visitor and a local', lines: ['“Is the market hall open on Sundays?”', '“Not this time of year. The square has stalls in the morning, though.”'] },
  { speaker: 'Two friends with shopping bags', lines: ['“Did you find the rye bread you wanted?”', '“The last loaf. I nearly gave up.”'] },
];
