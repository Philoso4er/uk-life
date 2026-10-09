// Peckwell's residents: who they are, what they moan about on Natter, and how
// they answer your DMs. Everything here is local to your device (clearly tagged NPC).
import { randomAvatar } from './avatar';
import type { Avatar, SaveState } from './types';
import { handleOf, type Author, type SocialStore } from './social';

export interface Persona {
  name: string;
  colour: string;
  bio: string;
  posts: string[];
  replies: string[];
  openers: string[];
  dm: string[];
}

export const PERSONAS: Persona[] = [
  {
    name: 'Big Tel', colour: '#c0392b', bio: 'Leaky Brolly regular since 1991. Can’t complain.',
    posts: ['Can’t complain 👍', 'Pint at the Brolly. Best seat in the house (next to the radiator).', 'Who keeps parking across my drive. I don’t have a drive. Still.', 'Quiz Tuesday. We need someone who knows geography. Kev thinks Wales is an island.', 'England will break my heart again this summer and I will let them.', 'Clive the pub dog has more friends than me and I respect it.'],
    replies: ['Can’t argue with that.', 'Spot on.', 'Pint says you’re right.', 'Back in my day this was all fields. Well, car parks.', 'Ha! Classic Peckwell.'],
    openers: ['Oi! Quiz Tuesday at the Brolly. You in? We need someone under 50.', 'You coming the Brolly later? Clive’s asking for you.', 'Alright? Can’t complain. Well. I could.'],
    dm: ['Ha. Good one.', 'Pint on me next time. Probably.', 'Can’t complain. (Proceeds to complain for 20 mins)', 'Right you are.', 'You’re alright, you are.'],
  },
  {
    name: 'Auntie Bev', colour: '#8e44ad', bio: 'Admin of the Peckwell Neighbourhood WhatsApp (412 members).',
    posts: ['WHO left their recycling out on a Tuesday. It is NOT bin day. Some of us have standards.', 'Lost: one grey cat. Answers to Biscuit. Does not answer to Biscuit.', 'Reminder: the church fete is Saturday. Tombola, cake stall, tension.', 'There is a man in a van on Albion Road. Just sitting. I have taken a photo.', 'Somebody’s Amazon parcel is on my step. I will be holding it hostage until 6pm.', 'The council have put a new bench in the park and frankly it’s too modern.'],
    replies: ['I have screenshotted this.', 'Well I never.', 'Bless you, love.', 'I’ll be raising this at the residents’ meeting.', 'Have you eaten? You look peaky.'],
    openers: ['Hello love, was that you who left the bins out? No judgement. Some judgement.', 'Hiya love! Are you coming to the church fete? Bring a cake. Not a shop one.', 'Just checking in. You looked a bit peaky by the Jobcentre.'],
    dm: ['Ooh, lovely.', 'Well I never! I’ll tell the group. (I won’t.) (I will.)', 'You’re a good one, you.', 'Bless. Make sure you wear a coat.', 'I’ve got a lasagne going spare if you want it.'],
  },
  {
    name: 'Tomasz', colour: '#16a085', bio: 'Builder. Van. Will be there “next Tuesday”.',
    posts: ['Quote for your kitchen: £4k. Quote after you said “just a quick job”: £6k.', 'Somebody wrote “clean me” on my van. Rude. Correct, but rude.', 'Started a loft conversion in 2021. Nearly done. Nearly.', 'Flat white? No. Builder’s tea. Two sugars. Like a professional.', 'Next Tuesday. I will be there next Tuesday. Which Tuesday? A Tuesday.'],
    replies: ['Can do. Next Tuesday.', 'Need a hand with that? I have a van.', 'Haha yes my friend.', 'That will be extra.', 'I know a guy.'],
    openers: ['Hi! You need any shelves putting up? I have a van and a free Tuesday.', 'Nigel still not fixed your damp? Classic Nigel.'],
    dm: ['No problem!', 'I’ll look at it next Tuesday.', 'Haha. True.', 'Cash is fine.', 'My friend, you need a better landlord.'],
  },
  {
    name: 'Priya', colour: '#e67e22', bio: 'Founder & CEO of Woof (Uber for dogs walking other dogs). Pre-revenue.',
    posts: ['Day 400 of building in public. Still building. Still in public.', 'Just pitched to investors at the Brolly. They were not investors. They were Big Tel.', 'Oat milk prices are a scandal and I will be launching a podcast about it.', 'Hot take: the 436 is a startup. Unreliable, beloved, losing money.', 'Hiring! Unpaid! Great exposure! (Equity: 0.001%)'],
    replies: ['Love this energy 🚀', 'This is a great use case.', 'Let’s circle back on this.', 'Can I quote you in my pitch deck?', 'Synergy.'],
    openers: ['Hey! Quick one. Would you use an app that walks your dog’s dog? Asking for a pitch.', 'Loved your Natter post. Want to be a brand ambassador? Unpaid but iconic.'],
    dm: ['Love that.', 'Let’s take this offline. (We are offline.)', 'Can I put you down as a beta tester?', 'Huge if true 🚀', 'Let’s grab a coffee at Prêt-à-Pricey. You’re paying, I’m pre-revenue.'],
  },
  {
    name: 'Gary & dog', colour: '#27ae60', bio: 'Gary. Dog is called Biscuit. Biscuit is the main character.',
    posts: ['Biscuit ate a whole sausage roll out of a man’s hand at the bus stop. I have apologised. Biscuit has not.', 'Biscuit has been barking at the same pigeon for 40 minutes. It’s personal now.', 'Rained on our walk. Biscuit loved it. I did not.', 'Biscuit met a fox. They looked at each other. Respect was exchanged.', 'Biscuit’s fan club (the school run mums) are out in force today.'],
    replies: ['Biscuit agrees.', 'Biscuit would like a word.', 'Ha! Love it.', 'Biscuit says woof.', 'Same, honestly.'],
    openers: ['Biscuit says hello. (He barked at your name. That means hello.)', 'You fancy a walk round the pond later? Biscuit needs to be seen by his public.'],
    dm: ['Biscuit says woof.', 'Ha! Classic.', 'Biscuit and I agree.', 'Off to the park, catch you later!', 'Biscuit just ate a tissue. Gotta go.'],
  },
  {
    name: 'Josh (Fleecems)', colour: '#7a1fa2', bio: 'Lettings negotiator. Everything is going fast.',
    posts: ['NEW IN: deceptively spacious studio. Deceptive is the key word.', 'Just let a cupboard to a lovely couple. Their dog doesn’t fit. Not our problem.', 'Viewings Saturday, 14 people already. Bring references, a deposit and a blood sample.', 'Rents are “reflecting the market”. I am the market.', 'Reminder: “cosy”, “characterful” and “compact” all mean small.'],
    replies: ['Great question! Going fast though.', 'Have you thought about Zone 6?', 'That’s actually very reasonable for the area.', 'We do have something coming up…', 'Can I take your number?'],
    openers: ['Hiya! Got a lovely studio coming up. It is technically a corridor. Interested?', 'Just checking in re your housing journey!! 🏡'],
    dm: ['Love that for you!', 'Going fast though.', 'I’ll check with the landlord. (He will say no.)', 'Can I call you? I’m calling you.', 'Sorry, back to back viewings!!'],
  },
  {
    name: 'Nan', colour: '#d35400', bio: 'Everyone’s Nan. Allotment queen. Knits through the news.',
    posts: ['Wear a coat. I’m not saying it again. (I will be saying it again.)', 'My marrow is bigger than Doris’s this year and she knows it.', 'Somebody showed me TikTok. I don’t like it. Showed me again. Still don’t.', 'Bingo tonight. Eyes down. Don’t talk to me.', 'In my day a pint was 30p and we still moaned about it.'],
    replies: ['Have you eaten, love?', 'Lovely. Wear a coat.', 'Ooh you are awful.', 'Back in my day we just got on with it.', 'I’ll knit you something.'],
    openers: ['Have you got a coat on? Your mum says you never wear a coat.', 'I’ve got far too many courgettes. Come and take some before Doris sees.', 'Are you eating properly love? You looked thin on the high street.'],
    dm: ['Lovely, dear.', 'Wear a coat.', 'Ooh, you are funny.', 'I’ll put the kettle on.', 'Bless your heart.'],
  },
  {
    name: 'Kev', colour: '#2980b9', bio: 'PureGrind member. Leg day is every day. Down 80% on crypto.',
    posts: ['Skipped leg day. Hate myself. Will skip it again.', 'Protein shake for breakfast, lunch and to cope.', 'If you’re not up at 5am to do ice baths are you even alive. (I slept till 11.)', 'Saw someone curling in the squat rack. Reported to the authorities (the guy at reception).', 'Crypto update: still HODLing. Still down. Still HODLing.'],
    replies: ['Get in!! 💪', 'Massive.', 'Absolute unit.', 'Bro.', 'Proper.'],
    openers: ['Gym later? I need a spotter and also a friend.', 'Bro. Leg day. Today. No excuses.'],
    dm: ['Bro 💪', 'Massive.', 'Let’s go!!', 'Say less.', 'Respect.'],
  },
  {
    name: 'Siobhan', colour: '#c2185b', bio: 'Nurse. Night shifts. Runs on tea and spite.',
    posts: ['Finished a 12-hour night. Went to Crumbs. They were out of vegan sausage rolls. I am not okay.', 'If you see a nurse at PFC at 8am, no you didn’t.', 'Night shift tip: the vending machine on floor 3 gives two KitKats if you thump it.', 'Rain on my day off. Rain on my shift. Rain in my dreams.', 'Tea. Then sleep. Then tea.'],
    replies: ['Love this ❤️', 'Honestly, same.', 'Drink some water lovely.', 'Ha! Needed that.', 'Get a coat on.'],
    openers: ['Hiya! Fancy a cuppa at Prêt-à-Pricey after my shift? I’ll be the zombie.', 'Did you see Nigel’s new rent rise? Absolute scenes.'],
    dm: ['Haha ❤️', 'So tired. So, so tired.', 'Agreed.', 'Gotta sleep, chat later x', 'You’re a star.'],
  },
  {
    name: 'Femi', colour: '#f39c12', bio: 'DJ, producer, part-time Bluetooth speaker repair man.',
    posts: ['New mix dropping Friday. Recorded it in my nan’s box room. Acoustics: elite.', 'Played a set at the Brolly. Big Tel requested Lionel Richie 4 times. I played it 4 times.', 'If anyone finds a USB stick with 400 versions of the same track, that’s mine.', 'Peckwell Carnival-ish committee meeting tonight. Sound system talks only.', 'Producing a track made entirely of 436 bus noises. Working title: “Not In Service”.'],
    replies: ['Big tune.', 'Vibes ✨', 'Say less.', 'This goes hard.', 'Sampling this.'],
    openers: ['Yo! Playing the Brolly Friday. Come through, bring people.', 'You got a good voice? I need someone to say “mind the gap” for a track.'],
    dm: ['Vibes.', 'Say less.', 'Big up.', 'Come to the set Friday!', 'Hard.'],
  },
  {
    name: 'Hamza', colour: '#00897b', bio: 'Final-year student. Dissertation due. Has not started.',
    posts: ['Dissertation due Friday. Word count: my name.', 'Overdraft update: I am now the overdraft.', 'Library is shut. Wrote 200 words on the steps with stolen Wi-Fi like a Victorian orphan.', 'Free samples at Prêt-à-Pricey today. This is my dinner.', 'Group project update: I am the group.'],
    replies: ['Lmao real', 'This is so real', 'Not me reading this in the library instead of working', 'Facts', 'Hahaha'],
    openers: ['Do you know anything about 18th-century economic history. Asking for my degree.', 'Lowkey do you want to be in my survey. It’s 40 questions. It’s for a grade.'],
    dm: ['Lmao', 'Real', 'Fair', 'Brb dissertation', 'Facts'],
  },
  {
    name: 'Posh Rupert', colour: '#34495e', bio: 'Moved to Peckwell “for the grit”. Owns three Barbours.',
    posts: ['Popped to Kwik Mart. No sourdough. Had to have a Warburtons. Character building.', 'The Leaky Brolly is wonderfully authentic. Someone called me “mate”.', 'Anyone know a reliable cleaner who doesn’t mind a Labrador?', 'My Range Rover won’t fit down Albion Road. I’ve written to the council.', 'Is it gauche to bring one’s own wine to a pub quiz? Asking for me.'],
    replies: ['Frightfully good.', 'Quite right.', 'How delightfully gritty.', 'I say!', 'Marvellous.'],
    openers: ['Hello! You seem very… local. Would you show me where people buy their meal deals?', 'I’m hosting a supper club. It’s a dinner party but I say supper club. Do come.'],
    dm: ['Marvellous.', 'Quite.', 'How gritty! I love it.', 'Splendid.', 'I’ll have my people call your people. I am my people.'],
  },
];

