import 'dotenv/config';
import {
  ActionRowBuilder,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

const {
  DISCORD_TOKEN,
  GUILD_ID,
  TICKET_CATEGORY_ID = '1483833391378862224',
  SUPPORT_ROLE_ID,
  TICKET_CHANNEL_PREFIX = 'ticket-',
  AUTO_REPLY_COOLDOWN_SEC = '300',
  AI_ENABLED = 'false',
  OPENAI_API_KEY = '',
  OPENAI_MODEL = 'gpt-4.1-mini',
  SCORE_PORTAL_URL = 'https://portal.soneium.org/en/profile/YOUR_WALLET_ADDRESS',
  ROLE_TAG_ESCALATION_MENTIONS = '@Alicia @Ramz @Jerad',
  DEBUG_AUTOREPLY = 'false',
  SUPPORT_STAFF_IDS = '',
  MINI_APP_EL_HEXA_ROLE_ID = '1483709405806727293',
  MINI_APP_MORNING_MOON_POCKET_ROLE_ID = '1483717804757614622',
  MINI_APP_MORNING_FARM_ROLE_ID = '1483718067870498837',
  MINI_APP_PACKFLIP_ROLE_ID = '1483849283714420857',
  MINI_APP_PNYX_ROLE_ID = '1483849398986346557',
  MINI_APP_AWAKENING_ROLE_ID = '1483849538165936209',
  MINI_APP_POCKET_KNIGHTS_ROLE_ID = '1483849639525486714',
  MINI_APP_WORLD_OF_TRINITY_ROLE_ID = '1483849828575350936',
  MINI_APP_DICE_OR_DIE_ROLE_ID = '1483849911735943329',
  MINI_APP_HEROES_ROLE_ID = '1483849970137305312',
  MINI_APP_CLASH_HORSE_ROLE_ID = '1483850079331946697',
  MINI_APP_NEKOCAT_ROLE_ID = '1483850186747805927',
  MINI_APP_BURROW_BASH_ROLE_ID = '1483850354591400067'
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN 이 설정되지 않았습니다.');
  process.exit(1);
}

const tokenTrimmed = DISCORD_TOKEN.trim();
if (
  !tokenTrimmed ||
  /여기에|토큰/i.test(tokenTrimmed) ||
  tokenTrimmed.length < 50
) {
  console.error('DISCORD_TOKEN 이 예시값이거나 잘못된 값입니다. .env 파일의 DISCORD_TOKEN을 실제 봇 토큰으로 바꿔주세요.');
  process.exit(1);
}

const cooldownMs = Number(AUTO_REPLY_COOLDOWN_SEC) * 1000;
const aiEnabled = AI_ENABLED.toLowerCase() === 'true';
const debugAutoReply = DEBUG_AUTOREPLY.toLowerCase() === 'true';

const TICKET_KEEPALIVE_MESSAGE = 'Hey there, we are still actively resolving this ticket. Messaging here to ensure the ticket remains visable to you and the team. Thank you.';
const TICKET_INACTIVITY_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours
const TICKET_KEEPALIVE_CHECK_INTERVAL_MS = 60 * 60 * 1000;  // check every hour
const hasUsableOpenAIKey = OPENAI_API_KEY && !/여기에|token|key|토큰/i.test(OPENAI_API_KEY) && OPENAI_API_KEY.length > 20;
let aiKeyWarningShown = false;
const lastReplyByChannelUser = new Map();
const DELETE_AUTO_REPLY_COMMAND_NAME = 'deletebotreply';
const FAQ_COMMAND_NAME = 'faq';
const FAQ_SELECT_MENU_ID = 'faq_select';
const FAQ_ITEMS = [
  {
    id: 'faq_1',
    question: 'How can I earn STAR Points?',
    answer: 'You can earn STAR Points by providing liquidity and by reaching 10 daily GMs.'
  },
  {
    id: 'faq_2',
    question: 'How many STAR Points can I earn for providing liquidity?',
    answer: 'You earn 1 STAR Point per day for every $100 worth of liquidity provided.'
  },
  {
    id: 'faq_3',
    question: 'What is the minimum liquidity required to earn STAR Points?',
    answer: 'The minimum required is $50, which earns 0.5 STAR Points per day.'
  },
  {
    id: 'faq_4',
    question: 'What happens if I remove liquidity before 30 days?',
    answer: 'Liquidity withdrawn before 30 days does not earn any STAR Points.'
  },
  {
    id: 'faq_5',
    question: 'Is there a difference between the Earn Vault and providing liquidity?',
    answer: 'Yes.\n• **Earn Vault** deposits earn an APY paid in USDC.\n• **Providing liquidity** (minimum $50) earns STAR Points.'
  },
  {
    id: 'faq_6',
    question: 'How does APY work in the Earn Vault?',
    answer: 'APY is dynamic. As more users deposit into the Earn Vault, the APY decreases; as participation declines, the APY increases.'
  },
  {
    id: 'faq_7',
    question: 'When do STAR Points appear on my profile?',
    answer: 'STAR Points appear after 30 days from the point you provided a minimum of $50 worth in liquidity.'
  },
  {
    id: 'faq_8',
    question: 'What if the Startale USD price fluctuates after I deposit?',
    answer: 'STAR Points are calculated based on the USD value at the time of deposit. Minor price fluctuations after deposit do not reduce earned points.'
  },
  {
    id: 'faq_9',
    question: 'How are STAR Points calculated for multiple deposits?',
    answer: 'Each deposit is tracked independently.\n• A $50 deposit on January 1 earns 0.5 STAR Points after 30 days.\n• A $100 deposit on January 5 earns 1 STAR Point after its own 30-day period.'
  },
  {
    id: 'faq_10',
    question: 'Can I choose which liquidity position to withdraw?',
    answer: 'No. Withdrawals follow a Last-In, First-Out (LIFO) method. This helps preserve older positions that may carry higher multipliers.'
  },
  {
    id: 'faq_11',
    question: 'Are transactions before the monthly mission counted retroactively?',
    answer: 'No. Transactions are not retroactively applied in order to ensure fairness for all participants.\n\nFor more information, please refer to the Startale USDSC FAQ.'
  }
];
const AUTO_REPLY_EXCLUDED_USER_IDS = new Set(
  SUPPORT_STAFF_IDS
    ? SUPPORT_STAFF_IDS.split(',').map(id => id.trim()).filter(Boolean)
    : []
);
const MANUAL_HANDOFF_CHANNEL_IDS = new Set();
const MINI_APP_MENU_SENT_IDS = new Set();
const SUPPORT_TEST_PREFIX = '!test ';
const FIXING_GREETING = 'Hello, thank you for the report!';
const GENERAL_FIXING_VARIANTS = [
  'Our team is aware of this and is actively working on a fix right now. Thank you for your patience while we resolve it. 🙏',
  'Thank you for reporting this. Our developers are already working to fix it as quickly as possible, and we will keep you updated.',
  'We understand this is frustrating, and we truly appreciate your patience. The team is actively working on a resolution now. 🙏'
];
const GM_FIXING_VARIANTS = [
  "We've just rolled out a test deployment and are currently testing with a small group. The fix is coming very soon — please hang tight just a little longer! 🙏",
  "A test build is now live and we're validating it with a small group. It'll be fully fixed very soon — thank you for your patience just a bit longer! 🙏",
  "We've deployed a test fix and are actively testing it with a small group right now. It should be resolved very soon — just a little more patience, thank you! 🙏"
];
const WALLET_FIXING_VARIANTS = [
  'Our team is aware of the wallet connection issue and is actively working on a fix. Thank you for your patience while we resolve this. 🙏',
  'Thanks for reporting the wallet connection problem. The developers are currently working on it, and we will keep you updated.',
  'We understand the wallet connection issue is blocking your access. Our team is working on it now and will share updates as soon as possible.'
];
const MIGRATION_FIXING_VARIANTS = [
  'Our team is aware of the migration/account upgrade issue and is actively working on a fix. Thank you for your patience while we resolve this. 🙏',
  'Thank you for reporting this. Our developers are currently working on the migration issue and we will keep you updated. 🙏',
  'We understand the migration issue is blocking your access. Our team is working on it now and will share updates as soon as possible. 🙏'
];
const AA_MIGRATION_RESOLVED_VARIANTS = [
  'Our team is aware of the AA/smart wallet migration issue and is actively working on a fix. Please share your wallet address and screenshots so we can assist you further. 🙏',
  'Thank you for reporting this. The AA/smart wallet migration issue is currently being investigated by our team. We appreciate your patience. 🙏'
];
const EOA_SIGNING_FIXING_VARIANTS = [
  'Thank you for reporting this. We are still working on the EOA signing issue, and another fix will be deployed soon. We appreciate your patience. 🙏',
  'We have identified the EOA signing problem and the team is preparing the next fix deployment. Thank you for waiting with us. 🙏',
  'The EOA signing issue is not fully resolved yet, but a follow-up fix is coming soon. We will keep you updated. 🙏'
];
const BRIDGE_FIXING_VARIANTS = [
  'Our team is aware of the bridge transaction issue and is actively working on a fix. Thank you for your patience. 🙏',
  'Thanks for reporting this bridge-related problem. The developers are currently working on it, and we will update you as soon as possible.',
  'We understand this bridge issue is affecting your progress. The team is actively fixing it now. Thank you for waiting. 🙏'
];
const SWAP_FIXING_VARIANTS = [
  'Our team is aware of the swap/LP issue and is actively working on a fix. Thank you for your patience. 🙏',
  'Thanks for reporting this swap-related problem. The developers are currently working on it, and we will update you as soon as possible.',
  'We understand this swap issue is affecting your progress. The team is actively fixing it now. Thank you for waiting. 🙏'
];
const EARN_VAULT_FIXING_VARIANTS = [
  'Our team is aware of the Earn Vault/deposit issue and is actively working on a fix. Thank you for your patience. 🙏',
  'Thanks for reporting the Earn Vault problem. The developers are currently working on it, and we will update you as soon as possible.',
  'We understand the Earn Vault deposit issue is affecting your progress. The team is actively fixing it now. Thank you for waiting. 🙏'
];
const DISCORD_ROLE_REPLY =
  'The role bot may be temporarily delayed when traffic is high. Please give it a little more time, and it should update soon.';
const STILL_FIXING_VARIANTS = [
  'We are still working on the fix and making steady progress. Thank you for your patience, and we will notify you as soon as it is resolved. 🙏',
  'The team is continuing to work on this issue right now. We appreciate your patience and will share an update as soon as we have one. 🙏',
  'We are working hard on a fix right now and expect to resolve it soon. Thank you for your patience, and we will let you know as soon as it is fixed. 🙏',
  'We are still fixing this and doing our best to resolve it quickly. Thank you for your patience, and we will let you know as soon as it is fixed. 🙏',
  'We sincerely apologize for the delay. The issue is still under active investigation and fixing. We will keep you posted with updates.'
];
const SAKE_FINANCE_REPLY =
  'Sake Finance validation is now based on the total aggregated eligible transactions.\nIf your total is over $20, the task should be recognized.\n\nIf it is still not reflected, please share your wallet address and tx hash. 🙏';
const STAR_POINT_LNY_REPLY =
  'Our team is aware of the issue in the Startale App STAR Point mission campaign and is actively working on a fix now. The update should be reflected soon.\n\nFor this campaign, mission validation is based on eligible onchain transactions, and rewards/checkmarks may take some time to update.\n\nAlso, based on strong user demand, the campaign has been extended until March 6.\nSo there is no need to worry, and thank you for your patience. 🙏';
const STAR_POINT_LNY_PROCESSING_REPLY =
  'If your task status is showing Processing, your STAR Points and Fortune Wheel ticket should be added automatically soon.\nThere is no issue on your side, so please wait a little longer.\n\nThank you for your patience. 🙏';
const FORGOT_PASSWORD_REPLY =
  'Because smart wallet accounts are decentralized, Startale cannot access your wallet or reset your password. In this case, the only available option is to sign up again with a new account.';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

function isTicketChannel(channel) {
  if (!channel) return false;

  // Ticket channels created as normal text channels
  if (channel.type === ChannelType.GuildText) {
    if (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID) return true;
    return channel.name.startsWith(TICKET_CHANNEL_PREFIX);
  }

  // Ticket systems that create threads instead of channels
  if (channel.isThread()) {
    const parent = channel.parent;
    if (!parent) return false;

    if (TICKET_CATEGORY_ID) {
      if (channel.parentId === TICKET_CATEGORY_ID) return true;
      if (parent.parentId === TICKET_CATEGORY_ID) return true;
    }

    const prefixMatched = (
      channel.name.startsWith(TICKET_CHANNEL_PREFIX) ||
      parent.name.startsWith(TICKET_CHANNEL_PREFIX)
    );
    if (prefixMatched) return true;

    // External ticket bots often create private threads with unrelated names.
    // If the bot can see the thread, treat it as a ticket thread.
    return true;
  }

  return false;
}

async function checkAndSendKeepalive(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 1 });
    const lastMessage = messages.first();
    if (!lastMessage) return;
    if (Date.now() - lastMessage.createdTimestamp >= TICKET_INACTIVITY_THRESHOLD_MS) {
      await channel.send(TICKET_KEEPALIVE_MESSAGE);
      debugLog('keepalive sent to channel', channel.id);
    }
  } catch {
    // channel may be deleted or inaccessible — skip silently
  }
}

