import { Guild, GuildMember } from 'discord.js';
import { finassert } from 'core/FinaError';
import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { ModmailHandler } from 'core/ModmailHandler';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';

export default class Modmail extends FinaSlashCommand {
    constructor() {
        super('ninja.nairobi.wip.modmail');
        this.setFlags('AlwaysEphemeral');
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('modmail')
            .setDescription('Sends a message to the moderation team.');
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const guild = interaction.guild;
        const member = interaction.member;

        // interaction.guild is only null in dm interactions, so this will never happen
        finassert(guild instanceof Guild, {
            details: 'Invalid guild'
        });
        finassert(member instanceof GuildMember, {
            details: 'Invalid member'
        });

        const iAmTestingOnAServerWithoutTier2 = true;
        if (!iAmTestingOnAServerWithoutTier2) {
            finassert(guild.premiumTier === 'TIER_2' || guild.premiumTier === 'TIER_3', {
                message:
                    'The server needs at least Tier 2 boost to create private threads. Sorry'
            });
        }

        const modmailGuild = await ModmailHandler.getGuild(
            guild,
            iAmTestingOnAServerWithoutTier2
        );
        const userThread = await modmailGuild.getUserThread(
            member,
            iAmTestingOnAServerWithoutTier2
        );

        await reply({
            content: `Your ticket is open: <#${userThread.id}>`
        });
    }
}
