import {
    FinaSlashCommand,
    IMenuCommand,
    BaseReply,
    IButtonCommand
} from 'core/FinaCommand';
import { FinaButtonInteraction, FinaMenuInteraction } from 'core/Types';
import { ArcSessionManager } from './ArcSession';

export abstract class ArcSessionBasedCommand
    extends FinaSlashCommand
    implements IMenuCommand, IButtonCommand
{
    public async processMenu(
        reply: BaseReply,
        interaction: FinaMenuInteraction
    ): Promise<void> {
        await ArcSessionManager.get(interaction.channelId).processMenu(
            reply,
            interaction
        );
    }

    public async processButton(
        reply: BaseReply,
        interaction: FinaButtonInteraction
    ): Promise<void> {
        await ArcSessionManager.get(interaction.channelId).processButton(
            reply,
            interaction
        );
    }
}