async function sendTicketKeepalives() {
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (isTicketChannel(channel)) await checkAndSendKeepalive(channel);
    }
    try {
      const { threads } = await guild.channels.fetchActiveThreads();
      for (const thread of threads.values()) {
        if (isTicketChannel(thread)) await checkAndSendKeepalive(thread);
      }
    } catch {
      // ignore thread fetch errors
    }
  }
}

function shouldReply(channelId, userId, now) {
  return true;
}

function normalizeQuestion(content) {
  return content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function shouldReplyForContent(channelId, userId, content, now) {
  if (cooldownMs <= 0) return true;

  const key = `${channelId}:${userId}`;
  const normalized = normalizeQuestion(content);
  const last = lastReplyByChannelUser.get(key);

  if (!last) {
    lastReplyByChannelUser.set(key, { at: now, content: normalized });
    return true;
  }

  // Only suppress repeated same-question spam within cooldown.
  if (last.content === normalized && now - last.at < cooldownMs) return false;

  lastReplyByChannelUser.set(key, { at: now, content: normalized });
  return true;
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function includesWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function withGreeting(reply) {
  return `${FIXING_GREETING}\n${reply}`;
}

function debugLog(...args) {
  if (debugAutoReply) console.log('[auto-reply]', ...args);
}

async function sendAutoReply(message, content) {
  await message.reply({ content });
}

function getRuleBasedReply(content) {
  const text = content.toLowerCase();
  // Ignore typo-heavy / malformed phrases instead of forcing a reply.
  if (includesAny(text, ['dies not work', 'ethererum wallet not found', 'develpe'])) {
    return null;
  }
  const hasDaysWaitingPhrase =
    /waiting\s+for\s+\d+\s+day/.test(text) ||
    /it\s+has\s+been\s+\d+\s+day/.test(text) ||
    /been\s+\d+\s+day/.test(text) ||
    /\d+\s*일째/.test(text);

  const isGMIssue =
    (
      (includesWord(text, 'gm') || includesAny(text, ['gasless action', 'gasless'])) &&
      includesAny(text, ["can't", 'cant', 'cannot', 'not working', 'does not work', "doesn't work", 'doesnt work', 'not work', 'fail', 'failed', 'error', 'issue', 'problem'])
    ) ||
    includesAny(text, [
      "can't send gm",
      'cannot gm',
      'gm not working',
      'try gasless action does not work',
      'try gasless action not work',
      'send gm back',
      'send gm back function'
    ]) ||
    (includesWord(text, 'gm') && /(startale site|startale)/.test(text) && /(does not work|not work|not working)/.test(text));

  if (isGMIssue) {
    return withGreeting(pickRandom(GM_FIXING_VARIANTS));
  }

  const isSakeFinanceIssue =
    includesAny(text, ['sake']) &&
    includesAny(text, ['finance', 'task', 'deposit', 'point', 'points', 'no point', 'no points', 'not getting points', 'did not get points']);

  if (isSakeFinanceIssue) {
    return withGreeting(SAKE_FINANCE_REPLY);
  }

  const isStarPointLnyProcessingIssue =
    includesAny(text, ['processing']) &&
    includesAny(text, ['star point', 'points', 'wheel', 'ticket', 'fortune wheel', 'task', 'assignment', 'liquidity']) &&
    includesAny(text, ['not counted', "didn't count", 'did not count', 'hanging', '7 days', 'seven days', 'still']);

  if (isStarPointLnyProcessingIssue) {
    return withGreeting(STAR_POINT_LNY_PROCESSING_REPLY);
  }

  const isStarPointLnyIssue =
    (
      includesAny(text, ['lny', 'lunar new year', 'star point', 'startale app star point']) &&
      includesAny(text, ['swap', '$50', '50', 'mission', 'task', 'complete', 'completion', 'checkmark', 'not reflected', 'not applied', 'not counted', 'points'])
    ) ||
    (includesAny(text, ['star point', 'mission campaign']) && includesAny(text, ['swap', '$50', '50'])) ||
    (
      includesAny(text, ['no checkmark', 'checkmark', 'not checked', 'not completed', 'not complete', 'not reflected']) &&
      includesAny(text, ['swap', 'deposit', 'liquidity', 'task', 'mission', '$50', '50', 'star point', 'fortune wheel', 'usdsc'])
    );

  if (isStarPointLnyIssue) {
    return withGreeting(STAR_POINT_LNY_REPLY);
  }

  const isPasskeyGoogleIssue =
    includesAny(text, [
      'passkey',
      'google account',
      'gmail',
      'line',
      'referral code screen',
      'failed to add passkey',
      "can't create passkey",
      'cant create passkey',
      "can't set passkey",
      'cant set passkey'
    ]) &&
    includesAny(text, [
      'fail',
      'failed',
      'error',
      'cannot',
      "can't",
      'cant',
      'not',
      'rejected',
      'redirected',
      'nothing happen',
      'nothing happens',
      'not work',
      'not working',
      'problem',
      'stuck'
    ]);

  if (isPasskeyGoogleIssue) {
    return withGreeting(pickRandom(GENERAL_FIXING_VARIANTS));
  }

  const isForgotPasswordIssue =
    includesAny(text, [
      'forgot password',
      'forget password',
      'forgot my password',
      'forgot my passkey password',
      'forgot passkey',
      'passkey password',
      'reset password',
      'recover password',
      '윈도우 hello',
      'windows hello'
    ]) &&
    includesAny(text, ['password', 'reset', 'recover', 'forgot', 'forget', 'lost', 'cannot login', "can't login", 'cant login']);

  if (isForgotPasswordIssue) {
    return withGreeting(FORGOT_PASSWORD_REPLY);
  }

  const isEoaSigningIssue =
    includesAny(text, ['eoa']) &&
    includesAny(text, [
      'sign',
      'signing',
      'signature',
      'sign tx',
      'sign transaction',
      'failed to sign',
      'cannot sign',
      "can't sign",
      'signature mismatch',
      'signature check failed',
      'invalid signature'
    ]) &&
    includesAny(text, ['fail', 'failed', 'error', 'issue', 'problem', "can't", 'cant', 'cannot', 'rejected', 'invalid', 'mismatch']);

  if (isEoaSigningIssue) {
    return withGreeting(pickRandom(EOA_SIGNING_FIXING_VARIANTS));
  }

  const isAaMigrationIssue =
    includesAny(text, ['aa', 'account abstraction', 'smart wallet']) &&
    includesAny(text, ['migrate', 'migration', 'account upgrade', 'wallet upgrade', 'upgrade']);

  if (isAaMigrationIssue) {
    return withGreeting(pickRandom(AA_MIGRATION_RESOLVED_VARIANTS));
  }

  const isEarnVaultIssue =
    includesAny(text, ['earn vault', 'use earn vault', 'vault']) &&
    includesAny(text, ['deposit', 'not working', 'not work', 'cannot', "can't", 'cant', 'fail', 'failed', 'issue', 'problem', 'error']);

  if (isEarnVaultIssue) {
    return withGreeting(pickRandom(EARN_VAULT_FIXING_VARIANTS));
  }

  const isWalletConnectionIssue =
    includesAny(text, ['wallet', 'connection', 'connect', 'external wallet', 'eoa wallet', 'metamask', 'rabby', 'okx', 'keplr']) &&
    includesAny(text, ['fail', 'failed', 'error', 'issue', 'problem', "can't", 'cant', 'cannot', 'not work', 'not working', 'wrong', 'unable']);

  if (isWalletConnectionIssue) {
    return withGreeting(pickRandom(WALLET_FIXING_VARIANTS));
  }

  const isMigrationIssue =
    includesAny(text, ['migrate', 'migration', 'account upgrade', 'wallet upgrade', 'upgrade issue', 'log in with wallet failed', 'unexpected error']) ||
    (
      includesAny(text, ['upgrade', 'migration', 'wallet failed', 'access the site']) &&
      includesAny(text, ['fail', 'failed', 'error', 'not work', 'problem', 'cannot', "can't", 'cant'])
    );

  if (isMigrationIssue) {
    return withGreeting(pickRandom(MIGRATION_FIXING_VARIANTS));
  }

  const isAutoBridgeIssue =
    includesAny(text, [
      'auto bridge',
      'bridge',
      'invariant failed',
      'claim failed',
      'approval failed',
      'withdraw failed',
      'ethereum wallet not found',
      'useroperation rejected',
      'signature check failed'
    ]);

  if (isAutoBridgeIssue) {
    return withGreeting(pickRandom(BRIDGE_FIXING_VARIANTS));
  }

  const isSwapRelatedIssue =
    includesWord(text, 'swap') ||
    includesWord(text, 'lp') ||
    includesAny(text, ['liquidity', 'deposit', 'providing liquidity', '풀', '디파짓', '스왑']);
  const hasCheckmarkSignal = includesAny(text, ['checkmark', 'no checkmark', 'not checked', 'not completed', 'not reflected']);
  if (isSwapRelatedIssue && !hasCheckmarkSignal) {
    return withGreeting(pickRandom(SWAP_FIXING_VARIANTS));
  }

  const isDiscordRoleIssue =
    includesAny(text, ['discord role', 'role', 'roles', '롤']) &&
    includesAny(text, ['issue', 'problem', 'not', 'missing', '안돼', '안되', '없']);

  if (isDiscordRoleIssue) {
    return withGreeting(DISCORD_ROLE_REPLY);
  }

  const isStillFixingQuestion =
    (
      includesAny(text, ['still', 'yet', '아직', '언제', 'waiting', 'waited', '며칠', 'days', 'day']) &&
      includesAny(text, ['fix', 'fixed', 'resolve', 'resolved', '고쳐', '해결'])
    ) ||
    hasDaysWaitingPhrase;

  if (isStillFixingQuestion) {
    return withGreeting(pickRandom(STILL_FIXING_VARIANTS));
  }

  return null;
}

async function getAIReply(content) {
  if (!aiEnabled) return null;
  if (!hasUsableOpenAIKey) {
    if (!aiKeyWarningShown) {
      console.warn('AI_ENABLED=true 이지만 OPENAI_API_KEY가 없어 AI 응답을 건너뜁니다.');
      aiKeyWarningShown = true;
    }
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content:
              'You are a Discord support assistant for Startale. Keep replies concise, polite, and practical. If unsure, ask for specific details and say a human agent will follow up.'
          },
          {
            role: 'user',
            content
          }
        ],
        max_output_tokens: 220
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.output_text?.trim() || null;
  } catch (error) {
    console.error('AI 응답 실패:', error);
    return null;
  }
}