/** People who text you but don't wander the streets. */
export const CONTACTS: Record<string, { name: string; colour: string; bio: string }> = {
  mum: { name: 'Mum', colour: '#e84393', bio: 'Mum. Types with one finger. Signs off every message.' },
  dave: { name: 'Dave', colour: '#0984e3', bio: 'Your mate. Owner of the sofa. Owner of the cat (disputed).' },
};

const GENERIC = [
  'Is it me or has it rained every day since 2009',
  '£7.20 for a pint?? In THIS economy??',
  'Anyone know if the 436 is running or is it vibes only',
  'Just watched a fox eat a whole kebab. Respect.',
  'Crumbs & Co. out of vegan sausage rolls AGAIN',
  'My landlord put the rent up again lol. lmao even',
  'Signal failure at Albion Road. Standard.',
  'Lovely weather for ducks',
  'Who keeps putting trolleys in the pond',
  'Proper nippy out today innit',
  'Jobcentre just called number 14. I am number 412.',
  'Meal deal and a sit in the park. Living the dream.',
  'Viewing a "studio" later. It is a cupboard with a hob.',
  'Sorry. Sorry. No, sorry, my fault. Sorry.',
  'Did anyone else get the council tax letter or just me',
  'PFC wings at 2am hit different',
  'You alright? Yeah you? Yeah. Good. Good good.',
  'Fancy a cuppa? Course you do.',
  'Someone just said “cheers drive” to the 436 driver and he said “cheers” back. Wholesome.',
  'The man who folds the towel at the launderette smiled at me today. I feel chosen.',
  'Not to be dramatic but the Tube was warm today and I nearly cried.',
  'Hot take: the pigeons in Peckwell are the real locals.',
  'Small talk update: discussed the weather for 11 minutes at the bus stop. No conclusions.',
  'If you hear screaming on Albion Road it’s either a fox or me checking my bank balance.',
  'Kwik Mart now sells single onions AND phone chargers. Visionary.',
  'Unpopular opinion: the Leaky Brolly carpet is load-bearing.',
];

