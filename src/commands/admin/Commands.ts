import { FinaSlashCommand, BaseReply, IMenuCommand } from 'core/FinaCommand';
import { Guild, MessageActionRow, MessageSelectMenu } from 'discord.js';
import { FinaCommandInteraction, FinaMenuInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import Database from 'core/Database';
import { finassert } from 'core/FinaError';
import { Fina } from 'core/Fina';

export class Commands extends FinaSlashCommand implements IMenuCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.common.admin'];
        this.setFlags('AlwaysEphemeral', 'AdminOnly');
    }

    public createCommands(guild: Guild): FinaCommandResolvable {
        this.alias = 'commands';
        return new FinaCommandBuilder(this)
            .setName('commands')
            .setDescription(`Enables or disables commands in ${guild.name}`);
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const dbPackages = (
            await Database.commandPackage.findMany({
                include: {
                    commandKeys: true
                }
            })
        ).filter(
            (dbPackage) =>
                !dbPackage.hidden || interaction.user.id === process.env.OWNER_ID
        );
        const dbServer = await Database.server.findUnique({
            where: {
                serverId: interaction.guild.id
            },
            include: { commandKeys: true }
        });

        finassert(dbServer !== null, {
            message: 'Unrecoverable error',
            details: `Guild ${interaction.guild.id} is not present in the database`
        });

        for (const dbPackage of dbPackages) {
            const menu = new MessageSelectMenu()
                .setCustomId(dbPackage.packageId)
                .setMinValues(0)
                .setMaxValues(dbPackage.commandKeys.length)
                .setPlaceholder('No commands selected')
                .setOptions(
                    dbPackage.commandKeys
                        .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
                        .map((dbKey) => {
                            return {
                                label: dbKey.friendlyName,
                                description: dbKey.description,
                                value: dbKey.key,
                                default:
                                    dbServer.commandKeys.find(
                                        (foundKey) => dbKey.key === foundKey.key
                                    ) !== undefined
                            };
                        })
                );

            const row = new MessageActionRow().setComponents(menu);

            await reply({
                forceRaw: true,
                content: `**${dbPackage.friendlyName}**: ${dbPackage.description}`,
                components: [row],
                ephemeral: true
            });
        }
    }

    public async processMenu(
        reply: BaseReply,
        interaction: FinaMenuInteraction
    ): Promise<void> {
        const packageId = interaction.customId;
        const guildId = interaction.guild.id;
        const newKeys = interaction.values.map((value) => {
            return { key: value };
        });

        const dbPackage = await Database.commandPackage.findUnique({
            where: {
                packageId
            },
            include: {
                commandKeys: {
                    select: {
                        key: true
                    }
                }
            }
        });

        finassert(dbPackage !== null, { message: 'Invalid package' });

        await Database.server.update({
            where: {
                serverId: guildId
            },
            data: {
                commandKeys: {
                    disconnect: dbPackage.commandKeys,
                    connect: newKeys
                }
            }
        });

        if (
            packageId === 'ninja.nairobi.common' &&
            !interaction.values.includes('ninja.nairobi.common.admin')
        ) {
            await reply({
                title: 'Warning',
                content: `You have disabled Admin Util. \`/admin commands\` will no longer be available!`
            });
        } else {
            await reply({ forceRaw: true, content: '✅', ephemeral: true });
            await Fina.message('reload-guild', interaction.guild.id);
        }
    }
}
