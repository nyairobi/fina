import { finassert } from 'core/FinaError';
import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { Guild, TextChannel } from 'discord.js';
import { GameManager } from './GameManager';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder } from 'core/FinaCommandBuilder';

export default class Answer extends FinaSlashCommand {
    public constructor() {
        super('ninja.nairobi.games.answer');
        this.keys = ['ninja.nairobi.games.20questions'];
    }

    public createCommands(guild: Guild): FinaCommandBuilder {
        return new FinaCommandBuilder(this)
            .setName('answer')
            .setDescription('Sends an answer to a game.')
            .addOption({
                type: 'String',
                name: 'guess',
                description: 'Your guess',
                required: true
            });
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const game = GameManager.getCurrentGame(interaction);
        finassert(interaction.channel instanceof TextChannel, {
            message: 'Invalid channel'
        });
        await game.answer(reply, interaction);
    }
}