const CONTEXT: { when: (c: Ctx) => boolean; lines: string[] }[] = [
  { when: (c) => c.raining, lines: ['Absolutely chucking it down', 'Rain update: still raining', 'My socks have reached full saturation', 'Forgot my brolly. Character building.', 'It’s not even proper rain, it’s the fine stuff that soaks you through', 'Lovely day for it (it is not)'] },
  { when: (c) => !c.raining && c.hh >= 10 && c.hh < 17, lines: ['Sun’s out!! Barbecue time (it’s 12°C)', 'Saw the sun for 4 minutes. Peak British summer.', 'Dry for once. Nobody panic.'] },
  { when: (c) => c.hh >= 6 && c.hh < 10, lines: ['Queue at Crumbs already out the door', 'Anyone else’s 436 just not turn up', 'Coffee. Now. Please.', 'Morning commute: three trains cancelled, one emotional breakthrough'] },
  { when: (c) => c.hh >= 22 || c.hh < 4, lines: ['Who’s still up', 'PFC at this hour is a spiritual experience', 'Fox screaming outside sounds like a murder. It’s always a fox.', 'Can’t sleep. Thinking about that thing I said in 2014.'] },
  { when: (c) => c.dayIdx === 0, lines: ['Monday. Again.', 'Rent day. My bank account has left the chat.', 'Who invented Mondays. I just want to talk.'] },
  { when: (c) => c.dayIdx === 1 && c.hh >= 12, lines: ['QUIZ NIGHT at the Brolly tonight. £50 prize. Kev is banned from the music round.', 'Big Quiz tonight. Our team name is “Quiz Akabusi”. Accept no substitutes.'] },
  { when: (c) => c.dayIdx === 4, lines: ['FRIDAYYY. Leaky Brolly anyone?', 'Weekend starts NOW (I have work tomorrow)'] },
  { when: (c) => c.dayIdx >= 5, lines: ['Car boot sale was elite today. Got a lamp shaped like a duck.', 'Sunday roast at the Brolly, who’s in', 'Lie-in until 7:15. Decadent.'] },
  { when: (c) => !!c.flags.strike, lines: ['Tube strike. Walking to work. My calves have filed a complaint.', 'Rail replacement bus took 50 minutes to go 2 stops. I have aged.'] },
  { when: (c) => !!c.flags.heatwave, lines: ['IT’S 24 DEGREES. STAY INDOORS. DRINK WATER. CHECK ON NAN.', 'Heatwave. The Tube is now a sauna you pay £2.80 for.', 'Fans sold out at Kwik Mart. Using a Crumbs bag as a fan.'] },
];

