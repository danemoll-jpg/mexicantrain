import { BotPersonalityId } from '../types.js';

export type CommentaryKey =
  | 'roundStart'
  | 'greatPlaySelf'
  | 'greatPlayOther'
  | 'wentOutSelf'
  | 'wentOutOther'
  | 'roundWonSelf'
  | 'roundWonOther'
  | 'matchWinSelf'
  | 'matchWinOther'
  | 'matchDraw';

export interface Personality {
  id: BotPersonalityId;
  displayName: string;
  avatar: string;
  tagline: string;
  lines: Record<CommentaryKey, string[]>;
  /**
   * Special-cased reactions, keyed by the lowercased name of the specific player being
   * addressed — lets a real person at the table get personalized treatment instead of the
   * generic "*Other" reaction (e.g. Ed calling his son "son", Carol going soft on her
   * granddaughter, or the two of them being visibly married to each other). Only ever
   * consulted for "*Other" keys (reacting to someone else) — there's no "Self" version of
   * addressing another named player. Falls back to `lines` when the current player at the
   * table doesn't match any override, so nothing changes for anyone else.
   */
  namedOverrides?: Partial<Record<string, Partial<Record<CommentaryKey, string[]>>>>;
}

export const PERSONALITIES: Record<BotPersonalityId, Personality> = {
  ed: {
    id: 'ed',
    displayName: 'Ed',
    avatar: '🚂',
    tagline: "Quiet, confident, doesn't say much — but when he does, it lands.",
    lines: {
      roundStart: [
        "Round {round}: double {engine}s. Let's see who's got it.",
        "Double {engine}s down. Every train starts here.",
        'New round. Double {engine}. Try not to overthink it.',
        'Round {round}. Deal \'em out.',
      ],
      greatPlaySelf: [
        "Didn't even have to think about that one.",
        'That double felt good going down.',
        'Every so often the boneyard agrees with me.',
      ],
      greatPlayOther: [
        "Nice double. Didn't expect that from you.",
        'Alright. Not bad.',
        'Huh. That was actually a smart lay.',
        'Okay, I saw that one.',
      ],
      wentOutSelf: [
        "Last tile. Train's empty. That's the round.",
        "And that's me — out.",
        'Quietly, that\'s how you finish a round.',
      ],
      wentOutOther: [
        "{player}'s out. Everybody else, count 'em up.",
        "And {player}'s empty-handed. Noted.",
      ],
      roundWonSelf: [
        "Low pips, my way. I'll take it.",
        "That's a round in my favor.",
        'Quietly, that was a good round for me.',
      ],
      roundWonOther: [
        'Round goes to {player}. Fine.',
        '{player} takes that one. Noted.',
      ],
      matchWinSelf: [
        "Thirteen rounds, lowest pips. That's the whole game, really.",
        "Guess I'll take the trophy nobody made.",
      ],
      matchWinOther: [
        '{player} wins it. You earned that one.',
        'Well played, {player}. Truly.',
      ],
      matchDraw: [
        'A tie. Somehow that feels about right.',
        'Dead even after thirteen rounds. Nobody blinked.',
      ],
    },
    namedOverrides: {
      // His wife. Quiet about most things — not about her.
      carol: {
        greatPlayOther: [
          "That's my wife. Still sharper than the rest of us.",
          "Careful, honey, you're making everyone else look bad.",
          "Atta girl. That's why I married her.",
          "There she goes again. Never bet against Carol.",
        ],
        wentOutOther: [
          "Empty-handed already, dear? Showing us all up, as usual.",
          "That's my wife for you — three trains ahead of everybody.",
        ],
        roundWonOther: [
          "That round's yours, love. Well played.",
          "Can't even be mad about that one. Nice round, honey.",
        ],
        matchWinOther: [
          "She beat me again. Wouldn't have it any other way.",
          "That's my wife. Never bet against her.",
        ],
      },
      // His son.
      dan: {
        greatPlayOther: [
          'Good play, son.',
          "That's my boy.",
          'Nicely done, son.',
          'Knew you had it in you, kid.',
        ],
        wentOutOther: [
          "That's my son — empty-handed and done. Look at you.",
          'Good hustle, son.',
        ],
        roundWonOther: [
          "Round's yours, son. Proud of you.",
          'Good round, son.',
        ],
        matchWinOther: [
          'You got me, son. Well played.',
          "That's my boy. Well earned.",
        ],
      },
    },
  },
  carol: {
    id: 'carol',
    displayName: 'Carol',
    avatar: '🚃',
    tagline: 'Loud, encouraging, your biggest fan — until you play too well, then watch out.',
    lines: {
      roundStart: [
        'Round {round}, baby, double {engine}s, let\'s GO!',
        'New round! Everybody check your trains, c\'mon!',
        'Alright, double {engine}s — who\'s feeling lucky?!',
        'Here we go, round {round}! I love this part!',
      ],
      greatPlaySelf: [
        'Ha! Told you I had that double!',
        "THAT'S how you lay a domino, folks!",
        "Ooh, I'm good. I'm really good.",
      ],
      greatPlayOther: [
        'You dirty dog, {player}!',
        'You absolute dirty dog!',
        'Ooooh, look at {player} dropping doubles!',
        'Okay {player}, okay! I SEE you.',
        "Well don't you think you're SOMETHING, {player}.",
        'Hold on now — {player} really had that lying in wait?!',
      ],
      wentOutSelf: [
        "Train's empty! Catch me if you can!",
        "That's a wrap for me — everybody else, hustle!",
      ],
      wentOutOther: [
        "{player}'s out — go go go, everybody!",
        "Ooh {player}'s empty! Last plays, let's move!",
      ],
      roundWonSelf: [
        "That round's MINE, thank you very much!",
        'Yes! Put it on the board!',
        "That's what I'm talking about!",
      ],
      roundWonOther: [
        'Fine, {player}, take your little round.',
        "Nice, {player}! ...okay, don't get used to it.",
        '{player} gets this one. Enjoy it while it lasts.',
      ],
      matchWinSelf: [
        "THIRTEEN rounds and I'm still standing! Let's GO!",
        "That's a win, that's a win, THAT'S A WIN!",
      ],
      matchWinOther: [
        'Ugh, fine, {player}. Good game. GOOD game.',
        "{player} wins! I'm happy for you. Mostly.",
      ],
      matchDraw: [
        'A tie?! After THIRTEEN rounds?! Unbelievable.',
        "We're tied. Rematch. Immediately.",
      ],
    },
    namedOverrides: {
      // Her husband. She'll needle a stranger — him she's just proud of.
      ed: {
        greatPlayOther: [
          "That's my husband, ladies and gentlemen!",
          'Ed! Look at you! I married a genius, apparently.',
          "There he is. There's my Ed.",
        ],
        wentOutOther: [
          'All out, honey? Look at my Ed go.',
          "That's my husband — quiet, but he gets it done.",
        ],
        roundWonOther: [
          "That round is all yours, honey. I love watching you play.",
          'Atta boy, Ed.',
        ],
        matchWinOther: [
          "Well, he beat me. I still love him anyway.",
          "That's my husband. I'll let him have this one.",
        ],
      },
      // Her granddaughter — no needling, ever. Just proud.
      juliana: {
        greatPlayOther: [
          "That's my girl!",
          'Look at you, sweetheart!',
          'Atta girl, Juliana!',
          'Grandma is SO proud right now.',
        ],
        wentOutOther: [
          'All out already, sweetheart? Show-off — in the best way.',
          "That's my girl, all finished up.",
        ],
        roundWonOther: [
          'That round is all yours, sweetheart.',
          "Yes! That's my girl!",
        ],
        matchWinOther: [
          "You beat your grandma fair and square. I couldn't be prouder.",
          "That's my girl. Best player at this table, no contest.",
        ],
      },
    },
  },
};
