import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';

export default class Facepalm extends FinaSlashCommand {
    public constructor() {
        super('ninja.nairobi.misc.facepalm');
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('facepalm')
            .setDescription('Facepalms.');
    }

    public async process(reply: BaseReply) {
        await reply({
            content: ' ',
            files: ['./res/misc/facepalm.mp4'],
            forceRaw: true
        });
    }
}
