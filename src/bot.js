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
  DEBUG_AUTOREPLY = 'false',
  MINI_APP_EL_HEXA_ROLE_ID = '1483709405806727293',
  MINI_APP_MORNING_MOON_POCKET_ROLE_ID = '1483717804757614622',
  MINI_APP_FRIENDS_ROLE_ID = '1538914902217986110',
  MINI_APP_PACKFLIP_ROLE_ID = '1483849283714420857',
  MINI_APP_PNYX_ROLE_ID = '1483849398986346557',
  MINI_APP_AWAKENING_ROLE_ID = '1483849538165936209',
  MINI_APP_POCKET_KNIGHTS_ROLE_ID = '1483849639525486714',
  MINI_APP_WORLD_OF_TRINITY_ROLE_ID = '1483849828575350936',
  MINI_APP_DICE_OR_DIE_ROLE_ID = '1483849911735943329',
  MINI_APP_HEROES_ROLE_ID = '1483849970137305312',
  MINI_APP_CLASH_HORSE_ROLE_ID = '1483850079331946697',
  MINI_APP_NEKOCAT_ROLE_ID = '1483850186747805927',
  MINI_APP_BURROW_BASH_ROLE_ID = '1483850354591400067',
  MINI_APP_COOL_CATS_ROLE_ID = '1489106591667060736',
  MINI_APP_YOKI_ARCADE_ROLE_ID = '1501218559760793660',
  MINI_APP_CLAW_MACHINE_ROLE_ID = '1496550892160155929',
  MINI_APP_TAPTAP_ROLE_ID = '1501471650368061552',
  MINI_APP_CONFNT_ROLE_ID = '1508318182899974194',
  MINI_APP_GRAILED_ROLE_ID = '1539074983572152493',
  MINI_APP_CRYPTOFILLS_ROLE_ID = '1531608307956060210',
  MINI_APP_SQUADLETICS_ROLE_ID = '1531608234387836950',
  MINI_APP_SUPERCASH_ROLE_ID = '1531608130818146335',
  MINI_APP_SPACE_RUNNER_ROLE_ID = '1531607968741720217',
  MINI_APP_WEAD_ROLE_ID = '1538875553841414164'
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

const debugAutoReply = DEBUG_AUTOREPLY.toLowerCase() === 'true';

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

  if (channel.type === ChannelType.GuildText) {
    if (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID) return true;
    return channel.name.startsWith(TICKET_CHANNEL_PREFIX);
  }

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

    return true;
  }

  return false;
}

function debugLog(...args) {
  if (debugAutoReply) console.log('[debug]', ...args);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`로그인 성공: ${readyClient.user.tag}`);
});

