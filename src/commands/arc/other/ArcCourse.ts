import Database from 'core/Database';
import { FinaSlashCommand, BaseReply } from 'core/FinaCommand';
import { FinaCommandResolvable, FinaCommandBuilder } from 'core/FinaCommandBuilder';
import { FinaCommandInteraction } from 'core/Types';
import Tools from 'util/Tools';
import { ArcRendererCourse } from '../base/ArcRenderer';

export class ArcCourse extends FinaSlashCommand {
    public constructor(uid: string) {
        super(uid);
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];
        this.setFlags('RequiresTerms');
    }

    private DIFFICULTIES = ['4', '5', '6', '7', '8', '9', '9+', '10', '10+', '11', '12'];
    private LOWER_DIFF_PROBABILITY = [0.9, 0.7, 0.5];
    private CHART_COUNT = 4;

    public createCommands(): FinaCommandResolvable {
        this.alias = 'course';
        const command = new FinaCommandBuilder(this)
            .setName('course')
            .setDescription('Generates a random pseudo-course')
            .addOption({
                name: 'difficulty',
                description: 'The difficulty of the course',
                type: 'String',
                required: true,
                choices: this.DIFFICULTIES.slice(1)
            })
            .addOption({
                name: 'hidden',
                type: 'Boolean',
                description: 'Whether to send this message privately (default: true)',
                required: false
            });

        return command;
    }

    public async process(
        reply: BaseReply,
        interaction: FinaCommandInteraction
    ): Promise<void> {
        const difficulty = interaction.options.getString('difficulty', true);
        const ephemeral = interaction.options.getBoolean('hidden') ?? true;
        const userId = interaction.user.id;

        const previousDifficulty =
            this.DIFFICULTIES[
                this.DIFFICULTIES.findIndex(
                    (foundDifficulty) => foundDifficulty === difficulty
                ) - 1
            ];

        /* The number of charts that are a tier easier */
        let lesserChartCount = 0;

        /* Randomly set lesserChartCount to 0-3 */
        for (const roll of this.LOWER_DIFF_PROBABILITY) {
            if (Math.random() < roll) {
                lesserChartCount++;
            } else {
                break;
            }
        }

        const lesserRange = this.difficultyRange(previousDifficulty);
        const greaterRange = this.difficultyRange(difficulty);

        const dbArcChartsLesser = await Database.arcChart.findMany({
            where: {
                chartConstant: {
                    gte: lesserRange[0],
                    lte: lesserRange[1]
                },
                ownerships: {
                    some: {
                        userId
                    }
                }
            }
        });
        const dbArcChartsGreater = await Database.arcChart.findMany({
            where: {
                chartConstant: {
                    gte: greaterRange[0],
                    lte: greaterRange[1]
                },
                ownerships: {
                    some: {
                        userId
                    }
                }
            }
        });
        const dbArcCharts = [
            ...Tools.shuffle(dbArcChartsLesser)
                .slice(0, lesserChartCount)
                .sort((a, b) => a.chartConstant - b.chartConstant),
            ...Tools.shuffle(dbArcChartsGreater)
                .slice(0, this.CHART_COUNT - lesserChartCount)
                .sort((a, b) => a.chartConstant - b.chartConstant)
        ];

        const attch = await ArcRendererCourse.render('Test', 11, dbArcCharts);

        await reply({
            files: [attch],
            image: { url: 'attachment://course.png' },
            ephemeral,
            forceRaw: true
        });
    }

    private difficultyRange(difficulty: string) {
        let res: [number, number];
        if (difficulty.indexOf('+') > 0) {
            res = [parseFloat(difficulty) + 0.7, parseFloat(difficulty) + 0.9];
        } else if (parseInt(difficulty) >= 9) {
            res = [parseFloat(difficulty), parseFloat(difficulty) + 0.6];
        } else {
            res = [parseFloat(difficulty), parseFloat(difficulty) + 0.9];
        }
        res[0] *= 10.0;
        res[1] *= 10.0;
        return res;
    }
}