/** Things NPCs say after seeing you do something. {me} = your name. */
const GOSSIP: Record<string, string[]> = {
  status: ['{me} has bought an air fryer or something and won’t shut up about it. Happy for them. Genuinely.', 'Saw a courier leave a parcel in {me}’s bin. Classic.', '{me} has “treated themselves”. We all know what that means. Klarna-ish.'],
  plot: ['{me} has got an allotment plot?! I’ve been on that waiting list since 2011.', 'Nan’s pulled strings for {me} at the allotments. Doris is FUMING.'],
  veg: ['{me} grew radishes and is acting like they invented farming.', 'Got given a home-grown spud by {me}. It was a spud. Nice spud though.'],
  marrow: ['{me} BEAT NAN at the Peckwell Show. Marrow class. Absolute scenes.', 'Massive upset at the marrow show. Nan has demanded a recount.'],
  landlord: ['{me} has bought a flat to rent out. Another one lost to the dark side.', 'Heard {me} is a landlord now. Nigel has a new friend.'],
  flogit: ['{me} is flipping charity shop finds on Flogit now. The bread maker economy is booming.', 'Bought a fondue set off {me} on Flogit. It was “smoke-free”. It was not.'],
  sausage: ['Just watched {me} eat a sausage roll in four bites. Respect.', 'The Crumbs queue is moving today. {me} was in and out like a pro.'],
  ducks: ['Someone fed the ducks peas, not bread. Finally. A hero walks among us.', '{me} at the pond feeding the ducks. Gerald the duck looked so happy.'],
  swanned: ['Just watched a swan chase {me} round the pond twice. 10/10 would watch again.', 'The swan is back on its nonsense. Stay safe out there.'],
  round: ['{me} just got a round in at the Brolly. A LEGEND. Big Tel is emotional.', 'Who got the round in? {me}. Write that down.'],
  quiz_win: ['{me}’s team won the quiz at the Brolly. Robbed. ROBBED. (Congrats.)', 'Quiz result: the newcomers won. Big Tel demanding a recount.'],
  quiz_lose: ['Quiz results are in: our lot came fourth again. {me} knew the music round answer and SAID NOTHING.'],
  gym: ['{me} posted a gym selfie. The lighting in PureGrind is unkind to us all.', 'Saw {me} at PureGrind. Leg day? Leg day.'],
  bookies_win: ['{me} won at LadBroke and now won’t stop talking about horses.'],
  bookies_lose: ['Heard someone at LadBroke lost on the last leg. Every time. Every single time.'],
  justone: ['{me} said “just the one” at 6pm. It is now 11. Classic.', '“Just the one” update: it was not just the one.'],
  five: ['Five-a-side by the bandstand today. {me} scored a worldie then pulled something.'],
  busk: ['Someone was busking “Wonderwall” again. Tez says it was a duet.', '{me} busking in the ticket hall. Honestly? Not bad.'],
  laundry: ['Ray from the launderette said {me} is “alright”. That’s his highest honour.'],
  trolley: ['SOMEONE GOT THE TROLLEY OUT OF THE POND. It’ll be back by Friday.'],
  nan: ['{me} has been helping Nan at the allotments. Doris is furious.'],
  passout: ['Saw someone asleep on the 436 at the end of the line. Been there.'],
  promo: ['Heard {me} got promoted! Drinks are on them (they don’t know this yet).'],
  strike: ['Tube strike. Walking. My trainers are not built for this.'],
  sofa: ['Dave says his sofa guest is “basically family now”. The cat disagrees.'],
};

