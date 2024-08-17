import { BaseReply, FinaSlashCommand } from 'core/FinaCommand';
import { MessageAttachment } from 'discord.js';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { SharpCommon } from 'util/SharpCommon';
import { finassert } from 'core/FinaError';

export default class Circle extends FinaSlashCommand {
    public constructor() {
        super('ninja.nairobi.misc.circle');
        this.setFlags('AlwaysEphemeral');
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('circle')
            .setDescription('Crops an image into a circle')
            .addOption({
                name: 'image',
                description: 'The image to crop',
                type: 'Attachment',
                required: true
            })
            .addOption({
                name: 'hidden',
                type: 'Boolean',
                description: 'Whether to send this message privately (default: true)',
                required: false
            });
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const image = interaction.options.getAttachment('image', true);
        const hidden = interaction.options.getBoolean('hidden') ?? true;
        const MIME_WHITELIST = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/tiff'
        ];

        finassert(
            MIME_WHITELIST.some((mime) => image.contentType === mime),
            {
                message: `Invalid filetype. Allowed filetypes are ${MIME_WHITELIST.map(
                    (mime) => mime.replace(/.*\//g, '')
                ).reduce((prev, curr) => `${prev}, ${curr}`)}`,
                gif: 'angry'
            }
        );

        const { buffer, format } = await SharpCommon.circle(image.url, {
            size: 1024,
            allowAnimation: true,
            animatedSize: 128
        });
        const filename =
            (image.name?.replace(/\..*/g, '') ?? 'unknown') + `_circle.${format}`;
        await reply({
            forceRaw: true,
            ephemeral: hidden,
            files: [new MessageAttachment(buffer, filename)],
            image: { url: `attachment://${filename}` }
        });
    }
}