client.once(Events.ClientReady, (readyClient) => {
  console.log(`로그인 성공: ${readyClient.user.tag}`);
});

client.once(Events.ClientReady, async () => {
  const commands = [
    {
      name: DELETE_AUTO_REPLY_COMMAND_NAME,
      description: 'Delete the latest bot auto-reply in this ticket channel.'
    },
    {
      name: FAQ_COMMAND_NAME,
      description: 'Browse frequently asked questions about the Startale App.'
    }
  ];

  try {
    const hasValidGuildId = GUILD_ID && /^\d{17,20}$/.test(GUILD_ID);
    if (hasValidGuildId) {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.commands.set(commands);
      await client.application.commands.set([]);
      console.log(`길드 전용 슬래시 명령어 등록 완료`);
    } else {
      if (GUILD_ID) {
        console.warn('GUILD_ID 형식이 잘못되어 글로벌 명령어로 등록합니다. (.env 확인 필요)');
      }
      await client.application.commands.set(commands);
      console.log(`글로벌 슬래시 명령어 등록 완료 (전파에 시간이 걸릴 수 있음)`);
    }
  } catch (error) {
    console.error('슬래시 명령어 등록 실패:', error);
  }

  // Send a keepalive message in ticket channels inactive for 72+ hours
  setInterval(sendTicketKeepalives, TICKET_KEEPALIVE_CHECK_INTERVAL_MS);
  debugLog('ticket keepalive checker started (interval: 1h, threshold: 72h)');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild()) return;

    if (interaction.commandName === DELETE_AUTO_REPLY_COMMAND_NAME) {
      if (!AUTO_REPLY_EXCLUDED_USER_IDS.has(interaction.user.id)) {
        await interaction.reply({ content: 'Only designated support members can use this command.', ephemeral: true });
        return;
      }

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: 'This command can only be used inside a ticket channel.', ephemeral: true });
        return;
      }

      const messages = await channel.messages.fetch({ limit: 50 });
      const latestBotReply = messages.find((msg) => msg.author.id === client.user.id);
      if (!latestBotReply) {
        await interaction.reply({ content: 'No bot auto-reply found to delete.', ephemeral: true });
        return;
      }

      await latestBotReply.delete();
      await interaction.reply({ content: 'Deleted the latest bot auto-reply.', ephemeral: true });
      return;
    }

    if (interaction.commandName === FAQ_COMMAND_NAME) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(FAQ_SELECT_MENU_ID)
        .setPlaceholder('Select a question...')
        .addOptions(
          FAQ_ITEMS.map((item) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(item.question)
              .setValue(item.id)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        content: '**Frequently Asked Questions**\nSelect a question below to see the answer:',
        components: [row],
        ephemeral: true
      });
      return;
    }
  }

  if (interaction.isStringSelectMenu() && interaction.inGuild() && interaction.customId === FAQ_SELECT_MENU_ID) {
    const selectedId = interaction.values[0];
    const faqItem = FAQ_ITEMS.find((item) => item.id === selectedId);

    if (!faqItem) {
      await interaction.reply({ content: 'Question not found.', ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `**Q: ${faqItem.question}**\n\n${faqItem.answer}`
    });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.inGuild() && interaction.customId === MINI_APP_SELECT_ID) {
    const selected = interaction.values[0];

    // Disable the select menu after selection
    const disabledRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(MINI_APP_SELECT_ID)
        .setPlaceholder('Selection recorded.')
        .setDisabled(true)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Selection recorded.').setValue('_placeholder')
        )
    );
    await interaction.update({ components: [disabledRow] });

    if (selected === 'noa_mini_app') {
      await interaction.channel.send(`For Startale App issues, please open a ticket here! <#${GENERAL_TICKET_CHANNEL_ID}>`);
      debugLog('Mini App select: noa_mini_app selected in channel', interaction.channel.id);
      return;
    }

    if (selected === 'mini_app_none') {
      await interaction.channel.send('No Mini App developer assigned to this ticket.');
      debugLog('Mini App select: none selected in channel', interaction.channel.id);
      return;
    }

    const match = MINI_APP_ROLE_MAP.find((r) => r.value === selected);
    if (match) {
      try {
        await interaction.guild.members.fetch();
        const role = await interaction.guild.roles.fetch(match.roleId);
        const members = role ? role.members : null;

        if (members && members.size > 0) {
          const mentions = members.map((m) => `<@${m.id}>`).join(' ');
          await interaction.channel.send(`This ticket has been tagged: **${match.label}**\n${mentions}`);
          // Explicitly add each member to the thread (required for private threads — bot mentions don't auto-add)
          if (interaction.channel.isThread()) {
            await Promise.all(
              members.map((m) =>
                interaction.channel.members.add(m.id).catch((e) => console.error(`Failed to add ${m.id} to thread:`, e))
              )
            );
            debugLog('Added', members.size, 'role members to thread', interaction.channel.id);
          }
        } else {
          await interaction.channel.send(`This ticket has been tagged: **${match.label}**\n<@&${match.roleId}>`);
          debugLog('Mini App Dev role pinged (no members found) in channel', interaction.channel.id, match.label);
        }
      } catch (err) {
        console.error('Failed to tag Mini App dev members:', err);
        await interaction.channel.send(`This ticket has been tagged: **${match.label}**\n<@&${match.roleId}>`);
      }
    }
    return;
  }

});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (!isTicketChannel(message.channel)) return;

  const rawContent = message.content.trim();
  if (rawContent.toLowerCase().startsWith(SUPPORT_TEST_PREFIX)) {
    const canTest =
      AUTO_REPLY_EXCLUDED_USER_IDS.has(message.author.id) ||
      message.member?.permissions.has(PermissionFlagsBits.ManageChannels);
    if (canTest) {
      const simulatedUserMessage = rawContent.slice(SUPPORT_TEST_PREFIX.length).trim();
      if (simulatedUserMessage) {
        const simulatedReply = getRuleBasedReply(simulatedUserMessage);
        if (simulatedReply) {
          await sendAutoReply(message, `[Support Test]\n${simulatedReply}`);
        } else {
          await sendAutoReply(message, '[Support Test]\n(No rule matched — bot would use AI fallback or stay silent)');
        }
      }
    }
    return;
  }

  if (AUTO_REPLY_EXCLUDED_USER_IDS.has(message.author.id)) {
    MANUAL_HANDOFF_CHANNEL_IDS.add(message.channel.id);
    debugLog('manual handoff enabled for channel', message.channel.id, 'by', message.author.id);
    return;
  }


  if (MANUAL_HANDOFF_CHANNEL_IDS.has(message.channel.id)) {
    debugLog('manual handoff active (cached), skip channel', message.channel.id);
    return;
  }

  // Check Discord history in case bot restarted and lost in-memory state.
  // If any support staff member has sent a message in this channel, treat as handoff.
  try {
    const recent = await message.channel.messages.fetch({ limit: 30 });
    const hasStaffReply = recent.some((m) => AUTO_REPLY_EXCLUDED_USER_IDS.has(m.author.id));
    if (hasStaffReply) {
      MANUAL_HANDOFF_CHANNEL_IDS.add(message.channel.id);
      debugLog('manual handoff detected from history, skip channel', message.channel.id);
      return;
    }
  } catch {
    // If we can't fetch history, skip auto-reply to be safe
    debugLog('failed to fetch history for handoff check, skipping channel', message.channel.id);
    return;
  }
  // Fallback: send mini app select menu if it was never sent in this channel
  // (handles bot restarts or missed ThreadCreate events)
  // Only send mini app select menu for threads in the mini app ticket channel
  if (
    message.channel.isThread() &&
    message.channel.parentId === MINI_APP_TICKET_CHANNEL_ID &&
    !MINI_APP_MENU_SENT_IDS.has(message.channel.id)
  ) {
    MINI_APP_MENU_SENT_IDS.add(message.channel.id);
    try { await message.channel.join(); } catch { /* ignore */ }
    sendMiniAppSelectMenu(message.channel); // intentionally not awaited
  }
});

