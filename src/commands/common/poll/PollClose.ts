import Database, { DbPoll } from 'core/Database';
import { FinaSlashCommand, IAutocompleteCommand, BaseReply } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { finassert } from 'core/FinaError';
import { FinaCommandInteraction } from 'core/Types';
import {
    Message,
    AutocompleteInteraction,
    CacheType,
    ApplicationCommandOptionChoiceData
} from 'discord.js';
import { PollCommon } from './PollCommon';

export class PollClose extends FinaSlashCommand implements IAutocompleteCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.common.poll'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = 'close';
        return new FinaCommandBuilder(this)
            .setName('close')
            .setDescription('Finishes a poll')
            .addOption({
                name: 'title',
                description: 'The title of the poll',
                type: 'String',
                required: true,
                autocomplete: true
            });
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const messageId = interaction.options.getString('title', true);
        const dbPoll = await Database.poll.findUnique({
            where: {
                messageId
            },
            include: {
                choices: { orderBy: { timestamp: 'asc' } }
            }
        });

        finassert(dbPoll !== null, { message: 'This poll does not exist', gif: 'dead' });
        finassert(
            dbPoll.authorId === interaction.user.id ||
                interaction.member.permissions.has('MANAGE_CHANNELS'),
            {
                message: 'This poll was not made by you',
                gif: 'permissions'
            }
        );

        const resultMessage = await PollCommon.deletePoll(interaction.guild, dbPoll);

        if (resultMessage instanceof Message) {
            await reply({
                title: 'The poll has been closed',
                content: `[Jump to the results](${resultMessage.url})`,
                ephemeral: true
            });
        } else {
            await reply({
                title: 'The poll has been closed',
                content: `It was empty`,
                ephemeral: true
            });
        }
    }

    public async printAutocomplete(
        interaction: AutocompleteInteraction<CacheType>
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        let dbUserPolls: DbPoll[] = [];
        if (interaction.memberPermissions?.has('MANAGE_CHANNELS')) {
            dbUserPolls = await Database.poll.findMany({
                where: {
                    guildId: interaction.guild?.id,
                    rolePoll: false
                }
            });
        } else {
            dbUserPolls = await Database.poll.findMany({
                where: {
                    authorId: interaction.user.id,
                    guildId: interaction.guild?.id,
                    rolePoll: false
                }
            });
        }

        return dbUserPolls.map((poll) => {
            return { name: poll.title, value: poll.messageId };
        });
    }
}