/** What NPCs say back when you post. */
const REPLY_BY_KEYWORD: { re: RegExp; lines: string[] }[] = [
  { re: /rain|wet|weather|drizzle|cold|freez|nippy/i, lines: ['Lovely weather for ducks.', 'Wear a coat.', 'It’s that fine rain that soaks you.', 'Standard.', 'Britain innit.'] },
  { re: /rent|landlord|nigel|deposit|flat/i, lines: ['Nigel strikes again.', 'It’s “the market”, apparently.', 'My rent went up 4% for a new doormat.', 'Have you tried Zone 6? (Don’t.)'] },
  { re: /pint|pub|brolly|drink|beer/i, lines: ['Go on then. One. (It won’t be one.)', 'Brolly? I’m already here.', 'Mine’s a lager.', '£7.20 though.'] },
  { re: /tube|bus|436|train|strike/i, lines: ['Signal failure. Standard.', 'Three 436s came at once this morning.', 'Mind the gap.', 'Was better when it was the 36.'] },
  { re: /sausage|crumbs|greggs|roll|steak bake/i, lines: ['Sausage roll gang 🥐', 'Vegan ones are better. Fight me.', 'Out of the vegan ones again?'] },
  { re: /job|work|shift|boss|linda/i, lines: ['Linda strikes again.', 'Living the dream.', 'Monday’s coming.', 'Quick call? 5 mins? (50 mins)'] },
  { re: /hello|hi\b|hiya|alright|morning|evening/i, lines: ['Alright! You good? Yeah? Good good.', 'Hiya!', 'Alright mate.', 'Morning! (It’s whenever.)'] },
];
const GENERIC_REPLIES = ['Facts.', 'This is the most Peckwell thing I’ve ever read.', 'Big if true.', 'Who asked? (Me. I asked. Go on.)', 'Ha! Love this.', 'Couldn’t have said it better.', 'Mood.', 'Peckwell stays winning.', 'Can’t complain.', 'Not wrong.'];

