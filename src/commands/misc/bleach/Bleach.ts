import { BaseReply, FinaCommand, IContextMessageCommand } from 'core/FinaCommand';
import { FinaCommandBuilder, FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { BleachFs } from './BleachFs';

const SIZE = 60;

export default class Bleach extends FinaCommand implements IContextMessageCommand {
    public constructor() {
        super('ninja.nairobi.misc.bleach');
        this.setFlags('AlwaysEphemeral');
        BleachFs.init();
    }

    public createCommands(): FinaCommandResolvable {
        return new FinaCommandBuilder(this)
            .setName('Clear the screen')
            .setType('MESSAGE');
    }

    public async processContextMessage(reply: BaseReply) {
        const lines = BleachFs.randomLine;
        const start = Math.floor(Math.random() * (lines.length - SIZE - 1));
        const end = start + SIZE;
        let res = '';
        for (let i = start; i < end; ++i) {
            res += `${lines[i]}\n`;
        }
        await reply({ content: res });
    }
}