const MINI_APP_SELECT_ID = 'mini_app_select';
const MINI_APP_TICKET_CHANNEL_ID = '1483833764160475207';
const GENERAL_TICKET_CHANNEL_ID = '1425558708943061132';
const MINI_APP_ROLE_MAP = [
  { value: 'mini_app_el_hexa',            label: 'El Hexa',                roleId: MINI_APP_EL_HEXA_ROLE_ID },
  { value: 'mini_app_morning_moon_pocket', label: 'Morning Moon Pocket',   roleId: MINI_APP_MORNING_MOON_POCKET_ROLE_ID },
  { value: 'mini_app_morning_farm',        label: 'Morning Farm',          roleId: MINI_APP_MORNING_FARM_ROLE_ID },
  { value: 'mini_app_packflip',            label: 'Packflip',              roleId: MINI_APP_PACKFLIP_ROLE_ID },
  { value: 'mini_app_pnyx',               label: 'PNYX/Press A/PIKIT',    roleId: MINI_APP_PNYX_ROLE_ID },
  { value: 'mini_app_awakening',           label: 'Awakening of Guardians', roleId: MINI_APP_AWAKENING_ROLE_ID },
  { value: 'mini_app_pocket_knights',      label: 'Pocket Knights',        roleId: MINI_APP_POCKET_KNIGHTS_ROLE_ID },
  { value: 'mini_app_world_of_trinity',    label: 'World of Trinity',      roleId: MINI_APP_WORLD_OF_TRINITY_ROLE_ID },
  { value: 'mini_app_dice_or_die',         label: 'Dice or Die',           roleId: MINI_APP_DICE_OR_DIE_ROLE_ID },
  { value: 'mini_app_heroes',              label: 'Heroes of Hechanos',    roleId: MINI_APP_HEROES_ROLE_ID },
  { value: 'mini_app_clash_horse',         label: 'Clash Horse',           roleId: MINI_APP_CLASH_HORSE_ROLE_ID },
  { value: 'mini_app_nekocat',             label: 'Nekocat/Las Meta',      roleId: MINI_APP_NEKOCAT_ROLE_ID },
  { value: 'mini_app_burrow_bash',         label: 'Burrow Bash',           roleId: MINI_APP_BURROW_BASH_ROLE_ID }
];

