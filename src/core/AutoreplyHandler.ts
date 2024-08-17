import fs from 'fs';
import 'dotenv/config';

import { Collection, Guild, Message } from 'discord.js';
import { StringTools } from 'util/StringTools';
import { GuildId } from './Types';
import { Logger } from './Logger';
import { finassert } from './FinaError';

export interface Autoreply {
    name?: string;
    description: string;
    pingReply?: boolean;
    probability?: number;
    keys: string[];
    process: (message: Message) => string | undefined;
}

const isAutoreply = (item: any): item is Autoreply => {
    return 'process' in item && 'description' in item;
};

export class AutoreplyHandler {
    private _autoreplies: Autoreply[];
    private _guildAutoreplies: Collection<GuildId, Autoreply[]>;
    private static _instance: AutoreplyHandler;

    public constructor() {
        const files = fs
            .readdirSync(`./src/autoreplies`)
            .filter((file) => file.indexOf('.ts') >= 0);

        this._autoreplies = [];
        this._guildAutoreplies = new Collection();
        AutoreplyHandler._instance = this;

        for (const file of files) {
            const fileContent = require(`../autoreplies/${file.replace(
                '.ts',
                '.js'
            )}`) as object;
            for (const [name, autoreply] of Object.entries(fileContent)) {
                if (isAutoreply(autoreply)) {
                    autoreply.name ??= name;
                    autoreply.name = StringTools.capitalize(autoreply.name);
                    Logger.debug(`FinaAutoreplyHandler has registered ${autoreply.name}`);
                    this._autoreplies.push(autoreply);
                }
            }
        }
    }

    public static get instance() {
        return this._instance;
    }

    public async loadAutorepliesFromKeys(guild: Guild, keys: string[]) {
        const array: Autoreply[] = [];

        for (const autoreply of this._autoreplies) {
            if (autoreply.keys.some((commandKey) => keys.includes(commandKey))) {
                finassert(
                    guild.id === process.env.TEST_GUILD ||
                        !autoreply.keys.some((key) => key.includes('hidden')),
                    {
                        details: `Attempted to register a hidden replier in a non-testing guild (${guild.id} vs ${process.env.TEST_GUILD}`
                    }
                );
                Logger.debug(
                    `FinaAutoreplyHandler has registered ${guild.name}:${
                        autoreply.name || 'noname'
                    }`
                );
                array.push(autoreply);
            }
        }

        this._guildAutoreplies.set(guild.id, array);
    }

    public reply(message: Message) {
        for (const autoreply of this.getGuildAutoreplies(message.guildId)) {
            if (
                autoreply.probability === undefined ||
                Math.random() < autoreply.probability
            ) {
                const res = autoreply.process(message);
                if (res !== undefined) {
                    if (autoreply.pingReply) {
                        message.reply(res);
                    } else {
                        message.channel.send(res);
                    }
                }
            }
        }
    }

    public getGuildAutoreplies(guildId: GuildId | null) {
        return this._guildAutoreplies.get(guildId ?? '') || [];
    }
}
