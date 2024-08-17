import { FinaEditOptions, FinaReplyOptions } from 'core/FinaReplyOptions';
import { Logger } from 'core/Logger';
import { Collection, Message } from 'discord.js';
import { DiscordTools } from './DiscordTools';

export class TimedCollection<V> extends Collection<Message, V> {
    private _duration: number;
    private _timeouts: Collection<Message, NodeJS.Timeout>;
    private _endMessage: string | undefined;

    public constructor(duration: number, endMessage?: string) {
        super();
        this._duration = duration;
        this._timeouts = new Collection();
        this._endMessage = endMessage;
    }

    private onTimeout(message: Message) {
        return () => {
            let output: FinaEditOptions = { components: [], message };
            if (this._endMessage) {
                output.content = this._endMessage;
            }
            DiscordTools.editMessage(null, output).catch(() => {});
            this._timeouts.delete(message);
            this.delete(message);
            Logger.debug(`Deleted a TimedCollection object`);
        };
    }

    private recreateTimeout(message: Message) {
        const previousTimeout = this._timeouts.get(message);
        if (previousTimeout !== undefined) {
            clearTimeout(previousTimeout);
            Logger.debug(`Refreshed a TimedCollection object`);
        } else {
            Logger.debug(`Created a TimedCollection object`);
        }
        this._timeouts.set(message, setTimeout(this.onTimeout(message), this._duration));
    }

    public delete(message: Message, dontEdit?: boolean) {
        const previousTimeout = this._timeouts.get(message);
        if (previousTimeout !== undefined) {
            clearTimeout(previousTimeout);
            if (!dontEdit) {
                this.onTimeout(message)();
            }
        }
        return super.delete(message);
    }

    public set(message: Message, value: V) {
        super.set(message, value);
        this.recreateTimeout(message);
        return this;
    }

    public get(message: Message) {
        const result = super.get(message);
        if (result !== undefined) {
            this.recreateTimeout(message);
        }
        return result;
    }
}
