import { FinaSlashCommand, BaseReply, IButtonCommand } from 'core/FinaCommand';
import { GameManager } from './GameManager';
import { BaseGameInstance } from './BaseGameInstance';
import { FinaButtonInteraction, FinaCommandInteraction } from 'core/Types';
import { FinaOptionData } from 'core/FinaOption';

type GameConstructor<T> = new (
    reply: BaseReply,
    interaction: FinaCommandInteraction
) => T;

export abstract class BaseGameStart<T extends BaseGameInstance>
    extends FinaSlashCommand
    implements IButtonCommand
{
    private _TargetConstructor: GameConstructor<T>;
    protected _disableHelp: FinaOptionData = {
        name: 'disable-help',
        type: 'Boolean',
        description: "Whether to printn't the tutorial (default: false)",
        required: false
    };

    public constructor(uid: string, targetConstructor: GameConstructor<T>) {
        super(uid);
        this._TargetConstructor = targetConstructor;
    }

    public async process(reply: BaseReply, interaction: FinaCommandInteraction) {
        const game = new this._TargetConstructor(reply, interaction);
        await GameManager.create(interaction.channel, game);
        await reply(game.printWelcomeScreen());
    }

    public async processButton(reply: BaseReply, interaction: FinaButtonInteraction) {
        const currentGame = GameManager.getCurrentGame(interaction);
        await currentGame.processButton(reply, interaction);
    }
}
