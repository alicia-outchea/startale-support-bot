import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const {
  DISCORD_TOKEN,
  GUILD_ID,
  TICKET_CATEGORY_ID,
  SUPPORT_ROLE_ID,
  TICKET_CHANNEL_PREFIX = 'ticket-',
  AUTO_REPLY_COOLDOWN_SEC = '300',
  AI_ENABLED = 'false',
  OPENAI_API_KEY = '',
  OPENAI_MODEL = 'gpt-4.1-mini',
  SCORE_PORTAL_URL = 'https://portal.soneium.org/en/profile/YOUR_WALLET_ADDRESS',
  ROLE_TAG_ESCALATION_MENTIONS = '@Alicia @Ramz @Jerad'
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
const hasUsableOpenAIKey = OPENAI_API_KEY && !/여기에|token|key|토큰/i.test(OPENAI_API_KEY) && OPENAI_API_KEY.length > 20;
let aiKeyWarningShown = false;
const lastReplyByChannelUser = new Map();
const OPEN_TICKET_BUTTON_ID = 'open_ticket';
const CLOSE_TICKET_BUTTON_ID = 'close_ticket';
const PANEL_COMMAND_NAME = 'ticketpanel';
const DELETE_AUTO_REPLY_COMMAND_NAME = 'deletebotreply';
const OPEN_TICKET_MODAL_ID = 'open_ticket_modal';
const SMART_WALLET_INPUT_ID = 'smart_wallet_address';
const EOA_WALLET_INPUT_ID = 'eoa_wallet_address';
const AUTO_REPLY_EXCLUDED_USER_IDS = new Set([
  '516260929093107729',
  '747167440945020978'
]);
const MANUAL_HANDOFF_CHANNEL_IDS = new Set();
const FIXING_GREETING = 'Hello, thank you for the report!';
const GENERAL_FIXING_VARIANTS = [
  'Our team is aware of this and is actively working on a fix right now. Thank you for your patience while we resolve it. 🙏',
  'Thank you for reporting this. Our developers are already working to fix it as quickly as possible, and we will keep you updated.',
  'We understand this is frustrating, and we truly appreciate your patience. The team is actively working on a resolution now. 🙏'
];
const GM_FIXING_VARIANTS = [
  'Our team has identified the GM/gasless action issue and is actively working on it now. Thank you for your patience, and we will update you as soon as it is fixed. 🙏',
  'Thanks for flagging the GM issue. The team is currently working on a fix, and we expect improvement soon. We appreciate your patience. 🙏',
  'We have shared your GM report with the developers, and they are actively fixing it. Thank you for waiting with us. 🙏'
];
const WALLET_FIXING_VARIANTS = [
  'Our team is aware of the wallet connection issue and is actively working on a fix. Thank you for your patience while we resolve this. 🙏',
  'Thanks for reporting the wallet connection problem. The developers are currently working on it, and we will keep you updated.',
  'We understand the wallet connection issue is blocking your access. Our team is working on it now and will share updates as soon as possible.'
];
const MIGRATION_FIXING_VARIANTS = [
  'Most migration/account upgrade cases related to smart wallet (AA) are now resolved. Please try again, and if the issue continues, share your wallet address and screenshots so we can check further. 🙏',
  'We have resolved the majority of migration issues for smart wallet (AA) users. Please retry the flow once, and let us know if you still see an error. 🙏',
  'Migration has been improved for most AA/smart wallet users. If you are still blocked, please share details and we will help you right away. 🙏'
];
const AA_MIGRATION_RESOLVED_VARIANTS = [
  'Good news: migration issues for smart wallet (AA) users are mostly resolved now. Please try again and let us know if you still face any problem. 🙏',
  'Thanks for checking. The AA/smart wallet migration issue has been fixed for most users. Please retry once and tell us if anything is still not working. 🙏'
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
const SCORE_REPLY_VARIANTS = [
  'We’re actively fixing the issue, please rest assured that score tracking is unaffected, all EOA activity and eligible actions across the Startale and Soneium ecosystem continue to count, and the Startale App Bonus will be reflected shortly.',
  'Our team is actively fixing this issue. Please rest assured that score tracking is unaffected, all EOA activity and eligible actions across the Startale and Soneium ecosystem still count, and the Startale App Bonus will be reflected shortly.',
  'We are currently working on this issue. Please rest assured that score tracking remains unaffected, all EOA activity and eligible actions across Startale and the Soneium ecosystem continue to count, and the Startale App Bonus will be reflected shortly.'
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
    GatewayIntentBits.MessageContent
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
      includesAny(text, ['gm', 'gasless action', 'gasless']) &&
      includesAny(text, ["can't", 'cant', 'cannot', 'not working', 'does not work', 'not work', 'fail', 'failed', 'error', 'issue', 'problem'])
    ) ||
    includesAny(text, [
      'can’t send gm',
      "can't send gm",
      'cannot gm',
      'gm not working',
      'try gasless action does not work',
      'try gasless action not work',
      'send gm back',
      'send gm back function'
    ]) ||
    (/gm/.test(text) && /(startale site|startale)/.test(text) && /(does not work|not work|not working)/.test(text));

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

  const isScoreIssue =
    (
      includesAny(text, ['soneium', 'portal.soneium', 'soneium portal', 'score portal', 'soneium score', 'points', 'point', 'quest']) &&
      includesAny(text, ["can't", 'cant', 'cannot', 'not open', 'unable', 'error', 'fail', 'failed', 'loop', 'not recognize', 'cannot access', 'cant access', "can't access", 'cant enter', "can't enter", 'access'])
    ) ||
    (includesAny(text, ['portal']) && includesAny(text, ['score', 'points', 'soneium']));

  if (isScoreIssue) {
    return withGreeting(
      `${pickRandom(SCORE_REPLY_VARIANTS)}\n\nYou can check your Soneium Score directly here: ${SCORE_PORTAL_URL}`
    );
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
    includesAny(text, ['wallet', 'connection', 'connect', 'external wallet', 'eoa wallet', 'metamask', 'rabby']) &&
    includesAny(text, ['fail', 'failed', 'error', 'issue', 'problem', "can't", 'cant', 'cannot', 'not work', 'not working', 'wrong']);

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

function buildTicketPermissions(guild, memberId) {
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: memberId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  if (SUPPORT_ROLE_ID) {
    permissionOverwrites.push({
      id: SUPPORT_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  return permissionOverwrites;
}

async function createTicketChannel(guild, memberId, smartWalletAddress, eoaWalletAddress) {
  const existing = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.name === `${TICKET_CHANNEL_PREFIX}${memberId}`
  );

  if (existing) return { existing };

  const channel = await guild.channels.create({
    name: `${TICKET_CHANNEL_PREFIX}${memberId}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID || null,
    permissionOverwrites: buildTicketPermissions(guild, memberId)
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_TICKET_BUTTON_ID)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content:
      `<@${memberId}> Your ticket is now open.\n` +
      `Startale App Smart Wallet Address: \`${smartWalletAddress}\`\n` +
      `Connected EOA Wallet Address: \`${eoaWalletAddress}\``,
    components: [closeRow]
  });

  return { channel };
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`로그인 성공: ${readyClient.user.tag}`);
});

client.once(Events.ClientReady, async () => {
  const commands = [
    {
      name: PANEL_COMMAND_NAME,
      description: 'Send the ticket open button in this channel.'
    },
    {
      name: DELETE_AUTO_REPLY_COMMAND_NAME,
      description: 'Delete the latest bot auto-reply in this ticket channel.'
    }
  ];

  try {
    const hasValidGuildId = GUILD_ID && /^\d{17,20}$/.test(GUILD_ID);
    if (hasValidGuildId) {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.commands.set(commands);
      console.log(`길드 전용 슬래시 명령어 등록 완료: /${PANEL_COMMAND_NAME}`);
    } else {
      if (GUILD_ID) {
        console.warn('GUILD_ID 형식이 잘못되어 글로벌 명령어로 등록합니다. (.env 확인 필요)');
      }
      await client.application.commands.set(commands);
      console.log(`글로벌 슬래시 명령어 등록 완료: /${PANEL_COMMAND_NAME} (전파에 시간이 걸릴 수 있음)`);
    }
  } catch (error) {
    console.error('슬래시 명령어 등록 실패:', error);
  }
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

    if (interaction.commandName !== PANEL_COMMAND_NAME) return;

    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!hasPermission) {
      await interaction.reply({ content: 'Only administrators can use this command.', ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(OPEN_TICKET_BUTTON_ID)
        .setLabel('Open a support ticket!')
        .setStyle(ButtonStyle.Success)
    );

    const panelEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setDescription(
        [
          '**How can we assist you?**',
          '',
          'React below to open a private ticket with our team.',
          '',
          '• If its an onchain matter, please ensure to include your **wallet address** and **transaction hash**.',
          '',
          '**What we\'re looking for:**',
          '',
          '• Bug reports',
          '• General feedback',
          '• Questions about the app',
          '',
          'We\'ll respond as soon as possible. Thank you.'
        ].join('\n')
      );

    await interaction.reply({
      embeds: [panelEmbed],
      components: [row]
    });
    return;
  }

  if (interaction.isButton() && interaction.inGuild() && interaction.customId === OPEN_TICKET_BUTTON_ID) {
    const modal = new ModalBuilder()
      .setCustomId(OPEN_TICKET_MODAL_ID)
      .setTitle('Open Ticket');

    const smartWalletInput = new TextInputBuilder()
      .setCustomId(SMART_WALLET_INPUT_ID)
      .setLabel('Startale App Smart Wallet Address')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter Smart Wallet address');

    const eoaWalletInput = new TextInputBuilder()
      .setCustomId(EOA_WALLET_INPUT_ID)
      .setLabel('Connected EOA Wallet Address')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter EOA Wallet address');

    modal.addComponents(
      new ActionRowBuilder().addComponents(smartWalletInput),
      new ActionRowBuilder().addComponents(eoaWalletInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.inGuild() && interaction.customId === OPEN_TICKET_MODAL_ID) {
    const guild = interaction.guild;
    const memberId = interaction.user.id;
    const smartWalletAddress = interaction.fields.getTextInputValue(SMART_WALLET_INPUT_ID).trim();
    const eoaWalletAddress = interaction.fields.getTextInputValue(EOA_WALLET_INPUT_ID).trim();

    try {
      const result = await createTicketChannel(guild, memberId, smartWalletAddress, eoaWalletAddress);
      if (result.existing) {
        await interaction.reply({
          content: `You already have an open ticket: ${result.existing}`,
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: `Your ticket has been created: ${result.channel}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('티켓 채널 생성 실패:', error);
      await interaction.reply({ content: 'An error occurred while creating your ticket.', ephemeral: true });
    }
    return;
  }

  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  if (interaction.customId === CLOSE_TICKET_BUTTON_ID) {
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const isTicket = isTicketChannel(channel);
    if (!isTicket) {
      await interaction.reply({ content: 'This button can only be used in a ticket channel.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Closing ticket...' });
    setTimeout(async () => {
      try {
        await channel.delete('Ticket closed by button');
      } catch (error) {
        console.error('티켓 삭제 실패:', error);
      }
    }, 1000);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (!isTicketChannel(message.channel)) return;

  if (AUTO_REPLY_EXCLUDED_USER_IDS.has(message.author.id)) {
    // If support staff replies in this ticket, stop bot auto-replies in this channel.
    MANUAL_HANDOFF_CHANNEL_IDS.add(message.channel.id);
    return;
  }

  if (MANUAL_HANDOFF_CHANNEL_IDS.has(message.channel.id)) return;
  if (message.mentions.roles.size > 0 || message.mentions.everyone) {
    await sendAutoReply(message, ROLE_TAG_ESCALATION_MENTIONS);
    return;
  }

  const now = Date.now();
  if (!shouldReply(message.channel.id, message.author.id, now)) return;
  if (!shouldReplyForContent(message.channel.id, message.author.id, message.content, now)) return;

  try {
    const ruleBasedReply = getRuleBasedReply(message.content);
    if (ruleBasedReply) {
      await sendAutoReply(message, ruleBasedReply);
      return;
    }
    return;
  } catch (error) {
    console.error('자동응답 전송 실패:', error);
  }
});

client.login(tokenTrimmed);
