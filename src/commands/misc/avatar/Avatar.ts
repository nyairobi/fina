import { BaseReply, IContextUserCommand, FinaCommand } from 'core/FinaCommand';
import { Guild, MessageAttachment } from 'discord.js';
import { FinaContextUserInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { SharpCommon } from 'util/SharpCommon';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

export default class Avatar extends FinaCommand implements IContextUserCommand {
    public constructor() {
        super('ninja.nairobi.misc.avatar');
        this.setFlags('AlwaysEphemeral');
    }

    public createCommands(): FinaCommandResolvable {
        return [
            new FinaCommandBuilder(this)
                .setName('Show avatar (square)', 'square')
                .setType('USER'),
            new FinaCommandBuilder(this)
                .setName('Show avatar (circle)', 'circle')
                .setType('USER')
        ];

        // .addOption({
        //     name: 'user',
        //     description: 'The user to fetch the pfp from',
        //     type: 'User',
        //     required: false
        // }
        // .addOption({
        //     name: 'local',
        //     description:
        //         'Whether to show the nitro pfp specific to this server (default: false)',
        //     type: 'Boolean',
        //     required: false
        // }
        // .addOption({
        //     name: 'circle',
        //     description: 'Whether to crop it into a circle (default: false)',
        //     type: 'Boolean',
        //     required: false
        // });
    }

    private async print(
        url: string,
        title: string,
        circle: boolean
    ): Promise<FinaReplyOptions> {
        url += '?size=1024';
        if (circle) {
            const { buffer, format } = await SharpCommon.circle(url, {
                size: 1024,
                allowAnimation: true,
                animatedSize: 128
            });
            return {
                title,
                files: [new MessageAttachment(buffer, `pfp.${format}`)],
                image: { url: `attachment://pfp.${format}` }
            };
        } else {
            return {
                title,
                image: {
                    url
                }
            };
        }
    }

    public async processContextUser(
        reply: BaseReply,
        interaction: FinaContextUserInteraction
    ): Promise<void> {
        const member = interaction.targetMember;
        const circle = interaction.hint === 'circle';

        const localPfpURL = member.displayAvatarURL({ dynamic: true });
        const globalPfpURL = member.user.displayAvatarURL({ dynamic: true });
        const defaultTitle = `${member.displayName} (${member.user.tag})`;

        if (globalPfpURL === '') {
            await reply({
                title: 'Emptiness',
                content: ' ',
                ephemeral: true
            });
        } else {
            if (globalPfpURL === localPfpURL || localPfpURL === '') {
                await reply(await this.print(localPfpURL, defaultTitle, circle));
            } else {
                await Promise.all([
                    reply(await this.print(localPfpURL, defaultTitle, circle)),
                    reply(await this.print(globalPfpURL, member.user.tag, circle))
                ]);
            }
        }
        // public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        //     const user = interaction.options.getUser('user') || interaction.user;
        //     const local = interaction.options.getBoolean('local') || false;
        //     const circle = interaction.options.getBoolean('circle') || false;
        //     const guild = interaction.guild;

        //     let title = '';
        //     let res = '';

        //     if (!local || guild == null || !guild.available) {
        //         res = user.avatarURL({ dynamic: true }) || '';
        //         title = user.tag;
        //     } else {
        //         const member = await guild.members.fetch(user);
        //         res =
        //             member.displayAvatarURL({ dynamic: true }) ||
        //             user.avatarURL({ dynamic: true }) ||
        //             '';
        //         title = `${member.displayName} (${user.tag})`;
        //     }

        //     if (res === '') {
        //         await reply({
        //             title,
        //             content: 'Emptiness',
        //             ephemeral: true
        //         });
        //     } else {
        //         const url = `${res}?size=1024`;
        //         if (circle) {
        //             const [file, format] = await circleGenerator(url, {
        //                 size: 1024,
        //                 allowAnimation: true,
        //                 animatedSize: 128
        //             });
        //             await reply({
        //                 title,
        //                 files: [new MessageAttachment(file, `pfp.${format}`)],
        //                 image: { url: `attachment://pfp.${format}` }
        //             });
        //         } else {
        //             await reply({
        //                 title,
        //                 image: {
        //                     url
        //                 }
        //             });
        //         }
        //     }
    }
}