/** Big Tel's running gag: "can't complain", followed by twenty minutes of complaining. */
const COMPLAINTS = ['Well. The 436 was late again.', 'And my knee’s gone.', 'And they’ve changed the crisps at the Brolly.', 'And Nigel’s put the rent up on my mate.', 'And it’s raining. Obviously.', 'And they’ve shut the good toilets at the station.', 'And a pigeon took my chips.', 'But apart from that, can’t complain.'];

const DM_KEYWORDS: { re: RegExp; lines: string[] }[] = [
  { re: /pint|pub|brolly|drink/i, lines: ['Go on then, one. (It won’t be one.)', 'Brolly at 7?', 'You buying? 😂'] },
  { re: /rent|landlord|nigel/i, lines: ['Don’t get me started on landlords.', 'Nigel is a menace.', 'It’s the market, apparently 🙄'] },
  { re: /love|date|fancy you|marry|kiss/i, lines: ['Steady on, I’ve only known you since Tuesday 😂', 'Ha! Buy me a sausage roll first.', 'Bless you. No.'] },
  { re: /\?\s*$/, lines: ['Couldn’t tell you, mate.', 'Good question. No idea.', 'Ask Auntie Bev, she knows everything.', 'Depends. On what? Also depends.'] },
  { re: /^(hi|hey|hiya|alright|yo|oi|hello|morning)\b/i, lines: ['Alright! You good? Yeah? Good good.', 'Hiya! 👋', 'Alright!'] },
  { re: /thank|cheers|ta\b/i, lines: ['No worries!', 'Cheers!', 'Any time.'] },
];
const READ_AND_IGNORED = ['Sorry was on the bus', 'Sorry just seen this', 'Sorry, phone died. Charger is at Dave’s.'];

