import {
    InteractionReplyOptions,
    MessageEmbedOptions,
    MessageEmbed,
    Webhook,
    MessageOptions,
    Modal,
    Message
} from 'discord.js';
import { ChannelId, FinaChannel, MessageId } from './Types';

export interface FinaReplyOptions
    extends Omit<InteractionReplyOptions, 'flags'>,
        Omit<MessageOptions, 'flags'>,
        MessageEmbedOptions {
    /** Whether to not make an embed and discard the included MessageEmbedOptions */
    forceRaw?: boolean;

    /** The embed to display (will get merged with the included MessageEmbedOptions) */
    embed?: MessageEmbed;

    /** The modal to display (will take priority over the rest) */
    modal?: Modal;

    /** Whether to not reply at all (and not defer)
    Useful for component replies if the components are to be deleted
     (Discord will not display an error) */
    cancel?: boolean;
}

export interface FinaWebhookOptions extends Omit<FinaReplyOptions, 'cancel'> {
    webhookOptions?: {
        webhook: Webhook;
        username?: string;
        avatarURL?: string;
    };
}
export type FinaSendOptions =
    | (FinaWebhookOptions & {
          channel: FinaChannel;
      })
    | (FinaWebhookOptions & {
          channelId: ChannelId;
      });

export type FinaEditOptions =
    | (FinaSendOptions & {
          messageId: MessageId;
      })
    | (FinaWebhookOptions & {
          message: Message;
      });
