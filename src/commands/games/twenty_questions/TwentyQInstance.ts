import { Mutex } from 'async-mutex';
import { BaseReply } from 'core/FinaCommand';
import { finassert } from 'core/FinaError';
import { FinaCommandInteraction } from 'core/Types';
import {
    Message,
    MessageComponentInteraction,
    CommandInteraction,
    GuildChannel,
    MessageActionRow,
    MessageButton
} from 'discord.js';
import { DiscordTools } from 'util/DiscordTools';
import { StringTools } from 'util/StringTools';
import { PlayerId, BaseGameInstance } from '../base/BaseGameInstance';
import { GameManager } from '../base/GameManager';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

const ANSWERS = {
    yes: 'yes',
    no: 'no',
    idk: "don't know",
    cancel: 'cancelled',
    end_first: 'yes!',
    end_final: 'yes!'
};

type TwentyQButton = keyof typeof ANSWERS;

const isTwentyQButton = (val: string): val is TwentyQButton => {
    return Object.values(ANSWERS).find((button) => button === val) !== undefined;
};

type TwentyQAnswer = {
    id: number;
    senderId: PlayerId;
    text: string;
    answer?: TwentyQButton;
    message: Message;
};

export class TwentyQGame extends BaseGameInstance {
    info = {
        title: 'Questions',
        welcomeMessage:
            '\n\nGuess the character by asking yes–no questions, for example:\n\
            ```/answer The character has blue hair```\n\
            You will win if you correctly name the character, for example:\n\
            ```/answer The character is Slammer from Dead Cells```\n\
            Questions answered with "*don\'t know*" don\'t count towards the total number of rounds.',
        hostMessage: {
            title: "You've started a game of 20 questions.",
            content: `You will receive a DM whenever someone takes a guess.
            
            Use the green button to confirm a yes–no question. 
            Use the blue button to confirm a character guess. 
            **The blue button will end the game.**

            You can revisit and correct older questions using the menu below.`
        },
        mmr: {
            Host: 10,
            Winner: 30,
            'Other players': 10
        }
    };

    /** The character to guess (announced at the end of the round) */
    private _character: string;

    /** The category of the character */
    private _category: string | null;

    /** Pic sent at the end of the game */
    private _picRelated: string | null;

    /** Max number of rounds in this game */
    private _roundsCount: number;

    /** Questions and answers sent so far */
    private _answers: TwentyQAnswer[];

    /** Mutex used to avoid race conditions when two questions are asked simultaneously */
    private _mutex: Mutex;

    /** Whether the final (guessing) round has started */
    private _finalRound: boolean;

    /** OP's most recent interaction to send questions with; interactions last only 15 minutes */
    private _mostRecentReplier: BaseReply;

    public constructor(reply: BaseReply, interaction: FinaCommandInteraction) {
        super(reply, interaction);

        this._character = interaction.options.getString('character', true);
        this._category = interaction.options.getString('category');
        this._picRelated = interaction.options.getString('image');
        this._roundsCount = interaction.options.getInteger('rounds') || 20;

        if (interaction.options.getBoolean('disable-help')) {
            this.info.welcomeMessage = '';
        }
        this._answers = [];
        this._mutex = new Mutex();
        this._finalRound = false;
        this._mostRecentReplier = reply;

        this.info.title = `${this._roundsCount} ${this.info.title}`;
    }

    public async answer(reply: BaseReply, interaction: CommandInteraction) {
        const senderId = interaction.user.id;
        const text = StringTools.trim(interaction.options.getString('guess', true), 100);

        finassert(senderId !== this.op.id, {
            message: 'The host cannot take guesses',
            gif: 'angry'
        });

        const player = this.players.ensure(senderId, () => {
            return {
                state: 'Ready',
                mmrGain: 0
            };
        });

        finassert(player.state !== 'Done', {
            message: 'You cannot take any more guesses',
            gif: 'permissions'
        });

        finassert(this.getRound() < this._roundsCount || this._finalRound, {
            message: 'You have run out of questions. The final round will begin soon',
            gif: 'dead'
        });

        const id = this._answers.length + 1;

        if (this._finalRound) {
            player.state = 'Done';
        } else {
            /* Paused/Ready -> Ready */
            player.state = 'Ready';
        }

        const opButtons = this.generateButtons(id, true);
        const playerButtons = this.generateButtons(id, false);

        await this._mutex.runExclusive(async () => {
            const messageToPlayers = this._finalRound
                ? await reply({
                      author: { name: `Guess` },
                      title: text,
                      fetchReply: true
                      /* The final round has no playerButtons */
                  })
                : await reply({
                      author: {
                          name: `Question ${this.getRound() + 1}/${this._roundsCount}`
                      },
                      title: text,
                      components: [playerButtons],
                      fetchReply: true
                  });
            await this._mostRecentReplier({
                content: '\u200b',
                components: [opButtons],
                forceRaw: true,
                ephemeral: true,
                fetchReply: true
            });

            this._answers.push({
                id,
                senderId,
                text,
                message: messageToPlayers
            });
        });
    }

