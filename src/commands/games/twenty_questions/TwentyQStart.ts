import { FinaCommandResolvable } from 'core/FinaCommandBuilder';
import { FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { TwentyQGame } from 'commands/games/twenty_questions/TwentyQInstance';
import { BaseGameStart } from '../base/BaseGameStart';

export class TwentyQStart extends BaseGameStart<TwentyQGame> {
    constructor(uid: string) {
        super(uid, TwentyQGame);
        this.keys = ['ninja.nairobi.games.20questions'];
    }

    public createCommands(): FinaCommandResolvable {
        this.alias = '20questions';
        return new FinaCommandBuilder(this)
            .setName('20questions')
            .setDescription('Starts a guessing game')
            .addOption({
                type: 'String',
                name: 'character',
                description: 'The character to be guessed',
                required: true
            })
            .addOption(
                {
                    name: 'category',
                    type: 'String',
                    description: 'source material of the character',
                    required: false
                },
                'Eastern animation',
                'Western animation',
                'Live action',
                'Video game',
                'IRL',
                'Other'
            )
            .addOption({
                name: 'image',
                type: 'String',
                description: 'URL with an image',
                required: false
            })
            .addOption(
                {
                    name: 'rounds',
                    type: 'Integer',
                    description: 'The maximum number of questions (default: 20)',
                    required: false
                },
                5,
                10,
                15,
                20,
                25,
                30
            )
            .addOption(this._disableHelp);
    }
}