const MINI_APP_SELECT_ID = 'mini_app_select';
const MINI_APP_TICKET_CHANNEL_ID = '1483833764160475207';
const GENERAL_TICKET_CHANNEL_ID = '1425558708943061132';
const MINI_APP_ROLE_MAP = [
  { value: 'mini_app_claw_machine',        label: 'AI Footballer/Claw Machine/Force Flip',    roleId: MINI_APP_CLAW_MACHINE_ROLE_ID },
  { value: 'mini_app_awakening',           label: 'Awakening of Guardians/Zombie Idle Defence', roleId: MINI_APP_AWAKENING_ROLE_ID },
  { value: 'mini_app_burrow_bash',         label: 'Burrow Bash',                              roleId: MINI_APP_BURROW_BASH_ROLE_ID },
  { value: 'mini_app_clash_horse',         label: 'Clash Horse',                              roleId: MINI_APP_CLASH_HORSE_ROLE_ID },
  { value: 'mini_app_confnt',             label: 'coNFT',                                    roleId: MINI_APP_CONFNT_ROLE_ID },
  { value: 'mini_app_cool_cats',           label: 'Cool Cats',                                roleId: MINI_APP_COOL_CATS_ROLE_ID },
  { value: 'mini_app_cryptofills',         label: 'Cryptofills',                              roleId: MINI_APP_CRYPTOFILLS_ROLE_ID },
  { value: 'mini_app_dice_or_die',         label: 'Dice or Die',                              roleId: MINI_APP_DICE_OR_DIE_ROLE_ID },
  { value: 'mini_app_el_hexa',            label: 'El Hexa',                                  roleId: MINI_APP_EL_HEXA_ROLE_ID },
  { value: 'mini_app_nekocat',             label: 'Fantasy Team/NekoCat/CardWars/LasMeta',    roleId: MINI_APP_NEKOCAT_ROLE_ID },
  { value: 'mini_app_friends',             label: 'Friends',                                  roleId: MINI_APP_FRIENDS_ROLE_ID },
  { value: 'mini_app_grailed',             label: 'Grailed',                                  roleId: MINI_APP_GRAILED_ROLE_ID },
  { value: 'mini_app_heroes',             label: 'Heroes of Hecanos',                        roleId: MINI_APP_HEROES_ROLE_ID },
  { value: 'mini_app_morning_moon_pocket', label: 'Morning Moon Pocket',                      roleId: MINI_APP_MORNING_MOON_POCKET_ROLE_ID },
  { value: 'mini_app_packflip',            label: 'Packflip',                                 roleId: MINI_APP_PACKFLIP_ROLE_ID },
  { value: 'mini_app_pnyx',               label: 'PNYX/Press A/PIKIT',                       roleId: MINI_APP_PNYX_ROLE_ID },
  { value: 'mini_app_pocket_knights',      label: 'Pocket Knights',                           roleId: MINI_APP_POCKET_KNIGHTS_ROLE_ID },
  { value: 'mini_app_space_runner',        label: 'Space Runner/Penalty Game',                roleId: MINI_APP_SPACE_RUNNER_ROLE_ID },
  { value: 'mini_app_squadletics',         label: 'Squadletics',                              roleId: MINI_APP_SQUADLETICS_ROLE_ID },
  { value: 'mini_app_supercash',           label: 'SuperCash',                                roleId: MINI_APP_SUPERCASH_ROLE_ID },
  { value: 'mini_app_taptap',             label: 'TapTap',                                   roleId: MINI_APP_TAPTAP_ROLE_ID },
  { value: 'mini_app_wead',               label: 'WeAd/Gonana Farms/SEOAI',                  roleId: MINI_APP_WEAD_ROLE_ID },
  { value: 'mini_app_world_of_trinity',    label: 'World of Trinity',                         roleId: MINI_APP_WORLD_OF_TRINITY_ROLE_ID },
  { value: 'mini_app_yoki_arcade',         label: 'Yoki Arcade',                              roleId: MINI_APP_YOKI_ARCADE_ROLE_ID }
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
    debugLog('Mini App select menu sent to channel', channel.id);
  } catch (error) {
    console.error('Mini App select menu send failed:', error);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.inGuild()) return;
  if (interaction.customId !== MINI_APP_SELECT_ID) return;

  const selected = interaction.values[0];

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

  const match = MINI_APP_ROLE_MAP.find((r) => r.value === selected);
  if (match) {
    await interaction.channel.send(`This ticket has been tagged: **${match.label}**\n<@&${match.roleId}>`);
    if (interaction.channel.isThread()) {
      try {
        await interaction.guild.members.fetch();
        const role = await interaction.guild.roles.fetch(match.roleId);
        if (role) {
          await Promise.all(
            role.members.map((m) =>
              interaction.channel.members.add(m.id).catch((e) => console.error(`Failed to add ${m.id} to thread:`, e))
            )
          );
          debugLog('Added', role.members.size, 'role members to thread', interaction.channel.id);
        }
      } catch (err) {
        console.error('Failed to add role members to thread:', err);
      }
    }
  }
});

// Tickets created as threads in the mini app ticket channel
client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
  console.log(`[ThreadCreate] id=${thread.id} name="${thread.name}" newlyCreated=${newlyCreated} parentId=${thread.parentId}`);

  const threadAgeMs = Date.now() - thread.createdTimestamp;
  if (!newlyCreated && threadAgeMs > 5 * 60 * 1000) return;

  if (thread.parentId !== MINI_APP_TICKET_CHANNEL_ID) return;

  if (thread.isThread() && !thread.parent && thread.parentId) {
    try { await thread.client.channels.fetch(thread.parentId); } catch { /* ignore */ }
  }

  const parentName = thread.parent?.name ?? '(no parent)';
  const isTicket = isTicketChannel(thread);
  console.log(`[ThreadCreate] parent="${parentName}" isTicketChannel=${isTicket} ageMs=${threadAgeMs}`);

  if (!isTicket) return;

  try {
    await thread.join();
    console.log(`[ThreadCreate] joined thread ${thread.id}`);
  } catch (err) {
    console.warn(`[ThreadCreate] join failed for thread ${thread.id}:`, err.message);
  }

  await sendMiniAppSelectMenu(thread);
});

client.login(tokenTrimmed);