    public async processButton(
        reply: BaseReply,
        interaction: MessageComponentInteraction
    ) {
        finassert(this.gameOver === false, {
            message: 'This game is over',
            gif: 'dead'
        });

        finassert(interaction.message instanceof Message, { message: 'Invalid message' });
        finassert(interaction.channel instanceof GuildChannel, {
            message: 'Invalid channel'
        });

        if (this.op.id === interaction.user.id) {
            this._mostRecentReplier = reply;
            this.resetTimeout();
        }

        const separator = interaction.customId.indexOf('_');
        const id = parseInt(interaction.customId.slice(0, separator)) - 1;
        const button = interaction.customId.slice(separator + 1);
        const answer = this._answers[id];

        // This method is only registered to valid buttons so it should never occur
        finassert(isTwentyQButton(button), {
            message: 'Invalid button'
        });

        this._answers[id].answer = button;

        // Delete the cancel button and update the question
        DiscordTools.editMessage(null, {
            title: `**${this._answers[id].text}** — *${ANSWERS[button]}*`,
            components: [],
            message: answer.message
        });

        if (button === 'end_first') {
            this.status = 'Victory';
            for (const [, player] of this.players) {
                player.mmrGain = this.info.mmr['Other players'];
            }
            const winner = this.players.get(answer.senderId);
            finassert(winner !== undefined, {
                message: 'No winner'
            });

            winner.mmrGain = this.info.mmr.Winner;

            GameManager.end(this, this.op.id, 'Victory');
        } else if (this.getAnswerCount() === this._roundsCount) {
            answer.message.channel.send(
                DiscordTools.makeEmbed({
                    title: 'Final round'
                })
            );
            this._finalRound = true;
        } else if (this._finalRound) {
            const players = Array.from(this.players.values());
            if (players.find((player) => player.state === 'Ready') === undefined) {
                this.op.mmrGain = this.info.mmr.Host;
                this.status = 'Loss';
                GameManager.end(this, this.op.id, 'Defeat');
            }
        }

        // Shadow ping the questioner
        const response = await reply({
            content: `<@${answer.senderId}>`,
            forceRaw: true,
            fetchReply: true
        });

        await response.delete();
    }

    public printWelcomeScreen(): FinaReplyOptions {
        let res = super.printWelcomeScreen();
        res.content = `<@${this.op.id}> has come up with a character.\nCategory: ${
            this._category || 'None'
        } ${this.info.welcomeMessage}`;

        return res;
    }

    public printSummary(authorId: string | null) {
        let res = super.printSummary(authorId);

        let text = '';
        this._answers.forEach((answer) => {
            text += `${answer.text} — *${
                answer.answer === undefined ? 'unanswered' : ANSWERS[answer.answer]
            }*\n`;
        });
        res.fields ??= [];

        res.fields.unshift({
            name: 'Category',
            value: this._category || 'None',
            inline: false
        });

        res.fields.push({
            name: 'Answers',
            value: text || 'None yet',
            inline: false
        });
        if (authorId === this.op.id) {
            res.fields.unshift({
                name: 'Character declared',
                value: this._character,
                inline: false
            });
            if (this._picRelated !== null) {
                res.thumbnail = {
                    url: StringTools.validateURL(this._picRelated)
                };
            }
        }
        return res;
    }

    private generateButtons(id: number, opButtons: boolean) {
        const actionRow = new MessageActionRow();
        if (opButtons) {
            const yes = new MessageButton()
                .setCustomId(`${id}_yes`)
                .setLabel(`Yes`)
                .setStyle('SUCCESS');
            const no = new MessageButton()
                .setCustomId(`${id}_no`)
                .setLabel(`No`)
                .setStyle('DANGER');
            const idk = new MessageButton()
                .setCustomId(`${id}_idk`)
                .setLabel(`Don't know`)
                .setStyle('SECONDARY');
            const endFirst = new MessageButton()
                .setCustomId(`${id}_end_first`)
                .setLabel(`Correct answer`)
                .setStyle('PRIMARY')
                .setEmoji('⭐');

            if (this._finalRound) {
                actionRow.addComponents(endFirst, no);
            } else {
                actionRow.addComponents(yes, no, idk, endFirst);
            }
        } else if (!this._finalRound) {
            actionRow.addComponents(
                new MessageButton()
                    .setCustomId(`${id}_cancel`)
                    .setLabel(`Cancel`)
                    .setStyle('SECONDARY')
                //.setEmoji('613039884105678862')
            );
        }
        return actionRow;
    }

    /**
     * Number of questions the op has replies to in a meaningful way
     * @returns Number of questions answered 'yes'/'no'
     */
    private getAnswerCount() {
        return this._answers.filter((a) => a.answer === 'yes' || a.answer === 'no')
            .length;
    }

    /**
     * Same as getAnswerCount() + questions already asked but not answered yet
     * @returns Number of questions ansswered 'yes'/'no' or unanswered
     */
    private getRound() {
        return (
            this._answers.filter((a) => a.answer == null).length + this.getAnswerCount()
        );
    }
}
