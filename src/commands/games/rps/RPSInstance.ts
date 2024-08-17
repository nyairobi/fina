import { Mutex } from 'async-mutex';
import { finassert, FinaError } from 'core/FinaError';
import {
    EmojiResolvable,
    GuildMember,
    MessageActionRow,
    MessageAttachment,
    MessageButton,
    MessageButtonStyle,
    User
} from 'discord.js';
import { FinaButtonInteraction } from 'core/Types';
import DuelTitles from './RPSTitles.json';
import Tools from 'util/Tools';
import { DiscordTools } from 'util/DiscordTools';
import { RPSRenderer } from './RPSRenderer';
import { FinaReplyOptions } from 'core/FinaReplyOptions';

export interface RPSType {
    name: string;
    path: string;
    emoji: EmojiResolvable;
    buttonStyle: string;
    color: string;
    files: string[];
    supercolor?: string;
    next: RPSType | null;
}

export interface RPSTheme {
    backgrounds: string[];
    types: RPSType[];
    frame: string;
    name: string;
}

export class RPSInstance {
    private _gameOver: boolean;
    private _theme: RPSTheme;
    private _players: [GuildMember, GuildMember];
    private _choices: [RPSType | null, RPSType | null];
    private _mutex: Mutex;
    private _legendaryRolls: [boolean, boolean];
    private _title: string;

    public constructor(theme: RPSTheme, players: [GuildMember, GuildMember]) {
        this._gameOver = false;
        this._theme = theme;
        this._players = players;
        this._choices = [null, null];
        this._mutex = new Mutex();
        this._legendaryRolls = [Math.random() < 0.5, Math.random() < 0.5];
        this._title = this.createTitle();
    }

    public get title() {
        return this._title;
    }

    public get gameOver() {
        return this._gameOver;
    }

    public printWelcomeMessage(): FinaReplyOptions {
        const row = new MessageActionRow();
        const theme = this._theme;
        const normalTypes = theme.types.filter((type) => type.supercolor === undefined);
        const superType = theme.types.find((type) => type.supercolor !== undefined);

        let content = `<@${this._players[0].id}> has challenged <@${this._players[1].id}> into ${theme.name}! Choose your color below.\n\n`;

        for (let i = 0; i < normalTypes.length; ++i) {
            const t1 = normalTypes[i];
            finassert(t1.next !== null, {
                details: 'Invalid theme'
            });
            // const t2 = normalTypes[(i + 1) % normalTypes.length];
            content += `${t1.emoji} ${t1.name.toUpperCase()} ${
                t1.name.at(-1) === 's' ? 'beat' : 'beats'
            } ${t1.next.emoji} ${t1.next.name.toUpperCase()}\n`;
        }

        if (superType !== undefined) {
            content += `${
                superType.emoji
            } ${superType.name.toUpperCase()} has 50-50 chance to beat anything!`;
        }

        for (const [, type] of Array.from(theme.types.entries())) {
            if (type !== undefined) {
                row.addComponents(
                    new MessageButton()
                        .setCustomId(type.path)
                        .setLabel(type.name)
                        .setEmoji(type.emoji)
                        .setStyle(type.buttonStyle as MessageButtonStyle)
                );
            }
        }

        return {
            title: this._title,
            content,
            components: [row]
        };
    }

    private createTitle() {
        let res = 'The ';

        // Add name prefix
        if (Math.random() < 0.2) {
            res += `${Tools.randomArrayElement(
                DuelTitles.commonAdjectives.concat(DuelTitles.duelAdjectives)
            )} `;
        }

        // Add core name
        res += Tools.randomArrayElement(DuelTitles.coreNouns);

        // Add name affix
        if (Math.random() < 0.3) {
            res += ' of the ';
            if (Math.random() < 0.6) {
                res += Tools.randomArrayElement(
                    DuelTitles.humanNouns.concat(DuelTitles.placeNouns)
                );
            } else if (Math.random() < 0.6) {
                res += Tools.randomArrayElement(
                    DuelTitles.commonAdjectives.concat(DuelTitles.humanAdjectives)
                );
            } else {
                res +=
                    Tools.randomArrayElement(
                        DuelTitles.commonAdjectives.concat(DuelTitles.humanAdjectives)
                    ) +
                    ' ' +
                    Tools.randomArrayElement(DuelTitles.humanNouns);
            }
        }
        return res;
    }

