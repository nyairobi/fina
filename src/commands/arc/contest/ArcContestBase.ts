import { FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { finassert } from 'core/FinaError';
import { FinaOptionData } from 'core/FinaOption';
import { FinaCommandInteraction } from 'core/Types';
import { ArcCommon } from '../base/ArcCommon';
import {
    ArcContestBanPhaseType,
    ArcContestDifficultyModifierType,
    ArcContestColorModifierTypeCommon,
    ArcContestColorModifierType
} from '../base/Types';
import { ArcSessionBasedCommand } from './ArcSessionBasedCommand';

export abstract class ArcContestBase extends ArcSessionBasedCommand {
    public constructor(uid: string) {
        super(uid);
        this.setFlags('AlwaysEphemeral');
        this.keys = ['ninja.nairobi.arc.contest'];
    }

    protected addCommonOptions(builder: FinaCommandBuilder, isDuel: boolean) {
        const commonOptions: FinaOptionData[] = [
            ...ArcCommon.getCommonDifficultyOptions(),
            {
                name: 'chart-count',
                description: 'The number of charts to draw (default: auto)',
                type: 'Integer',
                required: false,
                choices: [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
            },
            {
                name: 'order-by',
                description: 'What the player picks are ordered by (default: potential)',
                type: 'String',
                required: false,
                choices: ['Potential', 'Best 30', 'Random']
            },
            {
                name: 'rank-by',
                description: 'What determines the winner (default: score)',
                type: 'String',
                required: false,
                choices: ['Score', 'Shiny pures']
            },
            {
                name: 'ban-phase',
                description: 'The type of the ban phase (default: normal)',
                type: 'String',
                required: false,
                choices: Object.values(ArcContestBanPhaseType)
            },
            ...ArcCommon.getCommonModifierOptions(isDuel)
        ];

        commonOptions.forEach((option) => builder.addOption(option));
    }

    /**
     * Does not return chart count because it's contest-dependent
     */
    protected getCommonOptions(interaction: FinaCommandInteraction) {
        const minDifficulty = interaction.options.getNumber('min-difficulty') ?? 80;
        const maxDifficulty = interaction.options.getNumber('max-difficulty') ?? 126;
        const orderBy = interaction.options.getString('order-by') ?? 'Potential';
        const rankBy = interaction.options.getString('rank-by') ?? 'Score';
        const banPhase = (interaction.options.getString('ban-phase') ??
            'Normal') as ArcContestBanPhaseType;
        const difficultyModifier = (interaction.options.getString(
            'difficulty-modifier'
        ) ?? ArcContestDifficultyModifierType.All) as ArcContestDifficultyModifierType;
        const colorModifier = (interaction.options.getString('side-modifier') ??
            ArcContestColorModifierTypeCommon.None) as ArcContestColorModifierType;

        finassert(rankBy === 'Score' || rankBy === 'Shiny pures', {
            details: 'Invalid rankBy type'
        });

        return {
            minDifficulty,
            maxDifficulty,
            orderBy,
            rankBy: rankBy as 'Score' | 'Shiny pures',
            banPhase,
            difficultyModifier,
            colorModifier
        };
    }
}
