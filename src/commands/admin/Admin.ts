import { FinaCommandGroup } from 'core/FinaCommandGroup';
import { Commands } from './Commands';
import { Config } from './Config';

export default class Admin extends FinaCommandGroup {
    public constructor() {
        super('ninja.nairobi.common.admin');
        this.name = 'admin';
        this.setFlags('AlwaysEphemeral', 'AdminOnly', 'DelayedInit');
        this.addSubcommand(Commands);
        this.addSubcommand(Config);
    }
}