const MUM_LINES = ['Did you eat today. Mum x', 'Ring your Nan. Mum x', 'Are you wearing a coat. It said rain on the BBC. Mum x', 'Saw this and thought of you: [picture of a dog in a hat]. Mum x', 'Your cousin got a promotion. Just saying. Mum x', 'Are you coming home for Sunday dinner or are you too London now. Mum x'];
const MUM_REPLIES = ['OK love. Mum x', 'Wear a coat. Mum x', 'Ring me later. Mum x', 'Lovely. Your dad says hello (he didn’t, he’s watching the snooker). Mum x', '👍 (Your sister showed me the thumbs up) Mum x'];
const DAVE_LINES = ['The cat’s been sleeping in your spot again', 'Did you take my phone charger', 'Fancy a takeaway later? You’re paying though', 'Mate. The milk.'];
const DAVE_REPLIES = ['Ha nice', 'Sound', 'Lol', 'Mate.', 'You owe me a milk'];

interface Ctx {
  raining: boolean;
  hh: number;
  dayIdx: number;
  flags: Record<string, unknown>;
}
export const pickOf = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function personaAuthor(p: Persona, avatar?: Avatar): Author {
  return { id: 'npc:' + p.name.replace(/[^\w]/g, '').toLowerCase(), name: p.name, handle: handleOf(p.name), kind: 'npc', colour: p.colour, avatar };
}
export function contactAuthor(key: keyof typeof CONTACTS | string): Author {
  const c = CONTACTS[key] ?? { name: key, colour: '#636e72' };
  return { id: 'sys:' + key.replace(/[^\w]/g, '').toLowerCase(), name: c.name, handle: handleOf(c.name), kind: 'system', colour: c.colour };
}
/** For landlords, the bank and other one-off senders. */
export function systemAuthor(name: string): Author {
  const known = Object.entries(CONTACTS).find(([, c]) => c.name === name);
  if (known) return contactAuthor(known[0]);
  return { id: 'sys:' + name.replace(/[^\w]/g, '').toLowerCase().slice(0, 30), name, handle: handleOf(name), kind: 'system', colour: '#636e72' };
}

/** Drives NPC posts, likes, replies and DMs. Lives in the engine; ticks with the game. */
export class NpcBrain {
  private nextPost = Date.now() + rnd(5000, 9000);
  private nextDM = Date.now() + rnd(45000, 75000);
  private dmsSent = 0;
  private recent: string[] = [];
  private gossipQ: string[] = [];
  private avatars = new Map<string, Avatar>();
  /** called when an NPC posts, so the engine can pop a speech bubble over them */
  onSpeak: ((name: string, text: string) => void) | null = null;

  constructor(private social: SocialStore, private save: SaveState) {
    social.onMyPost = (p) => this.reactToMyPost(p.id, p.text);
    social.onMyDM = (peer, text) => this.replyToDM(peer, text);
  }
  private avatarFor(name: string) {
    let a = this.avatars.get(name);
    if (!a) {
      a = randomAvatar();
      this.avatars.set(name, a);
    }
    return a;
  }
  setAvatar(name: string, a: Avatar) {
    this.avatars.set(name, a);
  }
  author(p: Persona) {
    return personaAuthor(p, this.avatarFor(p.name));
  }

  /** Fill an empty feed with a believable last hour of Peckwell. */
  seed(ctx: Ctx) {
    if (this.social.getSnapshot().posts.length >= 6) return;
    const t = Date.now();
    for (let i = 0; i < 9; i++) {
      const p = pickOf(PERSONAS);
      const text = this.compose(p, ctx);
      this.social.npcPost(this.author(p), text, { ts: t - (i + 1) * rnd(3, 9) * 60000, likes: Math.floor(rnd(0, 14)) });
    }
    // the welcome thread
    const bev = PERSONAS.find((p) => p.name === 'Auntie Bev')!;
    this.social.incoming(this.author(bev), `Hello love! Welcome to Peckwell. I run the neighbourhood WhatsApp (412 members). Bins are Thursdays. Don’t feed the swan. x`, {}, false);
  }

  gossip(key: string) {
    if (GOSSIP[key] && Math.random() < 0.75) this.gossipQ.push(key);
  }

  private compose(p: Persona, ctx: Ctx): string {
    const ctxLines = CONTEXT.filter((c) => c.when(ctx)).flatMap((c) => c.lines);
    for (let tries = 0; tries < 6; tries++) {
      const r = Math.random();
      const text = ctxLines.length && r < 0.3 ? pickOf(ctxLines) : r < 0.72 ? pickOf(p.posts) : pickOf(GENERIC);
      if (!this.recent.includes(text)) {
        this.recent = [...this.recent.slice(-40), text];
        return text;
      }
    }
    return pickOf(p.posts);
  }

