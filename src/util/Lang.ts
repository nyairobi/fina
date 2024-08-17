import Database from 'core/Database';
import { Logger } from 'core/Logger';
import { Channel, DMChannel, Guild, Interaction, TextBasedChannel } from 'discord.js';
import fs from 'fs';
import { GuildId } from '../core/Types';

type LangFile = {
    [key: string]: string;
};

const langFileMap: Map<string, LangFile> = new Map();
const guildMap: Map<GuildId, string> = new Map();

const loadLang = (newLang: string) => {
    langFileMap.set(
        newLang,
        JSON.parse(
            fs.readFileSync(`./lang/${newLang}.json`, { encoding: 'utf8', flag: 'r' })
        )
    );
    Logger.debug(`Loaded language '${newLang}'`);
};

const files = fs.readdirSync(`./lang`).filter((file) => file.indexOf('.json') >= 0);

for (const file of files) {
    loadLang(file.slice(0, -5));
}

/**
 * Reload ALL guild languages from the database
 * This is good enough for now because there are like 2 guilds
 */
const refreshGuilds = async () => {
    const dbServers = await Database.server.findMany();
    for (const server of dbServers) {
        guildMap.set(server.serverId, server.lang);
    }
};

refreshGuilds();

const format = (key: string, args: string[]) => {
    let res = key;
    for (const arg of args) {
        res = res.replace('{}', arg);
    }
    return res;
};

const getKey = (lang: string, key: string): string => {
    const langFile = langFileMap.get(lang);
    if (langFile != null) {
        const newKey = langFile[key];
        if (newKey != null && newKey != '') {
            key = newKey;
        } else {
            langFile[key] = '';
            // Logger.debug(`Missing value in ${lang}: "${key}": ""`);
        }
    }
    return key;
};

const translateLiteral = (
    lang: string,
    strings: TemplateStringsArray,
    ...args: string[]
) => format(getKey(lang, strings.join('{}')), args);

const translateString = (lang: string, ...args: string[]) =>
    format(getKey(lang, args[0]), args.slice(1));

const languageFunctionFactory =
    (lang: string) =>
    (strings: string | TemplateStringsArray, ...args: string[]) => {
        if (Array.isArray(strings)) {
            return translateLiteral(lang, strings as TemplateStringsArray, ...args);
        } else {
            return translateString(lang, strings as string, ...args);
        }
    };

type LangResolvable = Interaction | Guild | TextBasedChannel | string;

/*export default*/ (l: LangResolvable) => {
    let id: string = 'en';
    if (l instanceof Interaction || l instanceof Channel) {
        // This is to shut TS up
        // This bot doesn't use DM intents ffs
        if (!(l instanceof DMChannel)) {
            id = l.guild?.id || '';
        }
    } else if (l instanceof Guild) {
        id = l.id;
    } else if (typeof l === 'string') {
        id = l;
    }

    return languageFunctionFactory(guildMap.get(id) || 'en');
};

/*export*/ type LangFunction = (
    strings: string | TemplateStringsArray,
    ...args: string[]
) => string;
