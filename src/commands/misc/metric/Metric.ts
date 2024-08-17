import { BaseReply, FinaCommand, IContextMessageCommand } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaContextMessageInteraction } from 'core/Types';
import { UnitConverter } from 'util/UnitConverter';
import { finassert } from 'core/FinaError';
import { Message } from 'discord.js';

export default class Metric extends FinaCommand implements IContextMessageCommand {
    private _alreadyConverted: WeakSet<Message>;

    public constructor() {
        super('ninja.nairobi.misc.metric');
        this._alreadyConverted = new WeakSet();
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('Convert to metric')
            .setType('MESSAGE');
    }

    public async processContextMessage(
        reply: BaseReply,
        interaction: FinaContextMessageInteraction
    ) {
        const message = interaction.targetMessage;

        finassert(!this._alreadyConverted.has(message), {
            message: 'This message was already converted',
            gif: 'angry'
        });

        finassert(message.author.id !== interaction.client.user?.id, {
            message: "You can't convert my messages",
            gif: 'angry'
        });

        const converted = UnitConverter.convert(message.content);

        finassert(converted.length > 0, {
            message: `Unable to find any freedom units in this message.\nAvailable units: ${UnitConverter.listUnits()}`,
            gif: 'dead'
        });

        this._alreadyConverted.add(message);

        await reply({
            title: 'Converted units',
            content: `[Source message](${message.url})`,
            fields: converted.map(([imperial, metric]) => {
                return { name: imperial, value: metric, inline: true };
            })
        });
    }
}