  tick(ctx: Ctx) {
    const t = Date.now();
    if (t >= this.nextPost) {
      this.nextPost = t + rnd(18000, 38000);
      let p = pickOf(PERSONAS);
      let text: string;
      if (this.gossipQ.length) {
        const key = this.gossipQ.shift()!;
        text = pickOf(GOSSIP[key]).replace('{me}', this.save.name);
      } else text = this.compose(p, ctx);
      if (/can.t complain/i.test(text)) p = PERSONAS[0];
      const post = this.social.npcPost(this.author(p), text, { likes: Math.floor(rnd(0, 4)) });
      this.onSpeak?.(p.name, text);
      // likes trickle in
      for (let i = 0; i < 3; i++) this.social.later(rnd(4000, 40000), () => this.social.bumpLikes(post.id, Math.random() < 0.6 ? 1 : 2));
      // Big Tel can't complain. Then complains.
      if (/can.t complain/i.test(text)) this.complain(post.id);
    }
    if (t >= this.nextDM && this.dmsSent < 5) {
      this.nextDM = t + rnd(150000, 300000);
      this.dmsSent++;
      const r = Math.random();
      if (r < 0.18) this.social.incoming(contactAuthor('mum'), pickOf(MUM_LINES));
      else if (r < 0.28 && this.save.home !== 'sofa') this.social.incoming(contactAuthor('dave'), pickOf(DAVE_LINES));
      else {
        const p = pickOf(PERSONAS);
        this.social.incoming(this.author(p), pickOf(p.openers));
      }
    }
  }

  /** Big Tel replies to his own "can't complain" with everything he's got to complain about. */
  complain(postId: string) {
    const n = 3 + Math.floor(Math.random() * 3);
    const lines = [...COMPLAINTS.slice(0, -1)].sort(() => Math.random() - 0.5).slice(0, n - 1).concat(COMPLAINTS.at(-1)!);
    let at = 0;
    lines.forEach((line) => {
      at += rnd(9000, 16000);
      this.social.later(at, () => this.social.npcPost(this.author(PERSONAS[0]), line, { replyTo: postId }));
    });
  }

  private reactToMyPost(postId: string, text: string) {
    const n = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.social.later(rnd(3000, 25000), () => this.social.bumpLikes(postId));
    if (Math.random() < 0.75) {
      const p = pickOf(PERSONAS);
      const kw = REPLY_BY_KEYWORD.find((k) => k.re.test(text));
      const line = kw && Math.random() < 0.7 ? pickOf(kw.lines) : Math.random() < 0.5 ? pickOf(p.replies) : pickOf(GENERIC_REPLIES);
      this.social.later(rnd(6000, 16000), () => this.social.npcPost(this.author(p), line, { replyTo: postId }));
      if (Math.random() < 0.35) {
        const q = pickOf(PERSONAS.filter((x) => x !== p));
        this.social.later(rnd(18000, 34000), () => this.social.npcPost(this.author(q), pickOf(q.replies), { replyTo: postId }));
      }
    }
  }

  private replyToDM(peerId: string, text: string) {
    const author = this.social.author(peerId);
    if (author.kind === 'player' || author.kind === 'me') return;
    const typing = rnd(1800, 4500);
    let line: string;
    if (author.id === 'sys:mum') line = pickOf(MUM_REPLIES);
    else if (author.id === 'sys:dave') line = pickOf(DAVE_REPLIES);
    else if (author.kind === 'system') return; // landlords and banks don't do replies. Obviously.
    else {
      const p = PERSONAS.find((x) => this.author(x).id === peerId);
      if (!p) return;
      if (Math.random() < 0.12) {
        // left on read... then the excuse
        this.social.later(rnd(20000, 40000), () => this.social.incoming(author, pickOf(READ_AND_IGNORED)));
        return;
      }
      const kw = DM_KEYWORDS.find((k) => k.re.test(text));
      line = kw && Math.random() < 0.75 ? pickOf(kw.lines) : pickOf(p.dm);
    }
    this.social.later(800, () => this.social.setTyping(peerId, typing + 400));
    this.social.later(800 + typing, () => this.social.incoming(author, line));
  }
}