async function sendMiniAppSelectMenu(channel) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  try {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(MINI_APP_SELECT_ID)
      .setPlaceholder('Select the Mini App developer...')
      .addOptions([
        ...MINI_APP_ROLE_MAP.map((r) =>
          new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value)
        ),
        new StringSelectMenuOptionBuilder()
          .setLabel('Not a Mini App Issue')
          .setValue('noa_mini_app')
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({
      content: 'Which mini app are you experiencing an issue with?',
      components: [row]
    });
    MINI_APP_MENU_SENT_IDS.add(channel.id);
    debugLog('Mini App select menu sent to channel', channel.id);
  } catch (error) {
    console.error('Mini App select menu send failed:', error);
  }
}

// Tickets created as text channels
client.on(Events.ChannelCreate, async (channel) => {
  if (!isTicketChannel(channel)) return;
  await sendMiniAppSelectMenu(channel);
});

// Tickets created as threads
client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
  console.log(`[ThreadCreate] id=${thread.id} name="${thread.name}" newlyCreated=${newlyCreated} parentId=${thread.parentId}`);

  // newlyCreated=false happens when the bot is added to a private thread AFTER creation
  // (ticket bot creates thread first, then adds our bot as a member).
  // Still process if the thread was created within the last 5 minutes.
  const threadAgeMs = Date.now() - thread.createdTimestamp;
  if (!newlyCreated && threadAgeMs > 5 * 60 * 1000) return;

  // Only send mini app select menu for threads in the mini app ticket channel
  if (thread.parentId !== MINI_APP_TICKET_CHANNEL_ID) return;

  // Fetch parent channel if not cached so isTicketChannel works correctly
  if (thread.isThread() && !thread.parent && thread.parentId) {
    try { await thread.client.channels.fetch(thread.parentId); } catch { /* ignore */ }
  }

  const parentName = thread.parent?.name ?? '(no parent)';
  const isTicket = isTicketChannel(thread);
  console.log(`[ThreadCreate] parent="${parentName}" isTicketChannel=${isTicket} ageMs=${threadAgeMs}`);

  if (!isTicket) return;

  // Join private threads so the bot can send messages in them
  try {
    await thread.join();
    console.log(`[ThreadCreate] joined thread ${thread.id}`);
  } catch (err) {
    console.warn(`[ThreadCreate] join failed for thread ${thread.id}:`, err.message);
  }

  await sendMiniAppSelectMenu(thread);
});

client.login(tokenTrimmed);
