import {
    ButtonInteraction,
    CommandInteraction,
    MessageContextMenuInteraction,
    Guild,
    GuildMember,
    Message,
    SelectMenuInteraction,
    TextChannel,
    UserContextMenuInteraction,
    ThreadChannel,
    ModalSubmitInteraction
} from 'discord.js';
import { DbArcChart } from 'core/Database';
// import { LangFunction } from '../util/Lang';

export type GuildId = string;
export type ChannelId = string;
export type UserId = string;
export type MessageId = string;
export type RoleId = string;

export type FinaInteractionComplement = {
    channel: FinaChannel;
    member: GuildMember;
    guild: Guild;
    hint?: string;
    // lang: LangFunction;
};

export type FinaComponentInteractionComplement = FinaInteractionComplement & {
    message: Message;
};

export type FinaChannel = TextChannel | ThreadChannel;

export type FinaCommandInteraction = CommandInteraction & FinaInteractionComplement;

export type FinaContextMessageInteraction = MessageContextMenuInteraction &
    FinaInteractionComplement & { targetMessage: Message };

export type FinaContextUserInteraction = UserContextMenuInteraction &
    FinaInteractionComplement & { targetMember: GuildMember };

export type FinaButtonInteraction = ButtonInteraction &
    FinaComponentInteractionComplement;

export type FinaMenuInteraction = SelectMenuInteraction &
    FinaComponentInteractionComplement;

export type FinaModalInteraction = ModalSubmitInteraction & FinaInteractionComplement;
