export interface Message {
    id: Snowflake;
    channel_id: Snowflake;
    attachments: Attachment[];
}

export interface Attachment {
    id: Snowflake;
    filename: string;
    url: string;
}

type Snowflake = string;