    private pickWinner() {
        finassert(this._choices[0] !== null && this._choices[1] !== null, {
            details: 'Need 2 choices'
        });

        const legendary = [
            this._choices[0].supercolor !== undefined && this._legendaryRolls[0],
            this._choices[1].supercolor !== undefined && this._legendaryRolls[1]
        ];

        if (legendary[0] && !legendary[1]) {
            return this._players[0];
        }
        if (legendary[1] && !legendary[0]) {
            return this._players[1];
        }

        if (
            this._choices[0].next?.path === this._choices[1].path ||
            (this._choices[1].next === null && this._choices[0].next !== null)
        ) {
            return this._players[0];
        }
        if (
            this._choices[1].next?.path === this._choices[0].path ||
            (this._choices[0].next === null && this._choices[1].next !== null)
        ) {
            return this._players[1];
        }
        return null;
    }

    public async processButton(interaction: FinaButtonInteraction) {
        finassert(!this._gameOver, { message: 'This game is over!', gif: 'angry' });
        const currentChoice = this._theme.types.find(
            (type) => type.path === interaction.customId
        );
        finassert(currentChoice !== undefined, { message: 'Invalid choice' });
        const sourceMessage = interaction.message;
        return await this._mutex.runExclusive(async () => {
            if (interaction.user.id === this._players[0].id) {
                this._choices[0] = currentChoice;
            } else if (interaction.user.id === this._players[1].id) {
                this._choices[1] = currentChoice;
            } else {
                throw new FinaError({
                    message: 'You are not playing this game!',
                    gif: 'permissions'
                });
            }

            if (
                this._choices[0] !== null &&
                (this._choices[1] !== null || this._players[1].user.bot)
            ) {
                this._gameOver = true;
                if (this._choices[1] === null) {
                    this._choices[1] = Tools.randomArrayElement(this._theme.types);
                }
                const resolveColor = (choice: RPSType, legendaryRoll: boolean) => {
                    if (choice.supercolor !== undefined && legendaryRoll) {
                        return choice.supercolor;
                    } else {
                        return choice.color;
                    }
                };

                const winner = this.pickWinner();
                const image = await RPSRenderer.render({
                    pfp1: {
                        url: this._players[0].displayAvatarURL(),
                        winner: winner?.id === this._players[0].id
                    },
                    pfp2: {
                        url: this._players[1].displayAvatarURL(),
                        winner: winner?.id === this._players[1].id
                    },
                    weapon1: {
                        file: Tools.randomArrayElement(this._choices[0].files),
                        color: resolveColor(this._choices[0], this._legendaryRolls[0])
                    },
                    weapon2: {
                        file: Tools.randomArrayElement(this._choices[1].files),
                        color: resolveColor(this._choices[1], this._legendaryRolls[1])
                    },
                    frame: this._theme.frame,
                    background: Tools.randomArrayElement(this._theme.backgrounds)
                });
                const recentMessages = await sourceMessage.channel.messages.fetch({
                    limit: 3
                });
                const replyOptions = {
                    title: this._title,
                    content: winner === null ? 'Draw!' : `<@${winner.id}> wins!`,
                    image: {
                        url: 'attachment://vs.png'
                    },
                    files: [new MessageAttachment(image, 'vs.png')],
                    components: [],
                    message: sourceMessage
                };
                if (recentMessages.some((message) => message.id === sourceMessage.id)) {
                    DiscordTools.editMessage(null, replyOptions);
                } else {
                    sourceMessage
                        .reply(DiscordTools.makeEmbed(replyOptions))
                        .then((repliedMessage) => {
                            DiscordTools.editMessage(null, {
                                content: `[This game is over](${repliedMessage.url})`,
                                components: [],
                                message: sourceMessage
                            });
                        });
                }
                return {
                    content: `You have chosen ${currentChoice.emoji} **${currentChoice.name}.**`,
                    ephemeral: true
                };
            } else {
                return {
                    content: `You have chosen ${currentChoice.emoji} **${currentChoice.name}.** Wait for the other player.`,
                    ephemeral: true
                };
            }
        });
    }
}
