import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { Guild } from 'discord.js';
import { TwentyQStart } from '../twenty_questions/TwentyQStart';
import { GameManager } from './GameManager';
import { RPSStart } from '../rps/RPSStart';
import { FinaCommandInteraction } from 'core/Types';
import { FinaCommandGroup } from 'core/FinaCommandGroup';
import { FinaCommandBuilder } from 'core/FinaCommandBuilder';

class GameStart extends FinaCommandGroup {
    constructor(uid: string) {
        super(uid);
        this.name = 'create';
        this.keys = ['ninja.nairobi.games.20questions', 'ninja.nairobi.games.rps'];
        this.addSubcommand(TwentyQStart);
        this.addSubcommand(RPSStart);
    }
}

class GameEnd extends FinaSlashCommand {
    constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.games.20questions'];
    }

    public createCommands(guild: Guild): FinaCommandBuilder {
        this.alias = 'close';
        return new FinaCommandBuilder(this)
            .setName('close')
            .setDescription(
                "Exit the current round (finishes the game if you're the host)"
            );
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        GameManager.end(interaction, interaction.user.id, 'The host has ended the game');
        await reply({ content: 'Thank you for playing', ephemeral: true });
    }
}

class GameStatus extends FinaSlashCommand {
    constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.games.20questions'];
    }

    public createCommands(guild: Guild): FinaCommandBuilder {
        this.alias = 'status';
        return new FinaCommandBuilder(this)
            .setName('status')
            .setDescription('Display information about the current game');
    }

    async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const game = GameManager.getCurrentGame(interaction);
        await reply(game.printSummary(interaction.user.id));
    }
}
export default class GameCommand extends FinaCommandGroup {
    constructor() {
        super('ninja.nairobi.games.game');
        this.name = 'game';
        this.keys = ['ninja.nairobi.games.20questions', 'ninja.nairobi.games.rps'];
        this.dataUsageDescription =
            "Stores your MMR and the number of games you've played (not really because it's not implemented yet)";
        this.setFlags('RequiresTerms');

        this.addSubcommand(GameStart);
        this.addSubcommand(GameEnd);
        this.addSubcommand(GameStatus);
    }
}
